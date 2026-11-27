import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRedis } from '../src/lib/redis';

const fakeRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

vi.mock('../src/lib/redis', () => ({
  getRedis: vi.fn(),
  isRedisConfigured: vi.fn(() => true),
}));

import { RedisSessionStore, createSessionStore } from '../src/lib/redisSessionStore';

const mockedGetRedis = vi.mocked(getRedis);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetRedis.mockResolvedValue(fakeRedis as any);
});

describe('RedisSessionStore', () => {
  it('is only created when Redis is configured', () => {
    expect(createSessionStore()).toBeInstanceOf(RedisSessionStore);
  });

  it('stores sessions with a TTL derived from cookie.maxAge', async () => {
    const store = new RedisSessionStore();
    const cb = vi.fn();
    await store.set('sid1', { cookie: { maxAge: 600_000 } } as any, cb);
    expect(fakeRedis.set).toHaveBeenCalledWith(
      'pab:sess:sid1',
      expect.any(String),
      'EX',
      600,
    );
    expect(cb).toHaveBeenCalledWith();
  });

  it('reads and deletes sessions by prefix', async () => {
    const store = new RedisSessionStore();
    fakeRedis.get.mockResolvedValueOnce(JSON.stringify({ userId: 'u1' }));
    const getCb = vi.fn();
    await store.get('sid2', getCb);
    expect(fakeRedis.get).toHaveBeenCalledWith('pab:sess:sid2');
    expect(getCb).toHaveBeenCalledWith(null, { userId: 'u1' });

    const delCb = vi.fn();
    await store.destroy('sid2', delCb);
    expect(fakeRedis.del).toHaveBeenCalledWith('pab:sess:sid2');
    expect(delCb).toHaveBeenCalledWith();
  });

  it('degrades to a no-op when Redis is unavailable', async () => {
    mockedGetRedis.mockResolvedValue(null);
    const store = new RedisSessionStore();
    const getCb = vi.fn();
    const setCb = vi.fn();
    await store.get('sid3', getCb);
    await store.set('sid3', { cookie: {} } as any, setCb);
    expect(getCb).toHaveBeenCalledWith(null, undefined);
    expect(setCb).toHaveBeenCalledWith();
    expect(fakeRedis.set).not.toHaveBeenCalled();
  });

  it('treats corrupt session JSON as a cache miss', async () => {
    fakeRedis.get.mockResolvedValueOnce('{not json');
    const store = new RedisSessionStore();
    const cb = vi.fn();
    await store.get('sid4', cb);
    expect(cb).toHaveBeenCalledWith(null, undefined);
  });
});
