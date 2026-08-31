import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateRefCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 characters
}

export const accountManagerController = {
  // Admin Endpoints
  async createPartner(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const existingProfile = await prisma.accountManagerProfile.findUnique({
        where: { userId }
      });

      if (existingProfile) {
        return res.status(400).json({ error: 'User is already an Account Manager' });
      }

      const referralCode = generateRefCode();

      const profile = await prisma.accountManagerProfile.create({
        data: {
          userId,
          referralCode,
          status: 'ACTIVE'
        }
      });

      res.status(201).json(profile);
    } catch (error) {
      console.error('Error creating partner:', error);
      res.status(500).json({ error: 'Failed to create partner' });
    }
  },

  async updateConfig(req: Request, res: Response) {
    try {
      const { active, signupBountyAmount, globalMonthlyCap, merchantMonthlyCap, rateYear1, rateYear2, rateYear3Plus } = req.body;
      
      let config = await prisma.partnerProgramConfig.findFirst();
      if (!config) {
        config = await prisma.partnerProgramConfig.create({ data: {} });
      }

      const updated = await prisma.partnerProgramConfig.update({
        where: { id: config.id },
        data: {
          ...(active !== undefined && { active }),
          ...(signupBountyAmount !== undefined && { signupBountyAmount }),
          ...(globalMonthlyCap !== undefined && { globalMonthlyCap }),
          ...(merchantMonthlyCap !== undefined && { merchantMonthlyCap }),
          ...(rateYear1 !== undefined && { rateYear1 }),
          ...(rateYear2 !== undefined && { rateYear2 }),
          ...(rateYear3Plus !== undefined && { rateYear3Plus }),
        }
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: 'Failed to update config' });
    }
  },

  // Self-serve enrollment: any authenticated user can opt into the referral
  // program and receive a unique code. Returns the existing profile if already enrolled.
  async enroll(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const existing = await prisma.accountManagerProfile.findUnique({ where: { userId } });
      if (existing) return res.json({ success: true, profile: existing, created: false });

      const referralCode = generateRefCode();
      const profile = await prisma.accountManagerProfile.create({
        data: { userId, referralCode, status: 'ACTIVE' }
      });
      res.status(201).json({ success: true, profile, created: true });
    } catch (error) {
      console.error('enroll error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Dashboard Endpoints
  async getMe(req: Request, res: Response) {
    try {
      const userId = req.user?.id; // Assuming auth middleware attaches user
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await prisma.accountManagerProfile.findUnique({
        where: { userId }
      });

      if (!profile) return res.status(404).json({ error: 'Account Manager profile not found' });

      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getReferrals(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await prisma.accountManagerProfile.findUnique({
        where: { userId }
      });

      if (!profile) return res.status(404).json({ error: 'Account Manager profile not found' });

      const businesses = await prisma.business.findMany({
        where: { referredById: profile.id },
        select: { id: true, name: true, createdAt: true, isVerified: true, bountyPaid: true }
      });

      // Also fetching users referred by this user
      const users = await prisma.user.findMany({
        where: { referredById: userId },
        select: { id: true, firstName: true, lastName: true, createdAt: true }
      });

      res.json({ businesses, users });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getLedger(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await prisma.accountManagerProfile.findUnique({
        where: { userId }
      });

      if (!profile) return res.status(404).json({ error: 'Account Manager profile not found' });

      const ledgers = await prisma.referralLedger.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' }
      });

      res.json(ledgers);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getPayouts(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await prisma.accountManagerProfile.findUnique({
        where: { userId }
      });

      if (!profile) return res.status(404).json({ error: 'Account Manager profile not found' });

      const payouts = await prisma.referralPayout.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' }
      });

      res.json(payouts);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Cash out all unbilled (isReversed=false, payoutId=null) referral ledger entries
  // into a single ReferralPayout request. Returns the created payout + total.
  async requestPayout(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await prisma.accountManagerProfile.findUnique({
        where: { userId }
      });
      if (!profile) return res.status(404).json({ error: 'Account Manager profile not found' });

      const unbilled = await prisma.referralLedger.findMany({
        where: { profileId: profile.id, isReversed: false, payoutId: null }
      });

      const total = unbilled.reduce((sum, l) => sum + (l.amount || 0), 0);
      if (total <= 0) {
        return res.status(400).json({ error: 'No unbilled commissions to pay out', total: 0 });
      }

      const now = new Date();
      const payout = await prisma.$transaction(async (tx) => {
        const p = await tx.referralPayout.create({
          data: {
            profileId: profile.id,
            amount: total,
            periodStart: unbilled.reduce((min, l) => (l.createdAt < min ? l.createdAt : min), unbilled[0].createdAt),
            periodEnd: unbilled.reduce((max, l) => (l.createdAt > max ? l.createdAt : max), unbilled[0].createdAt),
            status: 'PENDING'
          }
        });
        await tx.referralLedger.updateMany({
          where: { id: { in: unbilled.map((l) => l.id) } },
          data: { payoutId: p.id }
        });
        return p;
      });

      res.status(201).json({ success: true, payout, total, entries: unbilled.length });
    } catch (error) {
      console.error('requestPayout error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
