'use client';

const QUEUE_KEY = 'roadmap:offline-mut';
const CACHE_PREFIX = 'roadmap:offline-cache:';
const MAX_QUEUE = 200;

type QueuedMutation = { id: string; url: string; method: string; headers: Record<string,string>; body?: string; createdAt: number };

function safeRead<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function safeWrite(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export function queueMutation(item: Omit<QueuedMutation, 'id' | 'createdAt'>) { const queue = safeRead<QueuedMutation[]>(QUEUE_KEY, []); queue.push({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }); safeWrite(QUEUE_KEY, queue.slice(-MAX_QUEUE)); }

export function cacheGet(url: string): Response | null {
  try { const raw = localStorage.getItem(CACHE_PREFIX + url); if (!raw) return null; const parsed = JSON.parse(raw) as { body: string; headers: Record<string,string>; status: number }; return new Response(parsed.body, { status: parsed.status || 200, headers: parsed.headers || { 'Content-Type': 'application/json' } }); } catch { return null; }
}
export function cachePut(url: string, response: Response) { response.clone().text().then(body => { const headers: Record<string,string> = {}; response.headers.forEach((v,k) => { headers[k] = v; }); safeWrite(CACHE_PREFIX + url, { body, headers, status: response.status }); }).catch(() => {}); }

export async function replayOfflineMutations() {
  const queue = safeRead<QueuedMutation[]>(QUEUE_KEY, []); if (!queue.length || !navigator.onLine) return;
  const remaining: QueuedMutation[] = [];
  for (const item of queue) {
    try {
      const response = await window.fetch(item.url, { method: item.method, headers: item.headers, body: item.body, credentials: 'include' });
      if (!response.ok && response.status >= 400 && response.status < 500 && response.status !== 409 && response.status !== 401) continue;
      if (!response.ok) remaining.push(item);
    } catch { remaining.push(item); }
  }
  safeWrite(QUEUE_KEY, remaining); if (!remaining.length) window.dispatchEvent(new CustomEvent('app:sync'));
}

export function installOfflineFetch() {
  if (typeof window === 'undefined') return () => {};
  const marker = '__roadmapOfflineFetchInstalled'; if ((window as any)[marker]) return () => {};
  (window as any)[marker] = true;
  const original = window.fetch.bind(window);
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init); const url = request.url; const method = request.method.toUpperCase();
    const sameOriginApi = url.startsWith(location.origin) && url.includes('/api/');
    if (!sameOriginApi || /\/api\/auth\/(login|logout|signup)(?:$|\?)/.test(url)) return original(request);
    if (method === 'GET' || method === 'HEAD') {
      try { const response = await original(request); if (response.ok) cachePut(url, response); return response; }
      catch { return cacheGet(url) || new Response(JSON.stringify({ offline: true, cached: false }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
    }
    let body: string | undefined; try { body = await request.clone().text(); } catch {}
    const headers: Record<string,string> = {}; request.headers.forEach((v,k) => { if (k !== 'content-length') headers[k] = v; });
    try { return await original(request); }
    catch { queueMutation({ url, method, headers, body: body || undefined }); return new Response(JSON.stringify({ queuedOffline: true }), { status: 202, headers: { 'Content-Type': 'application/json' } }); }
  };
  window.fetch = wrapped as typeof window.fetch;
  const onlineHandler = () => { void replayOfflineMutations(); };
  window.addEventListener('online', onlineHandler); void replayOfflineMutations();
  return () => { window.fetch = original; window.removeEventListener('online', onlineHandler); };
}
