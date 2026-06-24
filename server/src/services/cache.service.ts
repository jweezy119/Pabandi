import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';

class CacheService {
  private networkCache: LRUCache<string, any>;

  constructor() {
    // Cache up to 10,000 recently checked hashes for 1 hour
    this.networkCache = new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  public get(hash: string): any {
    return this.networkCache.get(hash);
  }

  public set(hash: string, data: any): void {
    this.networkCache.set(hash, data);
  }

  public invalidate(hash: string): void {
    this.networkCache.delete(hash);
  }
}

export const cacheService = new CacheService();
