import { Router, Request, Response } from 'express';
import { linkedinProfileSeeder } from '../services/linkedinProfileSeeder.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/linkedin/seed
 * Seed profiles from public LinkedIn search.
 * Body: { profilesPerPersona?: number }
 */
router.post('/seed', async (req: Request, res: Response): Promise<any> => {
  const profilesPerPersona = Number(req.body.profilesPerPersona) || 25;
  try {
    const results = await linkedinProfileSeeder.seedAllProfiles(profilesPerPersona);
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
router.post('/seed/import-csv', async (req: Request, res: Response): Promise<any> => {
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
router.get('/seed/badge/:linkedinId', async (req: Request, res: Response): Promise<any> => {
  const { linkedinId } = req.params;
  try {
    const stats = linkedinProfileSeeder.getStats();
    // In production: look up profile from cache
    // For now: return a demo badge
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
router.get('/seed/stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const stats = linkedinProfileSeeder.getStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
