import { ResponseData } from '@/types';
import { getKV } from '@/lib/kv';
import { createHash } from 'crypto';

export interface HttpRequestArgs {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: unknown;
}

// Pure HTTP helper used by /api/test and agent tools
export async function httpRequest({ url, method, headers = {}, data = undefined }: HttpRequestArgs): Promise<ResponseData> {
  if (!url) throw new Error('URL is required');
  if (!method) throw new Error('Method is required');

  const upperMethod = method.toUpperCase();

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const init: RequestInit = {
    method: upperMethod,
    headers: fetchHeaders,
  };

  if (['POST', 'PUT', 'PATCH'].includes(upperMethod) && data !== undefined && data !== null) {
    init.body = typeof data === 'string' ? data : JSON.stringify(data);
  }

  // Cache rules: only cache GET; skip when Authorization present
  const hasAuth = Object.keys(fetchHeaders).some((k) => k.toLowerCase() === 'authorization');
  const canCache = upperMethod === 'GET' && !hasAuth;

  // Build stable cache key
  const kv = getKV();
  let cacheKey: string | null = null;
  if (canCache) {
    const sortedHeaders = Object.keys(fetchHeaders)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, string>>((acc, k) => {
        acc[k.toLowerCase()] = fetchHeaders[k];
        return acc;
      }, {});
    const bodyStr = init.body == null ? '' : typeof init.body === 'string' ? init.body : String(init.body);
    const keyRaw = JSON.stringify({ m: upperMethod, url, h: sortedHeaders, b: bodyStr });
    cacheKey = 'http:' + createHash('sha256').update(keyRaw).digest('hex');

    const cached = await kv.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ResponseData;
        return { ...parsed, fromCache: true };
      } catch {
        // fallthrough on parse error
      }
    }
  }

  const start = Date.now();
  const res = await fetch(url, init);
  const responseTime = Date.now() - start;

  const contentType = res.headers.get('content-type') || '';
  let responseData: unknown;
  if (contentType.includes('application/json')) {
    try {
      responseData = await res.json();
    } catch {
      responseData = await res.text();
    }
  } else {
    responseData = await res.text();
  }

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const result: ResponseData = {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
    data: responseData,
    responseTime,
    url: res.url,
    fromCache: false,
  };

  if (canCache && cacheKey) {
    const ttl = Number(process.env.HTTP_CACHE_TTL_SECONDS || 1200);
    try {
      await kv.set(cacheKey, JSON.stringify(result), ttl);
    } catch {}
  }

  return result;
}

export default httpRequest;
