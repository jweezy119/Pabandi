import { Router, Request, Response } from 'express';
import { linkedinProfileSeeder } from '../services/linkedinProfileSeeder.service';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { startAgentLoop, stopAgentLoop, getAgentLoopState } from '../services/agentLoop.service';
import { web3AgentService } from '../services/web3Agent.service';

const router = Router();

if (!linkedinProfileSeeder.getProfiles()?.length) {
  logger.info('[LinkedInSeed] Seeding profiles on startup from local JSON...');
  linkedinProfileSeeder.seedAllProfiles(25).catch((e: any) => {
    logger.error('[LinkedInSeed] Startup seed failed: ' + e.message);
  });
}

/**
 * POST /api/v1/linkedin/seed
 * Seed profiles from real public sources (GitHub, AngelList, Wellfound, Fiverr RSS, Chambers).
 * Body: { profilesPerPersona?: number }
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  const profilesPerPersona = Number(req.body.profilesPerPersona) || 25;
  try {
    const results = await linkedinProfileSeeder.seedAllProfiles(profilesPerPersona);
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/with-wallets
 * Seed real profiles AND generate + fund Solana wallets with $PAB.
 * This bootstraps the self-economy: each profile gets a wallet with $1 PAB,
 * then can self-generate bookings/revenue.
 * Body: { profilesPerPersona?: number, fundingUsd?: number }
 */
