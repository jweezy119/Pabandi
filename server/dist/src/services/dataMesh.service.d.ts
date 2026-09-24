export declare class DataMesh {
    private keys;
    private initialized;
    /** Load API keys from env (comma-separated) + any DB-registered institutional keys. */
    private init;
    /** Pick the healthiest available key (not in cooldown, fewest failures). */
    private pickKey;
    private cacheKey;
    queryCivilLitigation(name: string, state?: string): Promise<any>;
    getKeyHealth(): {
        cooldownUntil: number;
        failures: number;
    }[];
}
export declare const dataMesh: DataMesh;
//# sourceMappingURL=dataMesh.service.d.ts.map