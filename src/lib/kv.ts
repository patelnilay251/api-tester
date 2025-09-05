import { Redis } from '@upstash/redis';

export interface KVClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
}

let cachedClient: KVClient | null = null;

function createMemoryKV(): KVClient {
  const store = new Map<string, { value: string; exp?: number }>();
  return {
    async get(key: string) {
      const it = store.get(key);
      if (!it) return null;
      if (it.exp && Date.now() > it.exp) {
        store.delete(key);
        return null;
      }
      return it.value;
    },
    async set(key: string, value: string, ttlSeconds?: number) {
      const exp = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
      store.set(key, { value, exp });
    },
  };
}

export function getKV(): KVClient {
  if (cachedClient) return cachedClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If proper Upstash envs not present, fall back to in-memory KV
  if (!url || !token) {
    cachedClient = createMemoryKV();
    return cachedClient;
  }

  // Lazy import @upstash/redis to avoid SSR/edge bundling issues when not configured
  const redis = new Redis({ url, token });

  cachedClient = {
    async get(key: string) {
      try {
        const v = await redis.get<string>(key);
        if (v == null) return null;
        return typeof v === 'string' ? v : JSON.stringify(v);
      } catch {
        return null;
      }
    },
    async set(key: string, value: string, ttlSeconds?: number) {
      try {
        if (ttlSeconds && ttlSeconds > 0) await redis.set(key, value, { ex: ttlSeconds });
        else await redis.set(key, value);
      } catch {
        // ignore
      }
    },
  };

  return cachedClient;
}

export default getKV;
