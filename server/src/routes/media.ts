import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AUDIO_DIR, IMAGE_DIR, UPLOAD_DIR } from '../config.js';
import { createMedia, deleteMedia, getMedia, listMedia } from '../repo.js';
import { assertSafeUrl } from '../net.js';

const MEDIA_KINDS = ['background', 'avatar', 'image', 'voice'] as const;
type MediaKind = (typeof MEDIA_KINDS)[number];

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
const GIF_SIG = Buffer.from('GIF8', 'ascii');
const OGG_SIG = Buffer.from('OggS', 'ascii');
const FLAC_SIG = Buffer.from('fLaC', 'ascii');

interface DetectedType {
  kind: 'image' | 'audio';
  ext: string;
}

/** 通过魔数嗅探文件真实类型，杜绝以假扩展名上传 HTML/SVG 等可执行内容。 */
export function detectFileType(buf: Buffer): DetectedType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) return { kind: 'image', ext: 'png' };
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_SIG)) return { kind: 'image', ext: 'jpg' };
  if (buf.length >= 4 && buf.subarray(0, 4).equals(GIF_SIG)) return { kind: 'image', ext: 'gif' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { kind: 'image', ext: 'webp' };
  }
  if (buf.length >= 4 && buf.subarray(0, 4).equals(OGG_SIG)) return { kind: 'audio', ext: 'ogg' };
  if (buf.length >= 4 && buf.subarray(0, 4).equals(FLAC_SIG)) return { kind: 'audio', ext: 'flac' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    return { kind: 'audio', ext: 'wav' };
  }
  if (buf.length >= 8 && buf.toString('ascii', 4, 8) === 'ftyp') return { kind: 'audio', ext: 'm4a' }; // MP4/AAC 容器
  if (buf.length >= 3 && buf.subarray(0, 3).toString('ascii') === 'ID3') return { kind: 'audio', ext: 'mp3' };
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { kind: 'audio', ext: 'mp3' }; // MPEG 帧同步
  return null;
}

function dirForKind(kind: MediaKind): string {
  return kind === 'voice' ? AUDIO_DIR : IMAGE_DIR;
}

function isMediaKind(v: string): v is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(v);
}

/** 对外响应剥离服务器绝对路径 file_path，避免泄露目录布局。 */
function toPublic(media: any) {
  const { file_path, ...rest } = media;
  return rest;
}

export function registerMediaRoutes(app: FastifyInstance) {
  app.get('/api/media', async (req) => {
    const query = req.query as { kind?: string };
    if (query.kind && !isMediaKind(query.kind)) {
      return { media: [] };
    }
    return { media: listMedia(query.kind).map(toPublic) };
  });

  app.delete('/api/media/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const media = getMedia(id);
    if (!media) return reply.code(404).send({ error: '资源不存在' });
    if (media.file_path && media.source === 'upload') {
      try {
        fs.unlinkSync(media.file_path);
      } catch {
        // ignore
      }
    }
    deleteMedia(id);
    return { ok: true };
  });

  app.post('/api/media/from-url', async (req, reply) => {
    const body = z
      .object({
        kind: z.enum(MEDIA_KINDS),
        name: z.string().optional(),
        url: z.string(),
      })
      .parse(req.body || {});
    try {
      assertSafeUrl(body.url);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'URL 无效' });
    }
    const media = createMedia({
      kind: body.kind,
      name: body.name || body.url.split('/').pop() || 'URL 资源',
      source: 'url',
      url: body.url,
    });
    return reply.code(201).send({ media: toPublic(media) });
  });

  app.post('/api/media/upload', async (req, reply) => {
    const parts = req.parts();
    let kind: MediaKind = 'image';
    let name = '';
    let buffer: Buffer | null = null;
    let filename = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        buffer = await part.toBuffer();
        filename = part.filename || `${randomUUID()}.bin`;
      } else if (part.type === 'field') {
        if (part.fieldname === 'kind' && isMediaKind(String(part.value || ''))) kind = String(part.value) as MediaKind;
        if (part.fieldname === 'name') name = String(part.value || '');
      }
    }

    if (!buffer) return reply.code(400).send({ error: '没有收到文件' });

    const detected = detectFileType(buffer);
    if (!detected) {
      return reply.code(400).send({ error: '不支持的文件类型：仅允许图片(png/jpg/gif/webp)或音频(mp3/ogg/wav/flac/m4a)' });
    }
    // 请求的 kind 与文件真实类型必须匹配：voice 需要音频，其余需要图片
    const wantsAudio = kind === 'voice';
    if (detected.kind === 'audio' && !wantsAudio) {
      return reply.code(400).send({ error: '音频文件只能作为语音资源上传' });
    }
    if (detected.kind === 'image' && wantsAudio) {
      return reply.code(400).send({ error: '语音资源必须是音频文件' });
    }

    // 扩展名取自嗅探结果，而非用户文件名
    const savedName = `${randomUUID()}.${detected.ext}`;
    const filePath = path.join(dirForKind(kind), savedName);
    fs.writeFileSync(filePath, buffer);
    const rel = path.relative(UPLOAD_DIR, filePath).split(path.sep).join('/');
    const media = createMedia({
      kind,
      name: name || filename,
      file_path: filePath,
      source: 'upload',
      url: `/media/${rel}`,
    });
    return reply.code(201).send({ media: toPublic(media) });
  });
}
