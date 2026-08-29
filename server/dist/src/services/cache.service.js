"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const lru_cache_1 = require("lru-cache");
class CacheService {
    constructor() {
        // Cache up to 10,000 recently checked hashes for 1 hour
        this.networkCache = new lru_cache_1.LRUCache({
            max: 10000,
            ttl: 1000 * 60 * 60, // 1 hour
        });
    }
    get(hash) {
        return this.networkCache.get(hash);
    }
    set(hash, data) {
        this.networkCache.set(hash, data);
    }
    invalidate(hash) {
        this.networkCache.delete(hash);
    }
}
exports.cacheService = new CacheService();
//# sourceMappingURL=cache.service.js.map