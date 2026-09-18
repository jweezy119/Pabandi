import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

// All routes require auth.
router.use(authenticate);

// ── Contacts ──────────────────────────────────────────────────────────────────

// POST /api/v1/crm/contacts
router.post('/contacts', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { firstName, lastName, email, phone, company, title, source, status, tags, metadata } = req.body || {};
    const contact = await prisma.contact.create({
      data: { managerId: profile.id, firstName, lastName, email, phone, company, title, source, status: status || 'LEAD', tags: tags || [], metadata },
    });
    res.status(201).json({ success: true, data: contact });
  } catch (e: any) {
    console.error('[crm] create contact failed:', e.message);
    res.status(500).json({ error: 'Could not create contact' });
  }
});

// GET /api/v1/crm/contacts
router.get('/contacts', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { status, search } = req.query;
    const where: any = { managerId: profile.id };
    if (status) where.status = status as string;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const contacts = await prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: contacts });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/crm/contacts/:id
router.patch('/contacts/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const updated = await prisma.contact.update({ where: { id: contact.id }, data: req.body || {} });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update contact' });
  }
});

// DELETE /api/v1/crm/contacts/:id
router.delete('/contacts/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    await prisma.contact.delete({ where: { id: contact.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete contact' });
  }
});

// ── Deals ─────────────────────────────────────────────────────────────────────

// POST /api/v1/crm/deals
router.post('/deals', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { contactId, title, description, value, currency, stage, probability, expectedCloseDate, lostReason, metadata } = req.body || {};
    const deal = await prisma.deal.create({
      data: { managerId: profile.id, contactId, title, description, value: value || 0, currency: currency || 'USD', stage: stage || 'LEAD', probability: probability || 0, expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null, lostReason, metadata },
    });
    res.status(201).json({ success: true, data: deal });
  } catch (e: any) {
    console.error('[crm] create deal failed:', e.message);
    res.status(500).json({ error: 'Could not create deal' });
  }
});

// GET /api/v1/crm/deals
router.get('/deals', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { stage, contactId } = req.query;
    const where: any = { managerId: profile.id };
    if (stage) where.stage = stage as string;
    if (contactId) where.contactId = contactId as string;

    const deals = await prisma.deal.findMany({ where, include: { contact: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: deals });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/crm/deals/:id
router.patch('/deals/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const { closedAt, ...updateData } = req.body || {};
    const data: any = { ...updateData };
    if (deal.stage === 'WON' && !deal.closedAt) data.closedAt = new Date();
    if (deal.stage === 'LOST' && !deal.closedAt) data.closedAt = new Date();

    const updated = await prisma.deal.update({ where: { id: deal.id }, data });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update deal' });
  }
});

// DELETE /api/v1/crm/deals/:id
router.delete('/deals/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    await prisma.deal.delete({ where: { id: deal.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete deal' });
  }
});

// ── Pipeline Summary ──────────────────────────────────────────────────────────

// GET /api/v1/crm/pipeline
router.get('/pipeline', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const deals = await prisma.deal.findMany({ where: { managerId: profile.id }, include: { contact: true } });
    const stages = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const pipeline = stages.map(stage => ({
      stage,
      count: deals.filter(d => d.stage === stage).length,
      value: deals.filter(d => d.stage === stage).reduce((s, d) => s + d.value, 0),
    }));

    res.json({ success: true, data: { pipeline, totalDeals: deals.length, totalValue: deals.reduce((s, d) => s + d.value, 0) } });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Campaigns ─────────────────────────────────────────────────────────────────

// POST /api/v1/crm/campaigns
router.post('/campaigns', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { name, description, type, template, subject, body, recipientFilter, scheduledAt } = req.body || {};
    const campaign = await prisma.campaign.create({
      data: {
        managerId: profile.id,
        name,
        description,
        type: type || 'EMAIL',
        template,
        subject,
        body,
        recipientFilter,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (e: any) {
    console.error('[crm] create campaign failed:', e.message);
    res.status(500).json({ error: 'Could not create campaign' });
  }
});

// GET /api/v1/crm/campaigns
router.get('/campaigns', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const campaigns = await prisma.campaign.findMany({ where: { managerId: profile.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: campaigns });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/campaigns/:id/recipients
router.post('/campaigns/:id/recipients', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { contactId, email, phone } = req.body || {};
    if (!email && !phone) return res.status(400).json({ error: 'email or phone is required' });

    const recipient = await prisma.campaignRecipient.create({
      data: { managerId: profile.id, campaignId: campaign.id, contactId, email, phone },
    });
    res.status(201).json({ success: true, data: recipient });
  } catch (e: any) {
    console.error('[crm] add recipient failed:', e.message);
    res.status(500).json({ error: 'Could not add recipient' });
  }
});

// POST /api/v1/crm/campaigns/:id/send
router.post('/campaigns/:id/send', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { campaignService } = await import('../services/campaign.service');
    const result = await campaignService.sendCampaign(campaign.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[crm] send campaign failed:', e.message);
    res.status(500).json({ error: 'Could not send campaign' });
  }
});

export default router;
