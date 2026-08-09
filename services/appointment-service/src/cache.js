import Redis from 'ioredis';
import { config } from './config.js';

// Pure performance layer — never a hard dependency. If REDIS_URL isn't
// configured, or any Redis call fails, every function below transparently
// falls through to calling the real work function, so this service works
// identically (just without the speed boost) whether or not Redis exists.
export const redis = config.redisUrl
  ? new Redis(config.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: false })
  : null;

redis?.on('error', (err) => console.error('[appointment-service] redis error:', err.message));

const PREFIX = 'appointment-service:';

export async function cached(key, ttlSeconds, fetchFn) {
  if (!redis) return fetchFn();
  const fullKey = PREFIX + key;
  try {
    const hit = await redis.get(fullKey);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    console.error('[appointment-service] cache read failed:', err.message);
  }
  const value = await fetchFn();
  try {
    await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('[appointment-service] cache write failed:', err.message);
  }
  return value;
}

// KEYS+DEL is fine at this app's demo scale; would reach for SCAN at
// production scale to avoid blocking Redis on a large keyspace. Any write
// (booking/reschedule/cancel/status/follow-up) invalidates the whole
// namespace rather than surgically targeting specific keys — writes are
// infrequent relative to reads, so simplicity wins here.
export async function invalidateAll() {
  if (!redis) return;
  try {
    const keys = await redis.keys(PREFIX + '*');
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    console.error('[appointment-service] cache invalidate failed:', err.message);
  }
}
