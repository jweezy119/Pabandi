import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();

/**
 * POST /api/v1/seed/freelancers
 * Admin endpoint to generate AI-like freelancer profiles
 */
router.post('/freelancers', async (req: Request, res: Response): Promise<any> => {
  try {
    const { count = 5 } = req.body;
    const generatedProfiles = [];

    const mockTitles = ['Senior React Developer', 'UI/UX Designer', 'Growth Marketing Expert', 'Solana Web3 Engineer', 'Technical Writer'];
    const mockSkills = ['React, Node.js, TypeScript', 'Figma, Prototyping, Wireframing', 'SEO, SEM, Paid Ads', 'Rust, Anchor, Solana Web3.js', 'API Documentation, Copywriting'];

    for (let i = 0; i < count; i++) {
      const idx = i % mockTitles.length;
      const email = `mock_juror_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}@pabandi.local`;
      const passwordHash = await bcrypt.hash('password123', 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: `Juror${i}`,
          lastName: `Trust${i}`,
          role: UserRole.CUSTOMER, // DB enum lacks FREELANCER; juror eligibility is trustScore-based only
          isEmailVerified: true,
          trustScore: Math.floor(92 + Math.random() * 6), // 92-97 int — eligible as peer juror (>= 90)
          freelanceScore: Math.floor(90 + Math.random() * 8),
          verificationTier: "VERIFIED",
        }
      });

      // Optional business profile (non-fatal if it fails)
      try {
        await prisma.business.create({
          data: {
            ownerId: user.id,
            name: `${user.firstName} ${user.lastName} - ${mockTitles[idx]}`,
            category: 'FREELANCE',
            address: 'Remote',
            phone: `+1****00${i.toString().padStart(4, '0')}`,
            email: user.email,
            description: `High-trust ${mockTitles[idx]} for peer-jury arbitration.`,
            isVerified: true,
            isActive: true,
            trustScore: user.trustScore,
            externalDetails: {
              hourlyRate: 50 + (i * 10),
              skills: mockSkills[idx].split(', '),
            },
          },
        });
      } catch (bErr: any) {
        logger.warn(`[Seed] business profile skipped for ${user.id}: ${bErr.message}`);
      }

      generatedProfiles.push({ user });
    }

    res.json({ success: true, count, data: generatedProfiles });
  } catch (error: any) {
    logger.error('Error seeding freelancers', error);
    res.status(500).json({ success: false, error: 'Failed to seed profiles' });
  }
});

/**
 * POST /api/v1/seed/bookings
 * Admin endpoint to generate fake transaction history (bookings) for freelancers
 */
router.post('/bookings', async (req: Request, res: Response): Promise<any> => {
  try {
    const { count = 10 } = req.body;
    
    // Find a real or mock customer to act as the buyer
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (!customer) {
      return res.status(400).json({ success: false, error: 'No customer found in DB to assign bookings to.' });
    }

    // Find all freelance businesses
    const freelancers = await prisma.business.findMany({ where: { category: 'FREELANCE' } });
    if (freelancers.length === 0) {
      return res.status(400).json({ success: false, error: 'No freelancers found. Seed freelancers first.' });
    }

    const generatedBookings = [];

    for (let i = 0; i < count; i++) {
      const freelancer = freelancers[Math.floor(Math.random() * freelancers.length)];
      
      const reservation = await prisma.reservation.create({
        data: {
          businessId: freelancer.id,
          customerId: customer.id,
          reservationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Past 30 days
          reservationTime: '10:00',
          numberOfGuests: 1,
          status: 'COMPLETED',
          customerName: customer.firstName + ' ' + customer.lastName,
          customerPhone: customer.phone || '+1000000000',
          depositRequired: true,
          depositAmount: 100,
          depositPaid: true,
          depositStatus: 'REIMBURSED_TO_BUSINESS',
          notes: 'Completed freelance milestone.',
          totalAmount: 500
        }
      });
      generatedBookings.push(reservation);
    }

    res.json({ success: true, count, data: generatedBookings });
  } catch (error: any) {
    logger.error('Error seeding bookings', error);
    res.status(500).json({ success: false, error: 'Failed to seed bookings' });
  }
});

/**
 * POST /api/v1/seed/reconcile
 * Reconcile known prod-DB schema drift with Prisma schema (idempotent raw SQL).
 * - adds FREELANCER to the UserRole PG enum (prod DB lacked it -> 22P02 on insert)
 * - ensures LinkedInProfile table exists (defensive; some envs missing it)
 */
