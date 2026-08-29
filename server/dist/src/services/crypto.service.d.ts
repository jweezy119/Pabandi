declare class CryptoService {
    private currentSalt;
    private saltDate;
    constructor();
    private generateSalt;
    private checkRotation;
    getPublicSalt(): string;
    /**
     * Used by backend processes (like webhooks) to hash raw PII
     * using the current active salt, matching the SDK's behavior.
     */
    hmacHash(data: string): string;
}
export declare const cryptoService: CryptoService;
export {};
//# sourceMappingURL=crypto.service.d.ts.map