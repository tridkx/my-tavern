import { describe, expect, it } from 'vitest';
import { embedCharaPng, extractCharacterCard } from '../src/services/imageCard.js';

function makeFakeWebp(card: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(card), 'utf8').toString('base64');
  const data = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), Buffer.from(json, 'ascii')]);
  const riffSize = Buffer.alloc(4);
  riffSize.writeUInt32LE(4 + 8 + data.length);
  const chunk = Buffer.alloc(8);
  chunk.write('EXIF', 0, 'ascii');
  chunk.writeUInt32LE(data.length, 4);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), riffSize, Buffer.from('WEBP', 'ascii'), chunk, data]);
}

describe('imageCard', () => {
  it('roundtrips Tavern V2 JSON through PNG chara chunk', () => {
    const card = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: { name: '测试角色', description: '来自 PNG 卡' },
    };
    const png = embedCharaPng(card);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const extracted = extractCharacterCard(png);
    expect(extracted).toEqual(card);
  });

  it('extracts plain JSON buffer', () => {
    const json = Buffer.from(JSON.stringify({ data: { name: '纯 JSON' } }));
    expect(extractCharacterCard(json)).toEqual({ data: { name: '纯 JSON' } });
  });

  it('extracts card from a WebP EXIF chunk (fake container)', () => {
    const card = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'WebP 角色' } };
    const webp = makeFakeWebp(card);
    expect(extractCharacterCard(webp)).toEqual(card);
  });
});
