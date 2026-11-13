import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiPaymentVerifierService } from '../ai.payment.verifier.service';
import { offrampService } from '../offramp.service';
import { prisma } from '../../utils/database';

describe('Hardened AI Receipt Verification & LP Off-Ramp State Machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. AI Receipt Verification & Deduplication', () => {
    it('verifies a valid Raast receipt with amount, receiverId, timestamp, and transactionRef', async () => {
      const validReceiptPayload = JSON.stringify({
        amount: 140000,
        receiverId: '03001234567',
        bank: 'Meezan Bank',
        currency: 'PKR',
        timestamp: '2026-11-13T10:00:00Z',
        transactionRef: `RRN_TEST_${Date.now()}_A`,
        isBlurryOrUnreadable: false,
      });

      // Mock database calls
      vi.spyOn(prisma.paymentReceipt, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.paymentReceipt, 'create').mockResolvedValue({
        id: 'rcpt_1',
        transactionRef: 'RRN_TEST_A',
        amount: 140000,
        receiverId: '03001234567',
        status: 'VERIFIED',
        confidence: 1.0,
      } as any);

      const result = await aiPaymentVerifierService.verify(
        `test:${validReceiptPayload}`,
        140000,
        '03001234567'
      );

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.status).toBe('VERIFIED');
      expect(result.fields.amount).toBe(140000);
      expect(result.fields.receiverId).toBe('03001234567');
      expect(result.fields.transactionRef).toContain('RRN_TEST_');
    });

    it('rejects duplicate receipt when transactionRef already exists in database with 400 Bad Request', async () => {
      const existingRef = 'RRN_DUPLICATE_99999';
      const duplicatePayload = JSON.stringify({
        amount: 140000,
        receiverId: '03001234567',
        bank: 'JazzCash',
        currency: 'PKR',
        transactionRef: existingRef,
      });

      // Simulate existing receipt in DB
      vi.spyOn(prisma.paymentReceipt, 'findUnique').mockResolvedValue({
        id: 'rcpt_existing_123',
        transactionRef: existingRef,
        amount: 140000,
        receiverId: '03001234567',
        status: 'VERIFIED',
      } as any);

      await expect(
        aiPaymentVerifierService.verify(
          `test:${duplicatePayload}`,
          140000,
          '03001234567'
        )
      ).rejects.toThrow('This receipt has already been used.');
    });

    it('flips status to PENDING_MANUAL_REVIEW when OCR confidence is < 0.85 or receipt is blurry', async () => {
      const blurryPayload = JSON.stringify({
        amount: 140000,
        receiverId: '03001234567',
        bank: 'Easypaisa',
        currency: 'PKR',
        transactionRef: 'RRN_BLURRY_1',
        isBlurryOrUnreadable: true, // Blurry flag
      });

      vi.spyOn(prisma.paymentReceipt, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.paymentReceipt, 'create').mockResolvedValue({
        id: 'rcpt_blurry_1',
        transactionRef: 'RRN_BLURRY_1',
        status: 'PENDING_MANUAL_REVIEW',
        confidence: 0.40,
      } as any);

      const result = await aiPaymentVerifierService.verify(
        `test:${blurryPayload}`,
        140000,
        '03001234567'
      );

      expect(result.isValid).toBe(false);
      expect(result.isPendingReview).toBe(true);
      expect(result.status).toBe('PENDING_MANUAL_REVIEW');
      expect(result.confidence).toBeLessThan(0.85);
    });
  });

  describe('2. Securing the LP Off-Ramp State Machine', () => {
    it('blocks LP trade match if USDC is not locked in Solana Anchor Escrow PDA', async () => {
      const unlockedIntent = {
        id: 'intent_unlocked_1',
        customerWallet: 'CustWallet111',
        amountUsdc: 500,
        minRatePkr: 280,
        destinationType: 'Raast',
        destinationRef: '03001234567',
        lockedTxHash: null, // NOT LOCKED!
        status: 'PENDING_ESCROW_LOCK',
        expiresAt: new Date(Date.now() + 60000),
      };

      vi.spyOn(prisma.offrampIntent, 'findUnique').mockResolvedValue(unlockedIntent as any);

      await expect(
        offrampService.matchLp('intent_unlocked_1', 'LpWallet999')
      ).rejects.toThrow('Cannot match LP: USDC must first be confirmed locked in the Solana Anchor Escrow PDA.');
    });

    it('allows trade matching once smart contract lock is confirmed', async () => {
      const lockedIntent = {
        id: 'intent_locked_1',
        customerWallet: 'CustWallet111',
        amountUsdc: 100,
        minRatePkr: 280,
        quotePkr: 28000,
        destinationType: 'Raast',
        destinationRef: '03001234567',
        lockedTxHash: '5K3jW...SolanaAnchorTxHash', // Confirmed lock
        status: 'PENDING_LP',
        expiresAt: new Date(Date.now() + 60000),
      };

      const mockLp = {
        id: 'lp_1',
        walletAddress: 'LpWallet999',
        isActive: true,
        maxSingleUsdc: 500,
        collateralUsdc: 1000,
        lockedCollateralUsdc: 200,
        trustScore: 85,
      };

      vi.spyOn(prisma.offrampIntent, 'findUnique').mockResolvedValue(lockedIntent as any);
      vi.spyOn(prisma.liquidityProvider, 'findUnique').mockResolvedValue(mockLp as any);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          offrampIntent: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...lockedIntent,
              status: 'MATCHED',
              lpWallet: 'LpWallet999',
            }),
          },
          liquidityProvider: {
            update: vi.fn().mockResolvedValue({}),
          },
          vaultLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const matched = await offrampService.matchLp('intent_locked_1', 'LpWallet999');
      expect(matched.status).toBe('MATCHED');
      expect(matched.lpWallet).toBe('LpWallet999');
    });

    it('releases USDC and settles off-ramp upon valid proof and high confidence', async () => {
      const matchedIntent = {
        id: 'intent_matched_1',
        customerWallet: 'CustWallet111',
        lpWallet: 'LpWallet999',
        amountUsdc: 100,
        minRatePkr: 280,
        feePct: 0.85,
        quotePkr: 28000,
        destinationType: 'Raast',
        destinationRef: '03001234567',
        lockedTxHash: '5K3jW...SolanaAnchorTxHash',
        status: 'MATCHED',
      };

      vi.spyOn(prisma.offrampIntent, 'findUnique').mockResolvedValue(matchedIntent as any);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          offrampIntent: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          liquidityProvider: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ id: 'lp_1', collateralUsdc: 1000, lockedCollateralUsdc: 100 }),
          },
          vaultLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const settled = await offrampService.acceptProof('intent_matched_1', 'AI_OCR_AUTO');
      expect(settled).toBeDefined();
    });

    it('settles off-ramp when contractor confirms receipt via Telegram button [Yes, Release Funds]', async () => {
      const intentInReview = {
        id: 'intent_review_2',
        customerWallet: 'CustWallet222',
        lpWallet: 'LpWallet888',
        amountUsdc: 200,
        minRatePkr: 280,
        feePct: 0.85,
        quotePkr: 56000,
        destinationType: 'Raast',
        destinationRef: '03007654321',
        lockedTxHash: 'AnchorLockHash222',
        status: 'PENDING_MANUAL_REVIEW',
      };

      vi.spyOn(prisma.offrampIntent, 'findUnique').mockResolvedValue(intentInReview as any);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          offrampIntent: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          liquidityProvider: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ id: 'lp_2', collateralUsdc: 2000, lockedCollateralUsdc: 200 }),
          },
          vaultLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const settled = await offrampService.acceptProof('intent_review_2', 'CONTRACTOR_CONFIRMATION');
      expect(settled).toBeDefined();
    });

    it('freezes escrow and transitions intent to DISPUTED when contractor clicks [No, Dispute]', async () => {
      const intentToDispute = {
        id: 'intent_dispute_1',
        status: 'MATCHED',
      };

      vi.spyOn(prisma.offrampIntent, 'findUnique').mockResolvedValue(intentToDispute as any);
      vi.spyOn(prisma.offrampIntent, 'update').mockResolvedValue({
        id: 'intent_dispute_1',
        status: 'DISPUTED',
      } as any);

      const disputed = await offrampService.disputeIntent('intent_dispute_1', 'Contractor reported money not received');
      expect(disputed.status).toBe('DISPUTED');
    });
  });

  describe('3. Manual Review Approval Queue', () => {
    it('manually approves a low-confidence receipt and triggers ledger release', async () => {
      const { manualApprovePayment } = await import('../../controllers/payment.controller');

      const mockReceipt = {
        id: 'rcpt_pending_1',
        intentId: 'intent_manual_1',
        status: 'PENDING_MANUAL_REVIEW',
      };

      vi.spyOn(prisma.paymentReceipt, 'findUnique').mockResolvedValue(mockReceipt as any);
      vi.spyOn(prisma.paymentReceipt, 'update').mockResolvedValue({
        ...mockReceipt,
        status: 'VERIFIED',
        verifiedBy: 'coordinator@pabandi.com',
      } as any);

      vi.spyOn(offrampService, 'acceptProof').mockResolvedValue({
        id: 'intent_manual_1',
        status: 'SETTLED',
      } as any);

      const req: any = {
        body: { receiptId: 'rcpt_pending_1', notes: 'Verified bank RRN directly on Meezan portal' },
        user: { id: 'usr_coord_1', email: 'coordinator@pabandi.com', role: 'COORDINATOR' },
      };

      let jsonOutput: any;
      let statusCode = 200;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          jsonOutput = data;
          return res;
        },
      };
      const next = vi.fn();

      await manualApprovePayment(req, res, next);

      expect(statusCode).toBe(200);
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.message).toContain('Payment manually approved and ledger release executed');
      expect(jsonOutput.data.receipt.status).toBe('VERIFIED');
    });
  });
});
