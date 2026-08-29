export declare class LoanService {
    private readonly PAB_USD_PRICE;
    /**
     * Calculate maximum borrowing power in USDC based on Trust Score and PAB balance.
     */
    calculateBorrowingPower(userId: string): Promise<{
        availablePab: number;
        usdValueOfPab: number;
        trustScore: number;
        ltvRatio: number;
        maxUsdcBorrow: number;
    }>;
    /**
     * Request a flat-fee loan backed by PAB
     */
    requestLoan(userId: string, usdcAmount: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.LoanStatus;
        txHash: string | null;
        feePct: number;
        principalUsdc: number;
        collateralPab: number;
        flatFeeUsdc: number;
        loanType: string;
        band: string | null;
        reputationCapUsdc: number;
        dueDate: Date;
    }>;
    /**
     * Quote a REPUTATION-backed (collateral-FREE) loan priced off the Trust Passport band.
     * No PAB lock required — credit is extended on verified trust + deal history.
     * Sharia-compliant: a flat processing fee (no compounding interest).
     */
    quoteReputationLoan(userId: string): Promise<{
        band: string;
        source: string;
        trustScore: number;
        eligible: boolean;
        feePct: number;
        maxBorrowUsdc: number;
        loanType: string;
        note: string;
    }>;
    requestReputationLoan(userId: string, usdcAmount: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.LoanStatus;
        txHash: string | null;
        feePct: number;
        principalUsdc: number;
        collateralPab: number;
        flatFeeUsdc: number;
        loanType: string;
        band: string | null;
        reputationCapUsdc: number;
        dueDate: Date;
    }>;
    /**
     * Repay the loan + flat fee to unlock PAB
     */
    repayLoan(userId: string, loanId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=loan.service.d.ts.map