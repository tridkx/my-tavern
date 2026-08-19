export const activeGenerations = new Map<string, AbortController>();

export function abortGeneration(messageId: string): boolean {
  const controller = activeGenerations.get(messageId);
  if (!controller) return false;
  controller.abort();
  return true;
}
