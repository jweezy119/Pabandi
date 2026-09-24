/**
 * Solana Escrow SDK — Constants
 * ─────────────────────────────────────────────
 * Shared constants for the on-chain escrow program.
 */
export declare const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export declare const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export declare const PROGRAM_ID: string;
export declare const PLATFORM_FEE_BPS = 100;
export declare const RPC_URL: string;
export declare const INSTRUCTION_DISCRIMINATORS: {
    createEscrow: Buffer<ArrayBuffer>;
    fundEscrow: Buffer<ArrayBuffer>;
    releaseFunds: Buffer<ArrayBuffer>;
    refundFunds: Buffer<ArrayBuffer>;
    raiseDispute: Buffer<ArrayBuffer>;
};
export declare const ESCROW_STATUS: {
    readonly CREATED: "CREATED";
    readonly FUNDED: "FUNDED";
    readonly RELEASED: "RELEASED";
    readonly REFUNDED: "REFUNDED";
    readonly DISPUTED: "DISPUTED";
};
export type EscrowStatusString = typeof ESCROW_STATUS[keyof typeof ESCROW_STATUS];
//# sourceMappingURL=constants.d.ts.map