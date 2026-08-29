export declare function stakeAgent(agentId: string, amountPab: number): Promise<{
    ok: boolean;
    error?: string;
}>;
export interface SlashResult {
    ok: boolean;
    slashedPab: number;
    toClientPab: number;
    burnedPab: number;
    error?: string;
}
/**
 * Slash an agent on milestone failure. Splits the penalty: 60% burned (supply sink →
 * supports PAB value), 40% compensated to the client. Both recorded on-chain + ledger.
 */
export declare function slashAgent(agentId: string, penaltyPct?: number): Promise<SlashResult>;
export declare function _internal(): {
    BURN_ADDRESS: string;
    STAKE_VAULT: string;
    STAKE_REQUIRED_PAB: number;
};
//# sourceMappingURL=stakeSlashing.service.d.ts.map