import { MAX_CONCURRENT_GENERATIONS } from './config.js';

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
