export declare class BNPLService {
    evaluateEligibility(userId: string): Promise<{
        eligible: boolean;
        trustScore: number;
    }>;
    calculateDynamicTerms(userId: string, principalUsdc: number): Promise<{
        principalUsdc: number;
        flatFeeUsdc: number;
        collateralPab: number;
        totalRepayment: number;
    }>;
    issueBNPL(userId: string, principalUsdc: number, reservationId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.LoanStatus;
        txHash: string | null;
        reservationId: string | null;
        feePct: number;
        principalUsdc: number;
        collateralPab: number;
        flatFeeUsdc: number;
        loanType: string;
        band: string | null;
        reputationCapUsdc: number;
        dueDate: Date;
    }>;
}
//# sourceMappingURL=bnpl.service.d.ts.map