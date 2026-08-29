"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralService = void 0;
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
const prisma = new client_1.PrismaClient();
class ReferralService {
    /**
     * Processes the first booking bounty for a referred business or customer.
     */
    async processFirstBookingBounty(reservationId) {
        const reservation = await prisma.reservation.findUnique({
            where: { id: reservationId },
            include: { business: true, customer: true }
        });
        if (!reservation || reservation.status !== 'COMPLETED')
            return;
        // Check Business Bounty
        const business = reservation.business;
        if (business.referredById && !business.bountyPaid) {
            await this.payBounty(business.referredById, business.id);
            await prisma.business.update({
                where: { id: business.id },
                data: { bountyPaid: true }
            });
        }
        // Check Customer Bounty
        const customer = reservation.customer;
        if (customer.referredById && !customer.bountyPaid) {
            const profile = await prisma.accountManagerProfile.findUnique({
                where: { userId: customer.referredById }
            });
            if (profile) {
                await this.payBounty(profile.id, null);
                await prisma.user.update({
                    where: { id: customer.id },
                    data: { bountyPaid: true }
                });
            }
        }
    }
    async payBounty(profileId, businessId) {
        const profile = await prisma.accountManagerProfile.findUnique({
            where: { id: profileId },
            include: { user: { include: { wallet: true } } }
        });
        if (!profile || profile.status !== 'ACTIVE')
            return;
        const config = await this.getConfig();
        if (!config || !config.active)
            return;
        await prisma.$transaction(async (tx) => {
            // Create ledger entry
            await tx.referralLedger.create({
                data: {
                    profileId: profile.id,
                    type: client_1.LedgerEntryType.SIGNUP_BOUNTY,
                    amount: 5.0, // Fixed 5 PAB
                    currency: 'PAB',
                    businessId: businessId || null,
                }
            });
            // Credit wallet
            if (profile.user.wallet) {
                await tx.wallet.update({
                    where: { id: profile.user.wallet.id },
                    data: { balance: { increment: 5.0 } }
                });
            }
        });
    }
    /**
     * Calculates and accrues a commission when a booking reaches terminal completed state.
     */
    async calculateBookingCommission(reservationId) {
        const reservation = await prisma.reservation.findUnique({
            where: { id: reservationId },
            include: {
                business: true,
                customer: true,
                payments: true
            }
        });
        if (!reservation)
            return;
        // Check Qualification
        if (reservation.status !== client_1.ReservationStatus.COMPLETED)
            return;
        if (reservation.depositRequired && reservation.depositStatus !== client_1.DepositStatus.PAID && reservation.depositStatus !== client_1.DepositStatus.APPLIED_TO_SERVICE)
            return;
        // Check Fraud / Flags (simplified for this MVP - assuming if it's COMPLETED, it's generally safe, but we'd check flags here)
        const hasFraud = await prisma.dispute.findFirst({
            where: { reservationId: reservation.id, type: 'FRAUD' }
        });
        if (hasFraud)
            return;
        // Resolve Account Manager (Prefer Business Referral, then Customer Referral)
        let profileId = null;
        let targetEntityDate = null;
        if (reservation.business.referredById) {
            profileId = reservation.business.referredById;
            targetEntityDate = reservation.business.createdAt;
        }
        else if (reservation.customer.referredById) {
            // Assuming customer.referredById is the User(id), so we need to find the profile
            const customerProfile = await prisma.accountManagerProfile.findUnique({
                where: { userId: reservation.customer.referredById }
            });
            if (customerProfile && customerProfile.status === 'ACTIVE') {
                profileId = customerProfile.id;
                targetEntityDate = reservation.customer.createdAt;
            }
        }
        if (!profileId)
            return;
        const profile = await prisma.accountManagerProfile.findUnique({
            where: { id: profileId }
        });
        if (!profile || profile.status !== 'ACTIVE')
            return;
        const config = await this.getConfig();
        if (!config || !config.active)
            return;
        // Check if ledger already exists for this reservation to avoid double counting
        const existingLedger = await prisma.referralLedger.findUnique({
            where: { reservationId: reservation.id }
        });
        if (existingLedger)
            return;
        // Calculate Platform Fee Basis
        const completedPayments = reservation.payments.filter(p => p.status === 'COMPLETED' && !p.refunded);
        const platformFeeBasis = completedPayments.reduce((sum, p) => sum + (p.platformFeeAmount || 0), 0);
        if (platformFeeBasis <= 0)
            return;
        // Determine Decay Rate
        const ageInMonths = (0, date_fns_1.differenceInMonths)(new Date(), targetEntityDate);
        let rate = 0;
        if (ageInMonths < 12)
            rate = config.rateYear1;
        else if (ageInMonths < 24)
            rate = config.rateYear2;
        else
            rate = config.rateYear3Plus;
        let proposedAmount = platformFeeBasis * rate;
        // Cap Enforcement
        const now = new Date();
        const currentMonthStart = (0, date_fns_1.startOfMonth)(now);
        const currentMonthEnd = (0, date_fns_1.endOfMonth)(now);
        // Get month-to-date global earnings for ALL partners
        const mtdGlobal = await prisma.referralLedger.aggregate({
            _sum: { amount: true },
            where: {
                createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
                isReversed: false
            }
        });
        const currentGlobalSum = mtdGlobal._sum.amount || 0;
        if (currentGlobalSum >= config.globalMonthlyCap)
            return; // Global cap reached
        if (currentGlobalSum + proposedAmount > config.globalMonthlyCap) {
            proposedAmount = config.globalMonthlyCap - currentGlobalSum;
        }
        // Get month-to-date merchant-specific earnings for THIS partner
        const mtdMerchant = await prisma.referralLedger.aggregate({
            _sum: { amount: true },
            where: {
                profileId: profile.id,
                businessId: reservation.businessId,
                createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
                isReversed: false
            }
        });
        const currentMerchantSum = mtdMerchant._sum.amount || 0;
        if (currentMerchantSum >= config.merchantMonthlyCap)
            return; // Merchant cap reached
        if (currentMerchantSum + proposedAmount > config.merchantMonthlyCap) {
            proposedAmount = config.merchantMonthlyCap - currentMerchantSum;
        }
        if (proposedAmount <= 0)
            return;
        // Write Ledger
        await prisma.referralLedger.create({
            data: {
                profileId: profile.id,
                type: client_1.LedgerEntryType.BOOKING_COMMISSION,
                amount: proposedAmount,
                businessId: reservation.businessId,
                reservationId: reservation.id,
                platformFeeBasis,
                commissionRate: rate
            }
        });
    }
    async getConfig() {
        let config = await prisma.partnerProgramConfig.findFirst();
        if (!config) {
            // Create default config if missing
            config = await prisma.partnerProgramConfig.create({
                data: {}
            });
        }
        return config;
    }
}
exports.ReferralService = ReferralService;
//# sourceMappingURL=referral.service.js.map