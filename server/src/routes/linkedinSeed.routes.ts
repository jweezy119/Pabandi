import { Router, Request, Response } from 'express';
import { linkedinProfileSeeder } from '../services/linkedinProfileSeeder.service';
import { logger } from '../utils/logger';

const router = Router();

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
 * POST /api/v1/linkedin/seed/import-csv
 * Import profiles from CSV (manual upload).
 * Body: { personaId, csvContent }
 */
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
 * GET /api/v1/linkedin/seed/badge/:linkedinId
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

export default router;
