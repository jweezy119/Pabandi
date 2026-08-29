export interface TrapResult {
    tacticDetected: string;
    muleWalletsExtracted: string[];
    dropDomainsExtracted: string[];
    confidenceScore: number;
}
/**
 * ShadowEscrowService (Active Defense)
 *
 * Instead of banning sophisticated scammers immediately—which causes them to
 * mutate and return—Pabandi quietly routes them into a "Shadow Escrow".
 *
 * The system simulates a successful transaction environment while an AI Agent
 * poses as the counterparty to map out the scammer's entire network
 * (mule accounts, backup domains, drop addresses) before confiscating the funds
 * and broadcasting the intelligence to the MCP network.
 *
 * NOTE: This service is currently a stub — the Escrow model does not exist in
 * the Prisma schema yet. When the model is added, restore the implementation.
 */
export declare class ShadowEscrowService {
    deployHoneypot(sellerId: string, buyerId: string, amount: number, osintRiskScore: number): Promise<{
        id: string;
    } | null>;
    analyzeAdversaryBehavior(escrowId: string, scammerPayload: any): Promise<TrapResult>;
    springTrap(escrowId: string, trapResult: TrapResult): Promise<{
        success: boolean;
        message: string;
        trapResult: TrapResult;
    }>;
    private extractCryptoAddresses;
    private extractDomains;
}
export declare const shadowEscrowService: ShadowEscrowService;
//# sourceMappingURL=shadowEscrow.service.d.ts.map