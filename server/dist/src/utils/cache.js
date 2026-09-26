/**
 * Lightweight in-memory TTL cache
 * Used to protect the database from being overwhelmed by global API crawlers (e.g. LLMs).
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "globalCache", {
    enumerable: true,
    get: function() {
        return globalCache;
    }
});
let InMemoryCache = class InMemoryCache {
    cache = new Map();
    /**
   * Set a value in the cache with a Time-To-Live
   * @param key Cache key
   * @param value The value to cache
   * @param ttlSeconds Time to live in seconds
   */ set(key, value, ttlSeconds) {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, {
            value,
            expiry
        });
    }
    /**
   * Retrieve a value from the cache if it hasn't expired
   */ get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }
    /**
   * Remove a value from the cache
   */ delete(key) {
        this.cache.delete(key);
    }
    /**
   * Clear all entries (mostly used for testing or emergency flushes)
   */ clear() {
        this.cache.clear();
    }
};
const globalCache = new InMemoryCache();

//# sourceMappingURL=cache.js.map