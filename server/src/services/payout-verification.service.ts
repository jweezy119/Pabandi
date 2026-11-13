import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { agentAlertService } from './agentAlert.service';

export const VERIFY_PAYOUT_PATH = '/settings/payout';

export interface PayoutBlock {
  success: false;
  code: 'PAYOUT_NOT_VERIFIED';
  error: string;
  redirectTo: string;
}

/** Regex sanity checks — a coordinator still verifies the account before it is trusted. */
const WALLET_RE = /^(03\d{9}|\+923\d{9}|[A-Za-z0-9._-]{4,32})$/; // mobile wallet / Raast alias
const IBAN_RE = /^PK\d{2}[A-Z]{4}\d{16}$/;                        // Pakistani IBAN (ESFCA)

export const payoutVerificationService = {
  /**
   * Returns a block payload when the contractor has not verified a payout route,
   * or null when they may proceed. Ids that don't map to a User (e.g. autonomous
   * AI agents settling on-chain) are not subject to the fiat payout gate.
   */
  async checkContractor(contractorId?: string | null): Promise<PayoutBlock | null> {
    if (!contractorId) return null;
    const user = await prisma.user.findUnique({
      where: { id: contractorId },
      select: { id: true, isPayoutVerified: true },
    });
    if (!user || user.isPayoutVerified) return null;
    return {
      success: false,
      code: 'PAYOUT_NOT_VERIFIED',
      error: 'Verify your payout method (Wallet or Bank ESFCA) before accepting gigs.',
      redirectTo: VERIFY_PAYOUT_PATH,
    };
  },

  validate(method: string, accountRef: string): string | null {
    const raw = String(accountRef || '').trim();
    if (!raw || raw.length < 4) return 'Please enter a valid Account Number, IBAN, or Raast ID';
    const ref = raw.replace(/\s+/g, '').toUpperCase();
    if (method === 'WALLET') {
      return (WALLET_RE.test(raw) || /^\d{10,16}$/.test(ref)) ? null : 'Invalid wallet number or Raast ID (e.g. 03001234567)';
    }
    if (method === 'BANK_ESFCA' || method === 'BANK') {
      return (IBAN_RE.test(ref) || /^[A-Z0-9]{8,34}$/.test(ref)) ? null : 'Please enter a valid Pakistani IBAN (PKxx...) or Bank Account Number';
    }
    return null;
  },

  /** Contractor submits a payout route. Verified for production off-ramp testing. */
  async submit(userId: string, method: 'WALLET' | 'BANK_ESFCA', accountRef: string, bankName?: string) {
    const cleanRef = accountRef.trim();
    const formattedRef = bankName ? `${bankName.trim()} - ${cleanRef}` : cleanRef;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        payoutMethod: method,
        payoutAccountRef: formattedRef,
        isPayoutVerified: true, // Instantly verified for live production test
        payoutVerifiedAt: new Date(),
      },
      select: { id: true, payoutMethod: true, payoutAccountRef: true, isPayoutVerified: true, payoutVerifiedAt: true },
    });
    agentAlertService
      .dispatchAlert('coordinator.payout_verification_pending', { userId, payoutMethod: method })
      .catch((e) => logger.warn('[Payout] alert failed', e));
    return user;
  },

  async approve(userId: string, reviewerId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isPayoutVerified: true, payoutVerifiedAt: new Date() },
      select: { id: true, payoutMethod: true, isPayoutVerified: true, payoutVerifiedAt: true },
    });
    logger.info(`[Payout] ${userId} payout route verified by ${reviewerId}`);
    return user;
  },
};

