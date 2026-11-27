import session from 'express-session';
import { getRedis, isRedisConfigured } from './redis';
import { logger } from '../utils/logger';

const SESSION_PREFIX = 'pab:sess:';
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * express-session Store backed by the shared, optional Redis client.
 *
 * Redis is optional across this codebase: when REDIS_URL is absent or Redis is
 * unreachable, getRedis() resolves to null and every operation becomes a no-op.
 * That keeps the API's "never fail because a cache is down" contract — sessions
 * simply behave as they did before (MemoryStore) rather than taking requests
 * down. When Redis IS reachable, sessions survive restarts and work across
 * multiple instances, which is what production needs.
 */
export class RedisSessionStore extends session.Store {
  async get(
    sid: string,
    callback: (err: any, sess?: session.SessionData | null) => void,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis) return callback(null, undefined);
      const raw = await redis.get(SESSION_PREFIX + sid);
      if (!raw) return callback(null, undefined);
      callback(null, JSON.parse(raw) as session.SessionData);
    } catch (error) {
      // A corrupt value is equivalent to a missing session, not a 500.
      logger.warn(`[RedisSessionStore] could not read ${sid}: ${error instanceof Error ? error.message : String(error)}`);
      callback(null, undefined);
    }
  }

  async set(
    sid: string,
    sess: session.SessionData,
    callback?: (err?: any) => void,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis) return callback?.();
      const maxAge = Number(sess?.cookie?.maxAge ?? DEFAULT_TTL_SECONDS * 1000);
      const ttl = Number.isFinite(maxAge) && maxAge > 0
        ? Math.max(1, Math.floor(maxAge / 1000))
        : DEFAULT_TTL_SECONDS;
      await redis.set(SESSION_PREFIX + sid, JSON.stringify(sess), 'EX', ttl);
      callback?.();
    } catch (error) {
      // Session persistence is best-effort: never fail the response because the
      // cache could not be written.
      logger.warn(`[RedisSessionStore] could not write ${sid}: ${error instanceof Error ? error.message : String(error)}`);
      callback?.();
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void): Promise<void> {
    try {
      const redis = await getRedis();
      if (redis) await redis.del(SESSION_PREFIX + sid);
      callback?.();
    } catch (error) {
      logger.warn(`[RedisSessionStore] could not delete ${sid}: ${error instanceof Error ? error.message : String(error)}`);
      callback?.();
    }
  }

  async touch(
    sid: string,
    sess: session.SessionData,
    callback?: (err?: any) => void,
  ): Promise<void> {
    await this.set(sid, sess, callback);
  }
}

/** Only create the store when Redis is actually configured. */
export function createSessionStore(): session.Store | undefined {
  if (!isRedisConfigured()) return undefined;
  return new RedisSessionStore();
}
