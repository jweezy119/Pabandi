declare class BloomFilterService {
    private currentFilter;
    private serializedFilter;
    constructor();
    private generateFilter;
    /**
     * Returns the serialized JSON of the Bloom filter so the browser SDK can download it.
     */
    getSerializedFilter(): any;
}
export declare const bloomFilterService: BloomFilterService;
export {};
//# sourceMappingURL=bloomFilter.service.d.ts.map