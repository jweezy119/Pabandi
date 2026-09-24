"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const blockchain_service_1 = require("./blockchain.service");
const prisma = new client_1.PrismaClient();
class LoanService {
    constructor() {
        // PAB to USDC conversion rate for collateral calculations (Simulated)
        this.PAB_USD_PRICE = 0.10;
    }
    /**
     * Calculate maximum borrowing power in USDC based on Trust Score and PAB balance.
     */
    async calculateBorrowingPower(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true }
        });
        if (!user || !user.wallet) {
            throw new Error('User or wallet not found');
        }
        const availablePab = user.wallet.balance;
        const usdValueOfPab = availablePab * this.PAB_USD_PRICE;
        let ltvRatio = 0; // Loan-to-Value
        // Halal / Sharia Compliant logic: Higher trust gets better LTV (more borrowing power per collateral)
        if (user.trustScore >= 90) {
            ltvRatio = 0.8; // 80% LTV
        }
        else if (user.trustScore >= 70) {
            ltvRatio = 0.6; // 60% LTV
        }
        else if (user.trustScore >= 50) {
            ltvRatio = 0.4; // 40% LTV
        }
        else {
            ltvRatio = 0; // Not eligible for loans if trust is too low
        }
        const maxUsdcBorrow = usdValueOfPab * ltvRatio;
        return {
            availablePab,
            usdValueOfPab,
            trustScore: user.trustScore,
            ltvRatio,
            maxUsdcBorrow,
        };
    }
    /**
     * Request a flat-fee loan backed by PAB
     */
    async requestLoan(userId, usdcAmount) {
        if (usdcAmount <= 0)
            throw new Error('Invalid loan amount');
        const power = await this.calculateBorrowingPower(userId);
        if (power.ltvRatio === 0) {
            throw new Error('Trust score too low to qualify for a collateralized loan.');
        }
        if (usdcAmount > power.maxUsdcBorrow) {
            throw new Error(`Requested amount exceeds max borrowing power of $${power.maxUsdcBorrow.toFixed(2)} USDC`);
        }
        // Determine collateral needed based on the fixed LTV ratio
        const collateralNeeded = (usdcAmount / power.ltvRatio) / this.PAB_USD_PRICE;
        if (power.availablePab < collateralNeeded) {
            throw new Error('Insufficient PAB balance for collateral');
        }
        // Flat Fee logic (Sharia compliant, no compounding interest)
        // 5% flat fee for processing the loan
        const flatFeeUsdc = usdcAmount * 0.05;
        // Execute in a transaction: Lock PAB, mint/transfer USDC to user, create loan record
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update wallet
            const wallet = await tx.wallet.update({
                where: { userId },
                data: {
                    balance: { decrement: collateralNeeded },
                    lockedPab: { increment: collateralNeeded },
                    usdcBalance: { increment: usdcAmount }
                }
            });
            // 2. Create Loan
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30); // 30 day loan term
            const loan = await tx.loan.create({
                data: {
                    userId,
                    principalUsdc: usdcAmount,
                    collateralPab: collateralNeeded,
                    flatFeeUsdc,
                    dueDate,
                    status: client_1.LoanStatus.ACTIVE
                }
            });
            return { wallet, loan };
        });
        // 3. Mock On-Chain Execution (Log Attestation)
        const attestation = await blockchain_service_1.blockchainService.logTrustAttestationOnSolana(userId, result.loan.id, 'COMPLETED_BOOKING', {
            event: 'LOAN_ISSUED',
            usdcAmount,
            collateralPab: collateralNeeded
        });
        if (attestation.txHash) {
            await prisma.loan.update({
                where: { id: result.loan.id },
                data: { txHash: attestation.txHash }
            });
        }
        logger_1.logger.info(`[DeFi] Loan issued to ${userId}. Amount: $${usdcAmount} USDC. Collateral Locked: ${collateralNeeded} PAB.`);
        return result.loan;
    }
    /**
     * Quote a REPUTATION-backed (collateral-FREE) loan priced off the Trust Passport band.
     * No PAB lock required — credit is extended on verified trust + deal history.
     * Sharia-compliant: a flat processing fee (no compounding interest).
     */
    async quoteReputationLoan(userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        // Resolve the REAL Trust Passport band, if the user has a linked profile.
        // Chain: User.walletAddress -> LinkedInProfile.walletAddress -> trustBand
        let band = null;
        if (user.walletAddress) {
            const profile = await prisma.linkedInProfile.findFirst({ where: { walletAddress: user.walletAddress } });
            if (profile?.trustBand)
                band = profile.trustBand;
        }
        // Fallback: derive a passport-style band from the legacy trust score (0-100)
        if (!band) {
            const ts = user.trustScore || 50;
            band = ts >= 90 ? 'A' : ts >= 70 ? 'B' : ts >= 50 ? 'C' : ts >= 30 ? 'D' : 'E';
        }
        const BAND_TABLE = {
            A: { feePct: 8, capUsdc: 5000, eligible: true },
            B: { feePct: 10, capUsdc: 3000, eligible: true },
            C: { feePct: 12, capUsdc: 1500, eligible: true },
            D: { feePct: 15, capUsdc: 500, eligible: true },
            E: { feePct: 0, capUsdc: 0, eligible: false },
        };
        const t = BAND_TABLE[band] || BAND_TABLE.D;
        return {
            band,
            source: user.walletAddress ? 'PASSPORT' : 'TRUSTSCORE',
            trustScore: user.trustScore,
            eligible: t.eligible,
            feePct: t.feePct,
            maxBorrowUsdc: t.eligible ? t.capUsdc : 0,
            loanType: 'REPUTATION',
            note: t.eligible ? 'Priced on your Trust Passport band. No collateral locked.' : 'Build trust to qualify.',
        };
    }
    async requestReputationLoan(userId, usdcAmount) {
        if (usdcAmount <= 0)
            throw new Error('Invalid loan amount');
        const quote = await this.quoteReputationLoan(userId);
        if (!quote.eligible)
            throw new Error('Not eligible for reputation credit (band E).');
        if (usdcAmount > quote.maxBorrowUsdc)
            throw new Error(`Exceeds reputation cap of $${quote.maxBorrowUsdc}.`);
        const flatFeeUsdc = +(usdcAmount * (quote.feePct / 100)).toFixed(2);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        // No collateral lock. Credit the USDC to the user wallet directly.
        const loan = await prisma.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { userId },
                data: { usdcBalance: { increment: usdcAmount } },
            });
            return tx.loan.create({
                data: {
                    userId,
                    principalUsdc: usdcAmount,
                    collateralPab: 0,
                    flatFeeUsdc,
                    loanType: 'REPUTATION',
                    band: quote.band,
                    reputationCapUsdc: quote.maxBorrowUsdc,
                    feePct: quote.feePct,
                    dueDate,
                    status: client_1.LoanStatus.ACTIVE,
                },
            });
        });
        logger_1.logger.info(`[ReputationLoan] Issued $${usdcAmount} USDC to ${userId} (band ${quote.band}, fee ${quote.feePct}%). No collateral locked.`);
        return loan;
    }
    /**
     * Repay the loan + flat fee to unlock PAB
     */
    async repayLoan(userId, loanId) {
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        if (!loan)
            throw new Error('Loan not found');
        if (loan.userId !== userId)
            throw new Error('Unauthorized');
        if (loan.status !== client_1.LoanStatus.ACTIVE)
            throw new Error('Loan is not active');
        const totalDue = loan.principalUsdc + loan.flatFeeUsdc;
        const userWallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!userWallet || userWallet.usdcBalance < totalDue) {
            throw new Error(`Insufficient USDC balance to repay loan. Need $${totalDue}`);
        }
        await prisma.$transaction(async (tx) => {
            // 1. Deduct USDC, unlock PAB
            await tx.wallet.update({
                where: { userId },
                data: {
                    usdcBalance: { decrement: totalDue },
                    lockedPab: { decrement: loan.collateralPab },
                    balance: { increment: loan.collateralPab }
                }
            });
            // 2. Mark Loan as REPAID
            await tx.loan.update({
                where: { id: loanId },
                data: { status: client_1.LoanStatus.REPAID }
            });
        });
        logger_1.logger.info(`[DeFi] Loan ${loanId} repaid by ${userId}. Unlocked ${loan.collateralPab} PAB.`);
        return { success: true, message: 'Loan repaid successfully' };
    }
}
exports.LoanService = LoanService;
//# sourceMappingURL=loan.service.js.map