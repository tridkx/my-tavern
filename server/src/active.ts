import { MAX_CONCURRENT_GENERATIONS, MAX_CONCURRENT_MEDIA_GENERATIONS, MAX_CONCURRENT_UPLOADS } from './config.js';

export const activeGenerations = new Map<string, AbortController>();

/** 注册一个进行中的生成；达到上限时返回 false（调用方应回 429）。 */
export function tryRegisterGeneration(messageId: string, controller: AbortController): boolean {
  if (activeGenerations.size >= MAX_CONCURRENT_GENERATIONS) return false;
  activeGenerations.set(messageId, controller);
  return true;
}

export function abortGeneration(messageId: string): boolean {
  const controller = activeGenerations.get(messageId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/** 轻量并发信号量：tryAcquire 成功必须成对调用 release（建议放 finally）。 */
export function createLimiter(max: number) {
  let active = 0;
  return {
    tryAcquire(): boolean {
      if (active >= max) return false;
      active += 1;
      return true;
    },
    release(): void {
      active = Math.max(0, active - 1);
    },
  };
}

/** TTS / 图片生成共用限流。 */
export const mediaGenLimiter = createLimiter(MAX_CONCURRENT_MEDIA_GENERATIONS);

/** 上传共用限流（防大文件并发读入内存）。 */
export const uploadLimiter = createLimiter(MAX_CONCURRENT_UPLOADS);
