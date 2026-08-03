import { Router, Request, Response } from 'express';
import { linkedinLeadGenService, LINKEDIN_PERSONAS, CONTENT_TEMPLATES } from '../services/linkedinLeadGen.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/linkedin/generate-message
 * Generate a personalized icebreaker message for a prospect.
 * Body: { personaId, firstName, techStack?, mutualConnections? }
 */
router.post('/generate-message', async (req: Request, res: Response): Promise<any> => {
  const { personaId, firstName, techStack, mutualConnections } = req.body;
  const persona = LINKEDIN_PERSONAS.find(p => p.id === personaId);

  if (!persona) {
    return res.status(400).json({ success: false, error: 'Invalid personaId' });
  }
  if (!firstName) {
    return res.status(400).json({ success: false, error: 'firstName required' });
  }

  try {
    const message = linkedinLeadGenService.generateIcebreaker(
      persona, firstName, techStack, mutualConnections
    );
    res.json({ success: true, data: { message, persona: persona.name, valueProp: persona.valueProp } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/schedule-posts
 * Schedule a batch of LinkedIn posts for a persona.
 * Body: { personaIds: string[], count: number }
 */
router.post('/schedule-posts', async (req: Request, res: Response): Promise<any> => {
  const { personaIds, count = 3 } = req.body;

  try {
    const personas = personaIds
      ? LINKEDIN_PERSONAS.filter(p => personaIds.includes(p.id))
      : LINKEDIN_PERSONAS;

    const scheduled = linkedinLeadGenService.scheduleContentBatch(personas, count);

    res.json({ success: true, data: { scheduled, count: scheduled.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/capture-lead
 * Capture a lead from a LinkedIn post/ad → landing page form.
 * Body: { linkedinId, linkedinName, linkedinUrl, email, persona, source }
 */
router.post('/capture-lead', async (req: Request, res: Response): Promise<any> => {
  const { linkedinId, linkedinName, linkedinUrl, email, persona, source } = req.body;

  if (!linkedinId || !linkedinName) {
    return res.status(400).json({ success: false, error: 'linkedinId and linkedinName required' });
  }

  try {
    const lead = await linkedinLeadGenService.captureLead(
      linkedinId, linkedinName, linkedinUrl, email, persona || 'unknown', source || 'linkedin-post'
    );

    // Auto-issue a free trust score assessment
    const assessmentUrl = `https://pabandi.app/trust-assessment?lead=${lead.leadId}`;

    res.json({
      success: true,
      data: {
        lead,
        assessmentUrl,
        message: 'Lead captured! Free trust score assessment ready.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/dm-campaign
 * Run a DM campaign to a list of prospects.
 * Body: { personaId, prospects: [{ linkedinId, firstName, techStack?, mutualConnections? }] }
 */
router.post('/dm-campaign', async (req: Request, res: Response): Promise<any> => {
  const { personaId, prospects } = req.body;
  const persona = LINKEDIN_PERSONAS.find(p => p.id === personaId);

  if (!persona || !prospects || !Array.isArray(prospects)) {
    return res.status(400).json({ success: false, error: 'personaId and prospects array required' });
  }

  try {
    const result = await linkedinLeadGenService.runDMCampaign(persona, prospects);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/linkedin/convert-lead
 * Convert a captured lead into a Pabandi business owner.
 * Body: { leadId, paymentMethod? }
 */
router.post('/convert-lead', async (req: Request, res: Response): Promise<any> => {
  const { leadId, paymentMethod } = req.body;

  if (!leadId) {
    return res.status(400).json({ success: false, error: 'leadId required' });
  }

  try {
    const result = await linkedinLeadGenService.convertLead(leadId, paymentMethod);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/linkedin/stats
 * Get lead-gen funnel stats.
 */
router.get('/stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const stats = linkedinLeadGenService.getStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/linkedin/personas
 * Get all target personas for LinkedIn outreach.
 */
router.get('/personas', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: LINKEDIN_PERSONAS.map(p => ({
      id: p.id,
      name: p.name,
      title: p.title,
      industries: p.industries,
      minConnections: p.minConnections,
      valueProp: p.valueProp,
    })),
  });
});

/**
 * GET /api/v1/linkedin/content-templates
 * Get content templates for LinkedIn posts.
 */
router.get('/content-templates', async (_req: Request, res: Response) => {
  res.json({ success: true, data: CONTENT_TEMPLATES });
});

export default router;
