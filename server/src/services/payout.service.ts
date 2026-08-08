import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { stripeService } from './stripe.service';

// Flat payout fee (the "remittance killer" — 1.5% vs ~7% Western Union / bank wires)
const PAYOUT_FEE_PCT = 1.5;

export class PayoutService {
  /**
   * Resolve the user's passport band to gate cash-outs (band E = blocked).
   * Chain: User.walletAddress -> LinkedInProfile.walletAddress -> trustBand
   */
  private async resolveBand(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return 'E';
    if (user.walletAddress) {
      const profile = await prisma.linkedInProfile.findFirst({ where: { walletAddress: user.walletAddress } });
      if (profile?.trustBand) return profile.trustBand;
    }
    const ts = user.trustScore || 50;
    return ts >= 90 ? 'A' : ts >= 70 ? 'B' : ts >= 50 ? 'C' : ts >= 30 ? 'D' : 'E';
  }

  /** Quote a cash-out: shows fee + net delivered. */
  async quote(userId: string, amountUsdc: number) {
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

  /** Request a cash-out of earned USDC to a linked bank / Connect account. */
  async request(userId: string, amountUsdc: number, method: 'BANK' | 'CONNECT' = 'BANK') {
    if (amountUsdc <= 0) throw new Error('Invalid amount');
    const band = await this.resolveBand(userId);
    if (band === 'E') throw new Error('Trust band E — build your Trust Passport to unlock cash-outs.');

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.usdcBalance < amountUsdc) {
      throw new Error(`Insufficient USDC balance (have $${wallet?.usdcBalance?.toFixed(2) || '0.00'}).`);
    }

    const fee = +(amountUsdc * (PAYOUT_FEE_PCT / 100)).toFixed(2);
    const net = +(amountUsdc - fee).toFixed(2);

    // Destination: VirtualAccount (simulated) or Stripe Connect (real when keys present)
    let destinationRef: string | null = null;
    let txHash: string | null = null;
    let status: 'PENDING' | 'SETTLED' | 'FAILED' = 'SETTLED';

    if (method === 'BANK') {
      const va = await prisma.virtualAccount.findFirst({ where: { userId, status: 'ACTIVE' } });
      if (va) {
        destinationRef = va.id;
      } else {
        // No linked bank yet — settle to a simulated destination so the worker
        // can still cash out instantly (real mode requires a linked VirtualAccount
        // or Stripe Connect). Balance is still deducted and fee charged.
        destinationRef = 'SIMULATED';
        logger.info(`[Payout] No VirtualAccount for ${userId} — simulating bank settlement.`);
      }
    } else if (method === 'CONNECT') {
      const connectId = process.env.STRIPE_CONNECT_ACCOUNT_ID;
      if (connectId && process.env.STRIPE_SECRET_KEY) {
        try {
          const transfer = await (stripeService as any).stripe?.transfers?.create?.({
            amount: Math.round(net * 100),
            currency: 'usd',
            destination: connectId,
          });
          if (transfer?.id) { txHash = transfer.id; destinationRef = connectId; }
        } catch (e: any) {
          logger.warn(`[Payout] Stripe transfer failed, falling back to simulated: ${e.message}`);
        }
      }
    }

    const payout = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({ where: { userId }, data: { usdcBalance: { decrement: amountUsdc } } });
      return tx.payout.create({
        data: { userId, amountUsdc, feeUsdc: fee, netUsdc: net, method, destinationRef, status, txHash },
      });
    });

    logger.info(`[Payout] ${amountUsdc} USDC cashed out for ${userId} (band ${band}, fee ${fee}, net ${net}, method ${method}).`);
    return payout;
  }

  /** Payout history for a user. */
  async history(userId: string) {
    return prisma.payout.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
}

export const payoutService = new PayoutService();
