import Redis, { type RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Optional Redis connection, shared by the trust cache and the BullMQ queues.
 *
 * ─── WHY REDIS IS OPTIONAL HERE ─────────────────────────────────────────────
 * Everything that uses Redis in this codebase has a correct behaviour without
 * it. The trust cache becomes a no-op that reads the database every time; the
 * queues run their processors inline instead of durably. Neither is a degraded
 * *failure*, both are the pre-Phase-3 behaviour.
 *
 * That matters because a hard Redis dependency inverts the purpose of this
 * phase. The stated goal is to stop the API crashing. A server that refuses to
 * boot when its cache is unreachable crashes harder than one that quietly reads
 * a row it needed to read anyway. So `REDIS_URL` absent, or a Redis that is
 * down, or a Redis that hangs, all resolve to "no cache" rather than to an
 * exception on a request path.
 *
 * The same applies to how failures are reported. ioredis emits 'error' on every
 * failed reconnect; an unhandled 'error' event on an EventEmitter throws, which
 * means a Redis that is merely down would take the process with it. Handlers
 * are attached before any connection is attempted for exactly that reason.
 */

const REDIS_URL = process.env.REDIS_URL ?? '';

/** ioredis default is 10s; these are short so a dead Redis cannot stall a request. */
const BASE_OPTIONS: RedisOptions = {
  // Do not buffer commands issued while the socket is down. A queued GET that
  // never resolves is worse than a miss: the caller would wait forever instead
  // of falling through to the database.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 2,
  connectTimeout: 3000,
  // Back off up to 5s. A Redis restart should not become a reconnect storm.
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  lazyConnect: true,
};

let client: Redis | null = null;
let connecting: Promise<Redis | null> | null = null;
let available = false;
let lastFailureLogged = 0;

/**
 * Get the shared client, connecting on first use.
 *
 * Never rejects. Resolves to null when Redis is not configured or not
 * reachable, which is the signal every caller checks.
 */
export async function getRedis(): Promise<Redis | null> {
  if (!REDIS_URL) {
    return null;
  }

  if (client && available) {
    return client;
  }

  // Coalesce concurrent first-callers onto one connection attempt. Without
  // this, a cold start with ten requests in flight opens ten clients.
  if (!connecting) {
    connecting = (async () => {
      try {
        if (!client) {
          client = new Redis(REDIS_URL, BASE_OPTIONS);
          attachHandlers(client);
        }

        await client.connect();
        available = true;
        return client;
      } catch (error) {
        available = false;
        // Throttled: a down Redis produces an error every retryStrategy tick,
        // and one log line per retry buries everything else.
        const now = Date.now();
        if (now - lastFailureLogged > 60_000) {
          lastFailureLogged = now;
          logger.warn(
            `[Redis] unavailable, continuing without cache: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        return null;
      } finally {
        connecting = null;
      }
    })();
  }

  return connecting;
}

function attachHandlers(instance: Redis): void {
  instance.on('error', (err: Error) => {
    available = false;
    const now = Date.now();
    if (now - lastFailureLogged > 60_000) {
      lastFailureLogged = now;
      logger.warn(`[Redis] connection error: ${err.message}`);
    }
  });

  instance.on('ready', () => {
    available = true;
    logger.info('[Redis] connected');
  });

  // A 'ready' after a drop is the only place `available` can truthfully go back
  // to true, since getRedis() short-circuits on it.
  instance.on('end', () => {
    available = false;
  });
}

/**
 * Whether Redis answered most recently. Callers that have already awaited
 * `getRedis()` should branch on its result rather than this, since this is a
 * snapshot that can be stale by the next line.
 */
export function isRedisAvailable(): boolean {
  return available;
}

export function isRedisConfigured(): boolean {
  return REDIS_URL !== '';
}

/**
 * Read and JSON-parse a key. Returns null on a miss, on malformed JSON, and on
 * any connection problem -- all three mean the same thing to a cache: we do not
 * have it, so compute it.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    // Malformed JSON is a real bug worth surfacing; a connection error is not.
    if (error instanceof SyntaxError) {
      logger.warn(`[Redis] corrupt value at ${key}: ${error.message}`);
    }
    return null;
  }
}

/**
 * Write a key with a TTL. Failures are swallowed: a cache that cannot be
 * written must not fail the request that produced the value.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    logger.warn(`[Redis] failed to cache ${key}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Drop keys. Called when a score is recomputed, so that the next read cannot
 * serve a stale value for up to the TTL. Non-fatal.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const redis = await getRedis();
  if (!redis) return;

  try {
    await redis.del(...keys);
  } catch (error) {
    logger.warn(`[Redis] failed to invalidate ${keys.join(',')}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Close the connection. Used by tests and by a graceful worker shutdown;
 * without it a ts-node process holding an open socket never exits.
 */
export async function closeRedis(): Promise<void> {
  if (!client) return;
  const instance = client;
  client = null;
  available = false;
  connecting = null;
  try {
    await instance.quit();
  } catch {
    instance.disconnect();
  }
}