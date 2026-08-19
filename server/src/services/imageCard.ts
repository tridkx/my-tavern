import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf: Buffer): number {
  return zlib.crc32(buf) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * 从 PNG 缓冲区中提取 tEXt chunk 里 keyword 为 chara 的 base64 JSON。
 */
export function extractCharaFromPng(buffer: Buffer): string | null {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'tEXt') {
      const data = buffer.subarray(dataStart, dataEnd);
      const nul = data.indexOf(0);
      if (nul !== -1) {
        const keyword = data.subarray(0, nul).toString('ascii');
        const text = data.subarray(nul + 1).toString('utf8');
        if (keyword === 'chara') return text;
      }
    }
    offset = dataEnd + 4; // skip CRC
  }
  return null;
}

interface RiffChunk {
  id: string;
  data: Buffer;
}

function readRiffChunks(buffer: Buffer): RiffChunk[] | null {
  if (buffer.length < 12) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunks: RiffChunk[] = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) break;
    chunks.push({ id, data: buffer.subarray(dataStart, dataEnd) });
    offset = dataEnd + (size % 2); // chunks are padded to even offset
  }
  return chunks;
}

function tryDecodeBase64Json(text: string): unknown | null {
  const candidates = [text, text.replace(/\s+/g, '')];
  for (const c of candidates) {
    try {
      const decoded = Buffer.from(c, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {
      // try next
    }
    try {
      return JSON.parse(c);
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * 从 WebP 缓冲区中提取 EXIF 或自定义 chunk 里的角色卡数据。
 * SillyTavern 生态常见做法是把 base64 JSON 放在 EXIF chunk 中。
 */
export function extractCharaFromWebp(buffer: Buffer): string | null {
  const chunks = readRiffChunks(buffer);
  if (!chunks) return null;
  for (const target of ['EXIF', 'chara', 'ICCP']) {
    const c = chunks.find((x) => x.id === target);
    if (!c) continue;
    let data = c.data;
    // WebP EXIF 通常带 "Exif\0\0" 前缀
    for (const prefix of ['Exif\0\0', 'exif\0\0']) {
      if (data.subarray(0, prefix.length).equals(Buffer.from(prefix, 'binary'))) {
        data = data.subarray(prefix.length);
        break;
      }
    }
    const text = data.toString('utf8').trim();
    if (tryDecodeBase64Json(text)) return text;
    const ascii = data.toString('latin1').trim();
    if (tryDecodeBase64Json(ascii)) return ascii;
  }
  return null;
}

/**
 * 从 PNG/WebP/JSON 缓冲区中提取角色卡对象。
 */
export function extractCharacterCard(buffer: Buffer): unknown {
  const png = extractCharaFromPng(buffer);
  if (png) return JSON.parse(Buffer.from(png, 'base64').toString('utf8'));
  const webp = extractCharaFromWebp(buffer);
  if (webp) {
    const decoded = tryDecodeBase64Json(webp);
    if (decoded) return decoded;
  }
  // 直接 JSON
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error('无法识别的角色卡文件：不是有效的 PNG/WebP/JSON');
  }
}

/**
 * 生成一张携带 chara tEXt chunk 的最小 PNG 角色卡图片。
 */
export function embedCharaPng(json: unknown): Buffer {
  const jsonText = JSON.stringify(json);
  const base64 = Buffer.from(jsonText, 'utf8').toString('base64');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 8); // height
  ihdr[12] = 6; // color type RGBA

  // 1x1 透明像素
  const raw = Buffer.from([0, 0, 0, 0, 0]);
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.concat([Buffer.from('chara\0', 'ascii'), Buffer.from(base64, 'ascii')])),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
