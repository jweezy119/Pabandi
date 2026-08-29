"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutService = exports.PayoutService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const stripe_service_1 = require("./stripe.service");
const offramp_service_1 = require("./offramp.service");
// Flat payout fee (the "remittance killer" — 1.5% vs ~7% Western Union / bank wires)
const PAYOUT_FEE_PCT = 1.5;
class PayoutService {
    /**
     * Resolve the user's passport band to gate cash-outs (band E = blocked).
     * Chain: User.walletAddress -> LinkedInProfile.walletAddress -> trustBand
     */
    async resolveBand(userId) {
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return 'E';
        if (user.walletAddress) {
            const profile = await database_1.prisma.linkedInProfile.findFirst({ where: { walletAddress: user.walletAddress } });
            if (profile?.trustBand)
                return profile.trustBand;
        }
        const ts = user.trustScore || 50;
        return ts >= 90 ? 'A' : ts >= 70 ? 'B' : ts >= 50 ? 'C' : ts >= 30 ? 'D' : 'E';
    }
    /** Quote a cash-out: shows fee + net delivered. */
    async quote(userId, amountUsdc) {
        const band = await this.resolveBand(userId);
        const eligible = band !== 'E';
        const fee = +(amountUsdc * (PAYOUT_FEE_PCT / 100)).toFixed(2);
        return {
            band,
            eligible,
            amountUsdc,
            feeUsdc: fee,
            netUsdc: +(amountUsdc - fee).toFixed(2),
            feePct: PAYOUT_FEE_PCT,
            vsRemittance: +((amountUsdc * 0.07) - fee).toFixed(2), // savings vs 7% remittance
            note: eligible ? 'Instant cash-out at 1.5% (vs ~7% remittance).' : 'Band E — build trust to unlock cash-outs.',
        };
    }
    /** Request a cash-out of earned USDC to a real off-ramp rail.
     *  method: BANK (simulated/local), CONNECT (real Stripe transfer), LOCAL (real P2P off-ramp intent to mobile wallet/bank).
     *  destinationRef / mobile optional for LOCAL (JazzCash/Easypaisa/Raast account). */
    async request(userId, amountUsdc, method = 'BANK', destinationRef) {
        if (amountUsdc <= 0)
            throw new Error('Invalid amount');
        const band = await this.resolveBand(userId);
        if (band === 'E')
            throw new Error('Trust band E — build your Trust Passport to unlock cash-outs.');
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet || wallet.usdcBalance < amountUsdc) {
            throw new Error(`Insufficient USDC balance (have $${wallet?.usdcBalance?.toFixed(2) || '0.00'}).`);
        }
        const fee = +(amountUsdc * (PAYOUT_FEE_PCT / 100)).toFixed(2);
        const net = +(amountUsdc - fee).toFixed(2);
        let destRef = null;
        let txHash = null;
        let status = 'SETTLED';
        let offrampIntentId = null;
        if (method === 'BANK') {
            const va = await database_1.prisma.virtualAccount.findFirst({ where: { userId, status: 'ACTIVE' } });
            destRef = va?.id || 'SIMULATED';
        }
        else if (method === 'CONNECT') {
            const connectId = process.env.STRIPE_CONNECT_ACCOUNT_ID;
            if (connectId && process.env.STRIPE_SECRET_KEY) {
                try {
                    const t = await stripe_service_1.stripeService.payoutToConnect(net, connectId);
                    txHash = t.id;
                    destRef = connectId;
                    status = 'SETTLED';
                    logger_1.logger.info(`[Payout] Stripe Connect transfer ${t.id} for ${userId} net $${net}.`);
                }
                catch (e) {
                    logger_1.logger.warn(`[Payout] Stripe transfer failed, simulated fallback: ${e.message}`);
                    destRef = 'SIMULATED';
                }
            }
            else {
                destRef = 'SIMULATED'; // no keys -> honest simulated settlement
            }
        }
        else if (method === 'LOCAL') {
            // REAL P2P off-ramp: create an intent to a local mobile wallet / bank (JazzCash/Easypaisa/Raast).
            // Flows through the existing LiquidityProvider settlement engine.
            try {
                const intent = await offramp_service_1.offrampService.requestIntent((wallet.address || userId), net, 280, // indicative USDC->PKR rate; LP matches live
                'JazzCash', (destinationRef || wallet.address || userId).slice(0, 64), undefined, `pabandi-payout-${userId}-${Date.now()}`);
                offrampIntentId = intent.id;
                destRef = `OFFRAMP:${intent.id}`;
                status = 'PENDING'; // settles when an LP fulfills the intent
                logger_1.logger.info(`[Payout] Off-ramp intent ${intent.id} created for ${userId} net $${net}.`);
            }
            catch (e) {
                logger_1.logger.warn(`[Payout] Off-ramp intent failed, simulated fallback: ${e.message}`);
                destRef = 'SIMULATED';
            }
        }
        const payout = await database_1.prisma.$transaction(async (tx) => {
            await tx.wallet.update({ where: { userId }, data: { usdcBalance: { decrement: amountUsdc } } });
            return tx.payout.create({
                data: { userId, amountUsdc, feeUsdc: fee, netUsdc: net, method, destinationRef: destRef, status, txHash },
            });
        });
        logger_1.logger.info(`[Payout] ${amountUsdc} USDC cashed out for ${userId} (band ${band}, fee ${fee}, net ${net}, method ${method}).`);
        return payout;
    }
    /** Payout history for a user. */
    async history(userId) {
        return database_1.prisma.payout.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    }
}
exports.PayoutService = PayoutService;
exports.payoutService = new PayoutService();
//# sourceMappingURL=payout.service.js.map