export interface ApiError extends Error {
  status?: number;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    throw new Error('未认证');
  }
  if (!res.ok) {
    let message = `请求失败 ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    const err = new Error(message) as ApiError;
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface StreamHandlers {
  onDelta?: (delta: string, messageId: string) => void;
  onDone?: (data: any) => void;
  onError?: (error: Error, data: any) => void;
}

export async function streamPost(path: string, body: unknown, handlers: StreamHandlers, signal?: AbortSignal): Promise<void> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('未认证');
  }
  if (!res.ok) {
    let message = `请求失败 ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error('响应没有内容');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const line = event.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const payload = line.slice(6);
      let data: any;
      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }
      if (data.type === 'delta') {
        handlers.onDelta?.(data.delta || '', data.messageId);
      } else if (data.type === 'done') {
        handlers.onDone?.(data);
      } else if (data.type === 'error') {
        handlers.onError?.(new Error(data.error || '生成失败'), data);
      }
    }
  }
}
