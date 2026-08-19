import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../src/services/context.js';

describe('estimateTokens', () => {
  it('estimates english text', () => {
    expect(estimateTokens('hello world this is a test')).toBeGreaterThan(0);
  });

  it('estimates chinese text', () => {
    expect(estimateTokens('你好，世界，这是一段中文测试')).toBeGreaterThan(0);
  });
});
