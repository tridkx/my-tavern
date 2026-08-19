import { describe, expect, it } from 'vitest';
import { embedCharaPng, extractCharacterCard } from '../src/services/imageCard.js';

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
});