router.post('/reconcile', async (_req: Request, res: Response): Promise<any> => {
  const steps: string[] = [];
  try {
    await prisma.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'FREELANCER') THEN ALTER TYPE "UserRole" ADD VALUE 'FREELANCER'; END IF; END $$;`);
    steps.push('UserRole.FREELANCER ensured');

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "LinkedInProfile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "linkedinId" TEXT NOT NULL,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "headline" TEXT,
      "company" TEXT,
      "industry" TEXT,
      "location" TEXT,
      "category" TEXT NOT NULL,
      "githubUrl" TEXT,
      "linkedinUrl" TEXT,
      "profilePictureUrl" TEXT,
      "connectionCount" INTEGER NOT NULL DEFAULT 0,
      "trustVelocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "trustBand" TEXT NOT NULL DEFAULT 'D',
      "profileCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      "walletAddress" TEXT,
      "seedSource" TEXT NOT NULL DEFAULT 'LINKEDIN_SEARCH',
      "persona" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    steps.push('LinkedInProfile table ensured');

    res.json({ success: true, steps });
  } catch (error: any) {
    logger.error('[Seed] reconcile failed', error);
    res.status(500).json({ success: false, error: error.message, steps });
  }
});

/**
 * POST /api/v1/seed/demo
 * Idempotent consolidated demo seed: high-trust jurors, trust-band (A-E) freelancers
 * with LinkedIn profiles, a liquidity-provider pool for the LOCAL off-ramp, and a bad actor.
 */
router.post('/demo', async (req: Request, res: Response): Promise<any> => {
  try {
    const { jurors = 8, freelancers = 12, liquidityProviders = 3 } = req.body || {};
    const created: any = { jurors: [], freelancers: [], liquidityProviders: [], admin: null };

    for (let i = 0; i < jurors; i++) {
      const email = `seed_juror_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}@pabandi.local`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: `Juror${i}`,
          lastName: `Trust${i}`,
          role: UserRole.CUSTOMER,
          isEmailVerified: true,
          trustScore: Math.floor(92 + Math.random() * 6),
          freelanceScore: Math.floor(90 + Math.random() * 8),
          verificationTier: 'VERIFIED',
        },
      });
      created.jurors.push(user.id);
      try {
        await prisma.trustPassport.upsert({
          where: { handle: `seed_jr_${user.id}` },
          update: {},
          create: {
            handle: `seed_jr_${user.id}`,
            displayName: `${user.firstName} ${user.lastName}`,
            category: 'FREELANCER',
            bio: 'High-trust peer juror on Pabandi (seeded demo).',
            walletAddress: user.walletAddress,
            visibility: 'PUBLIC',
          },
        });
      } catch (e: any) {
        logger.warn(`[Seed] TrustPassport skip for juror ${user.id}: ${e.message}`);
      }
    }

    const bands = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < freelancers; i++) {
      const email = `seed_freelancer_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}@pabandi.local`;
      const band = bands[i % bands.length];
      const score = band === 'A' ? 95 : band === 'B' ? 80 : band === 'C' ? 65 : band === 'D' ? 50 : 20;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: `Freelancer${i}`,
          lastName: `Pro${i}`,
          role: UserRole.CUSTOMER,
          isEmailVerified: true,
          trustScore: score,
          freelanceScore: score,
          verificationTier: band === 'E' ? 'BASIC' : 'VERIFIED',
        },
      });
      try {
        await prisma.linkedInProfile.upsert({
          where: { linkedinId: `li_${user.id}` },
          update: {},
          create: {
            linkedinId: `li_${user.id}`,
            firstName: user.firstName,
            lastName: user.lastName,
            headline: 'Independent Freelancer',
            industry: 'Software',
            location: 'Remote',
            category: 'FREELANCE',
            trustBand: band,
            profileCompleteness: band === 'E' ? 0.3 : 0.85,
            walletAddress: user.walletAddress,
          },
        });
      } catch (e: any) {
        logger.warn(`[Seed] LinkedInProfile skip for ${user.id}: ${e.message}`);
      }
      try {
        await prisma.trustPassport.upsert({
          where: { handle: `seed_fp_${user.id}` },
          update: {},
          create: {
            handle: `seed_fp_${user.id}`,
            displayName: `${user.firstName} ${user.lastName}`,
            category: 'FREELANCER',
            bio: `Trust-band ${band} independent freelancer on Pabandi (seeded demo).`,
            walletAddress: user.walletAddress,
            visibility: 'PUBLIC',
          },
        });
      } catch (e: any) {
        logger.warn(`[Seed] TrustPassport skip for ${user.id}: ${e.message}`);
      }
      created.freelancers.push(user.id);
    }

    const lpNames = ['PK Express LP', 'SadaPay Bridge', 'NayaPay Vault'];
    for (let i = 0; i < liquidityProviders; i++) {
      const wallet = `lp_seed_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const lp = await prisma.liquidityProvider.upsert({
        where: { walletAddress: wallet },
        update: {},
        create: {
          walletAddress: wallet,
          displayName: lpNames[i % lpNames.length],
          raastId: `RAST${1000 + i}`,
          jazzCashAccount: `JC${2000 + i}`,
          bankIban: `PK00${3000 + i}`,
          collateralUsdc: 5000 + i * 2500,
          trustScore: 90 - i * 5,
          tier: i === 0 ? 'ELITE' : i === 1 ? 'GOLD' : 'SILVER',
          maxSingleUsdc: 2000,
          dailyLimitUsdc: 10000,
          isActive: true,
        },
      });
      created.liquidityProviders.push(lp.id);
    }

    // 4) Fixed admin user (drives admin-gated off-ramp match/settle for verification & ops)
    const adminEmail = 'seed_admin@pabandi.local';
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Seed',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        isEmailVerified: true,
        trustScore: 99,
        verificationTier: 'VERIFIED',
      },
    });
    created.admin = admin.id;

    res.json({ success: true, created });
  } catch (error: any) {
    logger.error('[Seed] demo failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
