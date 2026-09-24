declare class CacheService {
    private networkCache;
    constructor();
    get(hash: string): any;
    set(hash: string, data: any): void;
    invalidate(hash: string): void;
}
export declare const cacheService: CacheService;
export {};
//# sourceMappingURL=cache.service.d.ts.map