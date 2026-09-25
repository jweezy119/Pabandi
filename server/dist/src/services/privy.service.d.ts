/**
 * privy.service.ts — Server-side Privy integration
 *
 * Handles:
 * - Organization wallet creation via Privy API
 * - Webhook signature verification
 * - Gas sponsorship requests
 * - Wallet balance lookup
 */
export interface PrivyWallet {
    id: string;
    address: string;
    chain: string;
    status: 'active' | 'creating' | 'failed';
    organizationId?: string;
    createdAt: string;
}
export interface CreateOrgWalletPayload {
    organizationId: string;
    organizationName: string;
    chain?: string;
}
/**
 * Create an organization wallet via Privy API.
 * Returns the wallet address and Privy wallet ID.
 */
export declare function createOrgWallet(payload: CreateOrgWalletPayload): Promise<PrivyWallet>;
/**
 * Verify a Privy webhook signature.
 * Returns true if the webhook is authentic.
 */
export declare function verifyPrivyWebhook(body: Buffer, signature: string, timestamp: string): Promise<boolean>;
/**
 * Sponsor gas for a wallet via Privy API.
 */
export declare function sponsorGas(walletAddress: string, chain?: string): Promise<{
    success: boolean;
    txHash?: string;
}>;
/**
 * Get wallet balance via Privy API.
 */
export declare function getWalletBalance(walletAddress: string, chain?: string): Promise<{
    balance: string;
    unit: string;
}>;
//# sourceMappingURL=privy.service.d.ts.map