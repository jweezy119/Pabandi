import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { teamService } from '../services/team.service';
import { webhookService } from '../services/webhook.service';
import { documentAIService } from '../services/documentAI.service';
import { logger } from '../utils/logger';

const router = Router();

// All routes require auth
router.use(authenticate);

// ── Team Management ──────────────────────────────────────────────────────────

// GET /api/v1/team/members
router.get('/members', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const members = await teamService.listMembers(managerId);
    res.json({ success: true, data: members });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not load team members' });
  }
});

// POST /api/v1/team/invite
router.post('/invite', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const { email, firstName, lastName, role } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    const member = await teamService.invite(managerId, { email, firstName, lastName, role: role || 'MEMBER' });
    res.status(201).json({ success: true, data: member });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Could not invite team member' });
  }
});

// PATCH /api/v1/team/members/:id/role
router.patch('/members/:id/role', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const { role } = req.body || {};
    if (!role) return res.status(400).json({ error: 'role is required' });

    const member = await teamService.updateRole(managerId, req.params.id, role);
    res.json({ success: true, data: member });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Could not update role' });
  }
});

// DELETE /api/v1/team/members/:id
router.delete('/members/:id', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    await teamService.remove(managerId, req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Could not remove team member' });
  }
});

// ── Webhooks ─────────────────────────────────────────────────────────────────

// GET /api/v1/webhooks
router.get('/webhooks', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const webhooks = await webhookService.list(managerId);
    res.json({ success: true, data: webhooks });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not load webhooks' });
  }
});

// POST /api/v1/webhooks
router.post('/webhooks', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const { url, events, secret } = req.body || {};
    if (!url || !events) return res.status(400).json({ error: 'url and events are required' });

    const webhook = await webhookService.create(managerId, url, events, secret);
    res.status(201).json({ success: true, data: webhook });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not create webhook' });
  }
});

// PATCH /api/v1/webhooks/:id
router.patch('/webhooks/:id', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const webhook = await webhookService.update(managerId, req.params.id, req.body || {});
    res.json({ success: true, data: webhook });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Could not update webhook' });
  }
});

// DELETE /api/v1/webhooks/:id
router.delete('/webhooks/:id', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    await webhookService.delete(managerId, req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Could not delete webhook' });
  }
});

// ── Document AI ──────────────────────────────────────────────────────────────

// POST /api/v1/documents/analyze
router.post('/documents/analyze', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const { fileName, textContent, documentType, fileUrl } = req.body || {};
    if (!fileName || !textContent || !documentType) {
      return res.status(400).json({ error: 'fileName, textContent, and documentType are required' });
    }

    const analysis = await documentAIService.analyzeDocument(managerId, fileName, textContent, documentType, fileUrl);
    res.status(201).json({ success: true, data: analysis });
  } catch (e: any) {
    logger.error('[documents] analyze failed:', e.message);
    res.status(500).json({ error: 'Document analysis failed' });
  }
});

// GET /api/v1/documents/analyses
router.get('/documents/analyses', async (req: any, res: Response) => {
  try {
    const managerId = (req.user as any)?.propertyManagerProfileId;
    if (!managerId) return res.status(404).json({ error: 'Not enrolled' });

    const analyses = await documentAIService.getHistory(managerId);
    res.json({ success: true, data: analyses });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not load document analyses' });
  }
});

export default router;
