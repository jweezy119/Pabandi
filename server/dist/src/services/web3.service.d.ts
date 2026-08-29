export declare const createReservationEscrow: (reservationId: string, options?: {
    businessAddress?: string;
    amount?: number;
    onChainTxHash?: string;
}) => Promise<{
    success: false;
    error: string;
    txHash?: undefined;
    status?: undefined;
    simulated?: undefined;
    chain?: undefined;
    explorerUrl?: undefined;
    contract?: undefined;
    reservationId?: undefined;
    explorerBase?: undefined;
} | {
    success: true;
    txHash: string;
    status: string;
    simulated: boolean;
    chain: string;
    explorerUrl: string;
    contract: string | null;
    error?: undefined;
    reservationId?: undefined;
    explorerBase?: undefined;
} | {
    success: true;
    reservationId: string;
    status: string;
    simulated: boolean;
    chain: string;
    explorerBase: string;
    contract: string | null;
    error?: undefined;
    txHash?: undefined;
    explorerUrl?: undefined;
}>;
//# sourceMappingURL=web3.service.d.ts.map