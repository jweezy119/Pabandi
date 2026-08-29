"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BNPLService = void 0;
const database_1 = require("../utils/database");
const generative_ai_1 = require("@google/generative-ai");
const vc_service_1 = require("./vc.service");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
const vcService = new vc_service_1.VCService();
class BNPLService {
    async evaluateEligibility(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user)
            throw new Error('User not found');
        if (user.trustScore <= 90) {
            throw new Error('Trust score too low for BNPL. Minimum 91 required.');
        }
        // Check active W3C VC status
        const vcRecord = await database_1.prisma.verifiableCredential.findFirst({
            where: { userId },
            orderBy: { issuedAt: 'desc' }
        });
        if (!vcRecord || vcRecord.isRevoked) {
            throw new Error('User does not possess a valid, unrevoked Trust VC.');
        }
        return { eligible: true, trustScore: user.trustScore };
    }
    async calculateDynamicTerms(userId, principalUsdc) {
        const { trustScore } = await this.evaluateEligibility(userId);
        let flatFeeUsdc = principalUsdc * 0.05; // 5% default
        let collateralPab = principalUsdc * 0.10; // 10% default
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const prompt = `You are a DeFi risk engine. A user with a trust score of ${trustScore} (max 100) wants to borrow ${principalUsdc} USDC. 
      Respond with exactly two numbers separated by a comma: the flat fee in USDC to charge to guarantee platform profitability based on risk, and the minimum PAB collateral required (must be > 0 to ensure skin in the game). Keep the fee between 1% and 10% and collateral between 5% and 25%.`;
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            const parts = text.split(',');
            if (parts.length >= 2) {
                flatFeeUsdc = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
                collateralPab = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
            }
        }
        catch (error) {
            console.warn('AI Term calculation failed, falling back to defaults:', error);
        }
        return {
            principalUsdc,
            flatFeeUsdc: Number(flatFeeUsdc.toFixed(2)),
            collateralPab: Number(collateralPab.toFixed(2)),
            totalRepayment: Number((principalUsdc + flatFeeUsdc).toFixed(2))
        };
    }
    async issueBNPL(userId, principalUsdc, reservationId) {
        const terms = await this.calculateDynamicTerms(userId, principalUsdc);
        // In a real implementation, we would verify the user has locked `terms.collateralPab` 
        // in the Solana escrow contract via a txHash verification step here.
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 14-day BNPL term
        const loan = await database_1.prisma.loan.create({
            data: {
                userId,
                loanType: 'REPUTATION_BNPL',
                principalUsdc: terms.principalUsdc,
                collateralPab: terms.collateralPab,
                flatFeeUsdc: terms.flatFeeUsdc,
                status: 'ACTIVE',
                dueDate,
                reservationId,
            }
        });
        // Automatically mark the reservation as paid/confirmed via the BNPL protocol treasury
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: {
                status: 'CONFIRMED',
                depositPaid: true
            }
        });
        return loan;
    }
}
exports.BNPLService = BNPLService;
//# sourceMappingURL=bnpl.service.js.map