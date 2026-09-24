export declare class AutoApprovalService {
    private connection;
    private platformKeypair;
    constructor();
    private getConnection;
    private loadPlatformKey;
    isEnabled(): boolean;
    getPlatformAddress(): string;
    getUsdcBalance(walletAddress?: string): Promise<number>;
    autoTransfer(params: {
        toWallet: string;
        amountUsdc: number;
        referenceId?: string;
    }): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    getFullBalance(): Promise<{
        usdc: number;
        sol: number;
    }>;
}
export declare const autoApproval: AutoApprovalService;
//# sourceMappingURL=autoApproval.service.d.ts.map