router.post('/with-wallets', async (req: Request, res: Response): Promise<any> => {
  const profilesPerPersona = Number(req.body.profilesPerPersona) || 25;
  const fundingUsd = Number(req.body.fundingUsd) || 1;
  try {
    const results = await linkedinProfileSeeder.seedWithWallets(profilesPerPersona, fundingUsd);
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/fund-wallets
 * Fund additional seeded profile wallets from treasury.
 * Body: { count?: number, amountUsd?: number }
 * Defaults: count=100, amountUsd=1 ($1 USDC = 100 PAB at $0.01)
 */
router.post('/fund-wallets', async (req: Request, res: Response): Promise<any> => {
  const count = Math.min(Number(req.body.count) || 100, 200); // cap at 200 to limit exposure
  const amountUsd = Number(req.body.amountUsd) || 1;
  const pabPerWallet = Math.round(amountUsd / 0.01); // $0.01 = 100 PAB

  try {
    const profiles = linkedinProfileSeeder.getProfiles();
    const unfunded = profiles.filter(p => !p.walletAddress).slice(0, count);

    if (unfunded.length === 0) {
      return res.json({ success: true, data: { funded: 0, message: 'All profiles already have wallets' } });
    }

    let funded = 0;
    let totalPab = 0;

    for (const profile of unfunded) {
      try {
        const wallet = await linkedinProfileSeeder.generateWalletForProfile(profile);
        profile.walletAddress = wallet;
        const result = await linkedinProfileSeeder.fundProfileWallet(wallet, amountUsd);
        if (result.simulated || result.txHash) {
          funded++;
          totalPab += pabPerWallet;

          // Register as AI agent and credit balance so the agent loop can use it
          const existing = await prisma.web3Agent.findUnique({ where: { profileId: profile.linkedinId } });
          if (!existing) {
            await web3AgentService.createAgent(profile.linkedinId, profile.persona as 'freelance-dev' | 'small-biz-owner' | 'project-owner' | 'solopreneur', profile.firstName);
          }
          await prisma.web3Agent.update({
            where: { profileId: profile.linkedinId },
            data: { balancePab: { increment: pabPerWallet } },
          });
        }
      } catch (err: any) {
        logger.warn(`[FundWallets] Failed to fund ${profile.linkedinId}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        funded,
        totalPab,
        amountUsd,
        pabPerWallet,
        message: `Funded ${funded} wallets with ${pabPerWallet} PAB each ($${amountUsd} USD)`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router.post('/import-csv', async (req: Request, res: Response): Promise<any> => {
  const { personaId, csvContent } = req.body;
  if (!personaId || !csvContent) {
    return res.status(400).json({ success: false, error: 'personaId and csvContent required' });
  }
  try {
    const result = await linkedinProfileSeeder.importFromCSV(csvContent, personaId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/linkedin/seed/profiles
 * Public list of seeded profiles for the frontend.
 * Query: ?category=freelance-dev|small-biz-owner|project-owner|solopreneur
 */
router.get('/profiles', async (req: Request, res: Response): Promise<any> => {
  try {
    const category = String(req.query.category || '').trim();
    const stats = linkedinProfileSeeder.getStats();
    let profiles = (linkedinProfileSeeder as any).getProfiles?.() || [];

    // Fallback: if in-memory seeder is empty, load from local seed data
    if (!profiles.length) {
      try {
        const local = (linkedinProfileSeeder as any).loadLocalSeedData?.();
        if (Array.isArray(local) && local.length) {
          profiles = local.map((raw: any, idx: number) => ({
            linkedinId: raw.linkedinId || `local-${idx}`,
            firstName: raw.login?.split(/[-_]/)[0] || 'User',
            lastName: raw.login?.split(/[-_]/).slice(1).join('-') || '',
            headline: raw.headline || 'Developer',
            company: raw.company || '',
            location: raw.location || '',
            category: raw.category || 'freelance-dev',
            githubUrl: raw.githubUrl,
            walletAddress: null,
            trustVelocity: 0,
            connectionCount: raw.connectionCount || 0,
            profileCompleteness: 0.8,
          }));
        }
      } catch (e) {
        // ignore fallback errors
      }
    }

    const filtered = category ? profiles.filter((p: any) => p.category === category || p.persona === category) : profiles;
    res.json({
      success: true,
      data: {
        total: filtered.length,
        profiles: filtered.map((p: any) => ({
          linkedinId: p.linkedinId,
          firstName: p.firstName,
          lastName: p.lastName,
          headline: p.headline,
          company: p.company,
          location: p.location,
          category: p.persona || p.category,
          githubUrl: p.githubUrl,
          walletAddress: p.walletAddress || null,
          trustVelocity: p.trustVelocity,
          connectionCount: p.connectionCount,
          profileCompleteness: p.profileCompleteness,
        })),
        stats,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/badge/:linkedinId
 * Get free public trust badge HTML for a seeded profile.
 */
router.get('/badge/:linkedinId', async (req: Request, res: Response): Promise<any> => {
  const { linkedinId } = req.params;
  try {
    const stats = linkedinProfileSeeder.getStats();
    const demoProfile = {
      linkedinId,
      firstName: 'Demo',
      lastName: 'User',
      trustVelocity: 0.5,
      persona: 'freelance-dev',
      seedSource: 'LINKEDIN_SEARCH' as any,
      headline: 'Freelance Developer',
      company: 'Self-employed',
      industry: 'Software Development',
      location: 'Remote',
      connectionCount: 150,
      headlineKeywords: ['developer', 'freelance'],
      profileCompleteness: 0.9,
      linkedinUrl: `https://linkedin.com/in/${linkedinId}`,
    };
    const badge = linkedinProfileSeeder.getTrustBadge(demoProfile);
    res.json({ success: true, data: { badge, profile: demoProfile, ...stats } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/badge/purchase
 * Purchase a trust badge for a profile (paid feature).
 * Body: { linkedinId, badgeType, purchaserWallet }
 * badgeType: 'genesis-partner' | 'early-adopter' | 'trust-flux'
 */
router.post('/badge/purchase', async (req: Request, res: Response): Promise<any> => {
  const { linkedinId, badgeType, purchaserWallet } = req.body;
  if (!linkedinId || !badgeType || !purchaserWallet) {
    return res.status(400).json({ success: false, error: 'linkedinId, badgeType, and purchaserWallet required' });
  }

  const BADGE_PRICES: Record<string, number> = {
    'genesis-partner': 50,
    'early-adopter': 20,
    'trust-flux': 10,
  };

  const price = BADGE_PRICES[badgeType];
  if (!price) {
    return res.status(400).json({ success: false, error: `Invalid badgeType. Valid: ${Object.keys(BADGE_PRICES).join(', ')}` });
  }

  try {
    // Verify purchaser wallet has sufficient balance (simplified: check seeded profile)
    const purchaser = linkedinProfileSeeder.getProfiles().find(p => p.walletAddress === purchaserWallet);
    if (!purchaser) {
      return res.status(404).json({ success: false, error: 'Purchaser wallet not found among seeded profiles' });
    }

    // Log badge purchase as an agent transaction
    await prisma.agentTransaction.create({
      data: {
        agentId: purchaserWallet,
        type: 'BADGE_PURCHASE',
        amount: price,
        txHash: `badge-${linkedinId}-${badgeType}-${Date.now()}`,
        fromAddress: purchaserWallet,
        toAddress: process.env.PABANDI_TREASURY_WALLET || 'F5W934e6qJb8z2GZJj3kGjUfN6xLqK4W7CpHbBvRmN3D',
      } as any,
    });

    // Generate badge HTML
    const profile = linkedinProfileSeeder.getProfiles().find(p => p.linkedinId === linkedinId) || {
      linkedinId,
      firstName: 'Verified',
      lastName: 'Profile',
      trustVelocity: 0.5,
      headline: 'Pabandi Verified',
      company: 'Pabandi Network',
      location: 'Global',
    };
    const badge = linkedinProfileSeeder.getTrustBadge(profile as any);

    res.json({
      success: true,
      data: {
        badge,
        badgeType,
        price,
        purchaserWallet,
        purchasedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/linkedin/seed/stats
 * Get seeding + trust band statistics.
 */
router.get('/stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const stats = linkedinProfileSeeder.getStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/simulate-economy
 * Run self-economy simulation: seeded profiles book each other,
 * generating PAB rewards + platform fees.
 * Body: { rounds?: number }
 */
router.post('/simulate-economy', async (req: Request, res: Response): Promise<any> => {
  const rounds = Number(req.body.rounds) || 3;
  try {
    const result = await linkedinProfileSeeder.simulateSelfEconomy(rounds);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/linkedin/seed/agent-loop/status
 * Returns the current state of the AI agent loop.
 */
router.get('/agent-loop/status', async (_req: Request, res: Response): Promise<any> => {
  try {
    const state = getAgentLoopState();
    res.json({ success: true, data: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/agent-loop/start
 * Manually restart the agent loop.
 */
router.post('/agent-loop/start', async (_req: Request, res: Response): Promise<any> => {
  try {
    startAgentLoop();
    res.json({ success: true, message: 'Agent loop started' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/agent-loop/stop
 * Stop the agent loop.
 */
router.post('/agent-loop/stop', async (_req: Request, res: Response): Promise<any> => {
  try {
    stopAgentLoop();
    res.json({ success: true, message: 'Agent loop stopped' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/register-agents
 * Register all funded profiles (with wallets) as AI agents in the DB.
 * This allows the agent loop to load and transact with them.
 */
router.post('/register-agents', async (_req: Request, res: Response): Promise<any> => {
  try {
    const profiles = linkedinProfileSeeder.getProfiles();
    const withWallet = profiles.filter(p => p.walletAddress);
    let created = 0;
    let skipped = 0;

    for (const profile of withWallet) {
      const existing = await prisma.web3Agent.findUnique({ where: { profileId: profile.linkedinId } });
      if (existing) {
        skipped++;
        continue;
      }
      await web3AgentService.createAgent(profile.linkedinId, profile.persona as any, profile.firstName);
      // Credit initial balance
      await prisma.web3Agent.update({
        where: { profileId: profile.linkedinId },
        data: { balancePab: { increment: 100 } },
      });
      created++;
    }

    res.json({ success: true, data: { created, skipped, totalWithWallet: withWallet.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/fund-agents
 * Credit PAB to all existing agents in the DB (so agent loop has balances to transact).
 */
router.post('/fund-agents', async (req: Request, res: Response): Promise<any> => {
  const amountPab = Number(req.body.amountPab) || 100;
  try {
    const result = await prisma.web3Agent.updateMany({
      where: { isActive: true },
      data: { balancePab: { increment: amountPab } },
    });
    res.json({ success: true, data: { updated: result.count, amountPab } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/seed/migrate
 * Create Web3Agent and AgentTransaction tables if they don't exist.
 */
router.post('/migrate', async (_req: Request, res: Response): Promise<any> => {
  try {
    // Create Web3Agent table if missing
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Web3Agent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "profileId" TEXT NOT NULL UNIQUE,
        "walletAddress" TEXT NOT NULL UNIQUE,
        "encryptedPrivateKey" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "balancePab" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "dailyOutflow" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "dailyTransactions" INTEGER NOT NULL DEFAULT 0,
        "lastReset" TIMESTAMP NOT NULL DEFAULT now(),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create AgentTransaction table if missing
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AgentTransaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "agentId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "txHash" TEXT,
        "fromAddress" TEXT,
        "toAddress" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "AgentTransaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Web3Agent" ("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AgentTransaction_agentId_createdAt_idx" ON "AgentTransaction" ("agentId", "createdAt")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AgentTransaction_txHash_idx" ON "AgentTransaction" ("txHash")');

    res.json({ success: true, message: 'Database tables created' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
