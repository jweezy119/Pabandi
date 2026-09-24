export declare class PabTokenService {
    private connection;
    private platformKeypair;
    constructor();
    createToken(): Promise<{
        mint: string;
        txHash: string;
    }>;
    getPlatformAddress(): string;
}
export declare const pabToken: PabTokenService;
//# sourceMappingURL=pabToken.service.d.ts.map