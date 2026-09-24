export declare class SolanaUsdcService {
    /**
     * Generate a new Solana keypair for an agent
     * Returns public key, stores encrypted secret
     */
    createAgentWallet(agentId: string): Promise<{
        publicKey: string;
        created: boolean;
    }>;
    /**
     * Get the platform wallet address (public only)
     */
    getPlatformWallet(): string;
    /**
     * Get USDC balance for any wallet address
     */
    getUsdcBalance(walletAddress: string): Promise<number>;
    /**
     * Record an on-chain USDC transfer in our treasury
     */
    recordTransfer(params: {
        fromWallet: string;
        toWallet: string;
        amountUsdc: number;
        txHash: string;
        type: 'FUNDING' | 'AGENT_PAYMENT' | 'FEE_COLLECTION' | 'REFUND';
        referenceId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: string;
        status: string;
        txHash: string;
        referenceId: string | null;
        agentId: string | null;
        amountUsdc: number;
        toWallet: string;
        fromWallet: string;
        blockTime: Date | null;
    }>;
    /**
     * Build a transfer instruction for Phantom to sign
     */
    buildTransferTransaction(params: {
        fromWallet: string;
        toWallet: string;
        amountUsdc: number;
    }): Promise<{
        transaction: string;
        message: string;
    }>;
    /**
     * Get platform wallet USDC balance (public query)
     */
    getPlatformBalance(): Promise<{
        usdc: number;
        sol: number;
    }>;
}
export declare const solanaUsdc: SolanaUsdcService;
//# sourceMappingURL=solanaUsdc.service.d.ts.map