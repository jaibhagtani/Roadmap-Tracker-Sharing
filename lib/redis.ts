import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedis() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    keyPrefix: undefined,
  });
  client.on('error', (error) => {
    if (process.env.NODE_ENV !== 'test') console.error('[redis]', error.message);
  });
  return client;
}

export const redis = globalForRedis.redis === undefined ? createRedis() : globalForRedis.redis;
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

const PREFIX = process.env.REDIS_KEY_PREFIX || 'roadmap-tracker';
const DEFAULT_TTL = Math.max(5, Number(process.env.REDIS_DEFAULT_TTL || 30));
const VERSION_TTL = 60 * 60 * 24 * 30;
const SESSION_CACHE_TTL = Math.max(5, Number(process.env.AUTH_SESSION_CACHE_TTL || 30));

export function sessionCacheKey(sessionId: string, tokenHashValue: string) {
  return `${PREFIX}:auth-session:${sessionId}:${tokenHashValue.slice(0, 32)}`;
}

export function getAuthSessionCacheTtl() {
  return SESSION_CACHE_TTL;
}


async function ready() {
  if (!redis) return false;
  try {
    if (redis.status === 'wait') await redis.connect();
    return redis.status === 'ready';
  } catch {
    return false;
  }
}

function versionKey(userId: string) {
  return `${PREFIX}:version:user:${userId}`;
}

function publicVersionKey(roadmapId: string) {
  return `${PREFIX}:version:public-roadmap:${roadmapId}`;
}

export async function getUserCacheVersion(userId: string) {
  if (!await ready()) return 0;
  try { return Number((await redis!.get(versionKey(userId))) || 0); } catch { return 0; }
}

export async function bumpUserCache(userIds: string | string[]) {
  if (!await ready()) return;
  const ids = [...new Set(Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds])];
  if (!ids.length) return;
  try {
    const pipeline = redis!.pipeline();
    for (const userId of ids) {
      pipeline.incr(versionKey(userId));
      pipeline.expire(versionKey(userId), VERSION_TTL);
    }
    await pipeline.exec();
  } catch {
    // Cache is an optimization; PostgreSQL remains authoritative.
  }
}

export async function getPublicCacheVersion(roadmapId: string) {
  if (!await ready()) return 0;
  try { return Number((await redis!.get(publicVersionKey(roadmapId))) || 0); } catch { return 0; }
}

export async function bumpPublicRoadmapCache(roadmapId: string) {
  if (!await ready()) return;
  try {
    await redis!.multi().incr(publicVersionKey(roadmapId)).expire(publicVersionKey(roadmapId), VERSION_TTL).exec();
  } catch {
    // Best effort only.
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!await ready()) return null;
  try {
    const raw = await redis!.get(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

export async function setCached<T>(key: string, value: T, ttl = DEFAULT_TTL) {
  if (!await ready()) return;
  try { await redis!.set(key, JSON.stringify(value), 'EX', Math.max(1, ttl)); } catch {}
}

export async function delCached(...keys: string[]) {
  if (!keys.length || !await ready()) return;
  try { await redis!.unlink(...keys); } catch {}
}

export async function userCacheKey(userId: string, resource: string, params = '') {
  const version = await getUserCacheVersion(userId);
  return `${PREFIX}:v${version}:user:${userId}:${resource}${params ? `:${params}` : ''}`;
}

export async function publicRoadmapCacheKey(roadmapId: string, resource: string, params = '') {
  const version = await getPublicCacheVersion(roadmapId);
  return `${PREFIX}:v${version}:public-roadmap:${roadmapId}:${resource}${params ? `:${params}` : ''}`;
}

export function publicCacheKey(resource: string, params = '') {
  return `${PREFIX}:public:${resource}${params ? `:${params}` : ''}`;
}

/**
 * Flush only this application's namespace. Never use FLUSHALL/FLUSHDB because
 * REDIS_URL may point to a shared Redis instance.
 */
export async function flushAppCache() {
  if (!await ready()) return 0;
  let deleted = 0;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis!.scan(cursor, 'MATCH', `${PREFIX}:*`, 'COUNT', 500);
      cursor = next;
      if (keys.length) {
        deleted += await redis!.unlink(...keys);
      }
    } while (cursor !== '0');
    return deleted;
  } catch {
    return deleted;
  }
}

export async function flushUserCache(userId: string) {
  if (!await ready()) return 0;
  let deleted = 0;
  try {
    const patterns = [`${PREFIX}:*:user:${userId}:*`, `${PREFIX}:version:user:${userId}`];
    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [next, keys] = await redis!.scan(cursor, 'MATCH', pattern, 'COUNT', 250);
        cursor = next;
        if (keys.length) deleted += await redis!.unlink(...keys);
      } while (cursor !== '0');
    }
  } catch {}
  return deleted;
}

const OTP_TTL = Math.max(60, Number(process.env.OTP_TTL_SECONDS || 600));
const OTP_MAX_ATTEMPTS = 5;
function otpKey(userId: string) { return `${PREFIX}:otp:user:${userId}`; }

export async function setUserOtp(userId: string, otpHash: string) {
  if (!await ready()) throw new Error('Redis is unavailable. OTP cannot be issued.');
  await redis!.set(otpKey(userId), JSON.stringify({ otpHash, attempts: 0 }), 'EX', OTP_TTL);
}

export async function clearUserOtp(userId: string) { if (!await ready()) return; try { await redis!.del(otpKey(userId)); } catch {} }

export async function consumeUserOtp(userId: string, otpHash: string) {
  if (!await ready()) throw new Error('Redis is unavailable. OTP cannot be verified.');
  const key = otpKey(userId);
  const raw = await redis!.get(key);
  if (!raw) return { ok: false as const, reason: 'expired' as const };
  let entry: { otpHash: string; attempts: number };
  try { entry = JSON.parse(raw); } catch { await redis!.del(key); return { ok: false as const, reason: 'expired' as const }; }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) { await redis!.del(key); return { ok: false as const, reason: 'locked' as const }; }
  if (entry.otpHash !== otpHash) {
    entry.attempts += 1;
    if (entry.attempts >= OTP_MAX_ATTEMPTS) await redis!.del(key);
    else { const ttl = await redis!.ttl(key); if (ttl > 0) await redis!.set(key, JSON.stringify(entry), 'EX', ttl); }
    return { ok: false as const, reason: 'invalid' as const };
  }
  await redis!.del(key);
  return { ok: true as const };
}

export function getOtpTtl() { return OTP_TTL; }
