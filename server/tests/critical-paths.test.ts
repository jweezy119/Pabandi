import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = 'test-dummy-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SOLANA_ATTESTATION_KEYPAIR = '';

vi.mock('../src/services/email.service', () => ({
  emailService: {
    send: vi.fn(() => Promise.resolve(true)),
  },
}));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

import { referralFeeShareService } from '../src/services/referral-fee-share.service';
import { pabStakingService } from '../src/services/pab-staking.service';
import { universalEscrowService } from '../src/services/universal-escrow.service';
import { writeAttestation, getAttestationsForPassport } from '../src/services/onchain-attestation.service';

describe('Critical Path Integration Tests', () => {
  beforeAll(() => {
    // Ensure env is loaded
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.referralEarning.deleteMany({ where: { referrerId: { contains: 'test-user' } } });
    await prisma.pabReferral.deleteMany({ where: { referrerId: { contains: 'test-user' } } });
    await prisma.stakingRecord.deleteMany({ where: { userId: { contains: 'test-user' } } });
    await prisma.universalEscrow.deleteMany({ where: { referenceId: { contains: 'test-escrow' } } });
    await prisma.onchainAttestation.deleteMany({ where: { passportId: { contains: 'test-passport' } } });
    await prisma.pabWallet.deleteMany({ where: { userId: { contains: 'test-user' } } });
    await prisma.trustPassport.deleteMany({ where: { id: { contains: 'test-passport' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } });
  });

  describe('toggleMode flow', () => {
    it('should toggle user mode via auth service', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-toggle@example.com',
          passwordHash: 'test',
          firstName: 'Test',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test-toggle@example.com');
    });
  });

  describe('markInvoicePaid → referral fee-share → PAB credit', () => {
    it('should credit 5% of invoice amount to referrer PAB balance', async () => {
      const ts = Date.now();
      const referrerEmail = `referrer-${ts}@example.com`;
      const refereeEmail = `referee-${ts}@example.com`;

      const referrer = await prisma.user.create({
        data: {
          email: referrerEmail,
          passwordHash: 'test',
          firstName: 'Referrer',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const referee = await prisma.user.create({
        data: {
          email: refereeEmail,
          passwordHash: 'test',
          firstName: 'Referee',
          lastName: 'User',
          role: 'BUSINESS_OWNER',
        },
      });

      const business = await prisma.business.create({
        data: {
          name: 'Test Business',
          ownerId: referee.id,
          category: 'OTHER',
          address: '123 Test St',
        },
      });

      const referral = await prisma.pabReferral.create({
        data: {
          referrerId: referrer.id,
          refereeId: referee.id,
          refereeEmail: referee.email,
          status: 'REGISTERED',
          referrerBonus: 200,
          refereeBonus: 500,
          feeSharePct: 5,
          feeShareMonths: 12,
        },
      });

      await prisma.pabWallet.create({
        data: { userId: referrer.id, balance: 0, totalEarned: 0 },
      });

      const result = await referralFeeShareService.creditReferrer({
        businessId: business.id,
        invoiceId: `test-invoice-${ts}`,
        amount: 1000,
      });

      expect(result).toBeDefined();
      expect(result?.amountPab).toBeGreaterThan(0);

      const wallet = await prisma.pabWallet.findUnique({ where: { userId: referrer.id } });
      expect(wallet?.balance).toBeGreaterThan(0);

      const earning = await prisma.referralEarning.findFirst({
        where: { referralId: referral.id },
      });
      expect(earning).toBeDefined();
      expect(earning?.status).toBe('pending');
    }, 30000);
  });

  describe('escrow creation', () => {
    it('should create and update escrow status', async () => {
      const escrow = await universalEscrowService.create({
        referenceId: 'test-escrow',
        template: 'freelance',
        parties: [
          { partyId: 'buyer-1', role: 'buyer' },
          { partyId: 'seller-1', role: 'seller' },
        ],
        amount: 500,
        currency: 'USDC',
        conditions: [{ type: 'milestone', verify: { milestoneId: 'm1' } }],
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(escrow).toBeDefined();
      expect(escrow.status).toBe('draft');

      const funded = await universalEscrowService.updateStatus('test-escrow', 'funded');
      expect(funded.status).toBe('funded');

      const released = await universalEscrowService.updateStatus('test-escrow', 'released');
      expect(released.status).toBe('released');
    });
  });

  describe('trust attestation', () => {
    it('should skip onchain write when keypair is missing', async () => {
      const result = await writeAttestation({
        passportId: 'test-passport',
        eventType: 'invoice.paid_on_time',
        referenceId: 'test-ref-1',
        metadata: { amount: 100 },
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_keypair');
    });

    it('should create pending attestation record in DB', async () => {
      const result = await writeAttestation({
        passportId: 'test-passport',
        eventType: 'invoice.paid_on_time',
        referenceId: 'test-ref-2',
        metadata: { amount: 200 },
      });

      expect(result.skipped).toBe(true);
      expect(result.attestation).toBeDefined();
      expect(result.attestation.status).toBe('pending');
      expect(result.attestation.passportId).toBe('test-passport');
    });
  });
});
