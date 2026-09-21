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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
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

// ── Tasks ──────────────────────────────────────────────────────────────────────

// GET /api/v1/crm/tasks
router.get('/tasks', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { status, contactId, dealId, assigneeId } = req.query;
    const where: any = { managerId: profile.id };
    if (status) where.status = status as string;
    if (contactId) where.contactId = contactId as string;
    if (dealId) where.dealId = dealId as string;
    if (assigneeId) where.assigneeId = assigneeId as string;

    const tasks = await prisma.task.findMany({ where, orderBy: { dueDate: 'asc' } });
    res.json({ success: true, data: tasks });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/tasks
router.post('/tasks', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { contactId, dealId, relatedType, relatedId, title, description, status, priority, dueDate, assigneeId } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const task = await prisma.task.create({
      data: { managerId: profile.id, contactId, dealId, relatedType, relatedId, title, description, status: status || 'OPEN', priority: priority || 'MEDIUM', dueDate: dueDate ? new Date(dueDate) : null, assigneeId },
    });
    res.status(201).json({ success: true, data: task });
  } catch (e: any) {
    console.error('[crm] create task failed:', e.message);
    res.status(500).json({ error: 'Could not create task' });
  }
});

// PATCH /api/v1/crm/tasks/:id
router.patch('/tasks/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const task = await prisma.task.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { status, completedAt, ...rest } = req.body || {};
    const data: any = { ...rest };
    if (status) data.status = status;
    if (status === 'COMPLETED') data.completedAt = completedAt ? new Date(completedAt) : new Date();
    if (status && status !== 'COMPLETED') data.completedAt = null;

    const updated = await prisma.task.update({ where: { id: task.id }, data });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update task' });
  }
});

// DELETE /api/v1/crm/tasks/:id
router.delete('/tasks/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const task = await prisma.task.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await prisma.task.delete({ where: { id: task.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete task' });
  }
});

// ── Communications ─────────────────────────────────────────────────────────────

// GET /api/v1/crm/communications
router.get('/communications', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { contactId, dealId, type } = req.query;
    const where: any = { managerId: profile.id };
    if (contactId) where.contactId = contactId as string;
    if (dealId) where.dealId = dealId as string;
    if (type) where.type = type as string;

    const comms = await prisma.communication.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: comms });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/communications
router.post('/communications', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const { contactId, dealId, type, direction, subject, body, duration, metadata } = req.body || {};
    if (!type) return res.status(400).json({ error: 'Type is required' });

    const comm = await prisma.communication.create({
      data: { managerId: profile.id, contactId, dealId, type, direction, subject, body, duration: duration != null ? Number(duration) : null, metadata },
    });
    res.status(201).json({ success: true, data: comm });
  } catch (e: any) {
    console.error('[crm] create communication failed:', e.message);
    res.status(500).json({ error: 'Could not log communication' });
  }
});

// ── Deal Move (Kanban) ─────────────────────────────────────────────────────────

// PATCH /api/v1/crm/deals/:id/move
router.patch('/deals/:id/move', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });

    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const { stage } = req.body || {};
    if (!stage) return res.status(400).json({ error: 'Stage is required' });

    const data: any = { stage };
    if (stage === 'WON' && !deal.closedAt) data.closedAt = new Date();
    if (stage === 'LOST' && !deal.closedAt) data.closedAt = new Date();

    const updated = await prisma.deal.update({ where: { id: deal.id }, data });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not move deal' });
  }
});

// ── Email Templates ─────────────────────────────────────────────────────────────

// GET /api/v1/crm/email-templates
router.get('/email-templates', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { category } = req.query;
    const where: any = { managerId: profile.id };
    if (category) where.category = category as string;
    const templates = await prisma.emailTemplate.findMany({ where, orderBy: { name: 'asc' } });
    res.json({ success: true, data: templates });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/email-templates
router.post('/email-templates', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { name, subject, body, category, isDefault, metadata } = req.body || {};
    if (!name || !subject || !body) return res.status(400).json({ error: 'Name, subject, and body are required' });
    const template = await prisma.emailTemplate.create({ data: { managerId: profile.id, name, subject, body, category, isDefault: isDefault || false, metadata } });
    res.status(201).json({ success: true, data: template });
  } catch (e: any) {
    console.error('[crm] create template failed:', e.message);
    res.status(500).json({ error: 'Could not create template' });
  }
});

// PATCH /api/v1/crm/email-templates/:id
router.patch('/email-templates/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const template = await prisma.emailTemplate.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const updated = await prisma.emailTemplate.update({ where: { id: template.id }, data: req.body || {} });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update template' });
  }
});

// DELETE /api/v1/crm/email-templates/:id
router.delete('/email-templates/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const template = await prisma.emailTemplate.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    await prisma.emailTemplate.delete({ where: { id: template.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete template' });
  }
});

// ── Sequences ───────────────────────────────────────────────────────────────────

// GET /api/v1/crm/sequences
router.get('/sequences', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { status } = req.query;
    const where: any = { managerId: profile.id };
    if (status) where.status = status as string;
    const sequences = await prisma.sequence.findMany({ where, include: { steps: true, _count: { select: { enrollments: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: sequences });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/sequences
router.post('/sequences', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { name, description, status, trigger, steps } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const sequence = await prisma.sequence.create({
      data: {
        managerId: profile.id,
        name,
        description,
        status: status || 'DRAFT',
        trigger,
        steps: steps ? { create: steps.map((s: any, idx: number) => ({ ...s, order: idx + 1 })) } : undefined,
      },
      include: { steps: true },
    });
    res.status(201).json({ success: true, data: sequence });
  } catch (e: any) {
    console.error('[crm] create sequence failed:', e.message);
    res.status(500).json({ error: 'Could not create sequence' });
  }
});

// PATCH /api/v1/crm/sequences/:id
router.patch('/sequences/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const sequence = await prisma.sequence.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
    const { steps, ...rest } = req.body || {};
    const data: any = { ...rest };
    if (steps) {
      await prisma.sequenceStep.deleteMany({ where: { sequenceId: sequence.id } });
      data.steps = { create: steps.map((s: any, idx: number) => ({ ...s, order: idx + 1 })) };
    }
    const updated = await prisma.sequence.update({ where: { id: sequence.id }, data, include: { steps: true } });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update sequence' });
  }
});

// DELETE /api/v1/crm/sequences/:id
router.delete('/sequences/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const sequence = await prisma.sequence.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
    await prisma.sequence.delete({ where: { id: sequence.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete sequence' });
  }
});

// POST /api/v1/crm/sequences/:id/enroll
router.post('/sequences/:id/enroll', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const sequence = await prisma.sequence.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
    const { contactId, dealId } = req.body || {};
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });
    const enrollment = await prisma.sequenceEnrollment.create({ data: { managerId: profile.id, sequenceId: sequence.id, contactId, dealId } });
    res.status(201).json({ success: true, data: enrollment });
  } catch (e: any) {
    console.error('[crm] enroll failed:', e.message);
    res.status(500).json({ error: 'Could not enroll contact' });
  }
});

// GET /api/v1/crm/sequences/:id/enrollments
router.get('/sequences/:id/enrollments', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const enrollments = await prisma.sequenceEnrollment.findMany({ where: { sequenceId: req.params.id, managerId: profile.id }, include: { contact: true } });
    res.json({ success: true, data: enrollments });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Forms ───────────────────────────────────────────────────────────────────────

// GET /api/v1/crm/forms
router.get('/forms', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const forms = await prisma.form.findMany({ where: { managerId: profile.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: forms });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/forms
router.post('/forms', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { name, slug, fields, thankYou, redirectUrl, status, metadata } = req.body || {};
    if (!name || !slug || !fields) return res.status(400).json({ error: 'Name, slug, and fields are required' });
    const form = await prisma.form.create({ data: { managerId: profile.id, name, slug, fields, thankYou, redirectUrl, status: status || 'DRAFT', metadata } });
    res.status(201).json({ success: true, data: form });
  } catch (e: any) {
    console.error('[crm] create form failed:', e.message);
    res.status(500).json({ error: 'Could not create form' });
  }
});

// GET /api/v1/crm/forms/:id/submissions
router.get('/forms/:id/submissions', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const form = await prisma.form.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!form) return res.status(404).json({ error: 'Form not found' });
    const submissions = await prisma.formSubmission.findMany({ where: { formId: form.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: submissions });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/forms/:id/submit (public endpoint)
router.post('/forms/:slug/submit', async (req: any, res: Response) => {
  try {
    const form = await prisma.form.findUnique({ where: { slug: req.params.slug } });
    if (!form || form.status !== 'ACTIVE') return res.status(404).json({ error: 'Form not found' });
    const { data, ip, userAgent, source } = req.body || {};
    const submission = await prisma.formSubmission.create({ data: { managerId: form.managerId, formId: form.id, data, ip, userAgent, source } });
    await prisma.form.update({ where: { id: form.id }, data: { submissions: { increment: 1 } } });
    res.status(201).json({ success: true, data: submission });
  } catch (e: any) {
    console.error('[crm] form submit failed:', e.message);
    res.status(500).json({ error: 'Could not submit form' });
  }
});

// ── Lead Scoring ───────────────────────────────────────────────────────────────

// POST /api/v1/crm/contacts/:id/score
router.post('/contacts/:id/score', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const { score, factors, modelVersion } = req.body || {};
    if (score === undefined) return res.status(400).json({ error: 'Score is required' });
    const leadScore = await prisma.leadScore.create({ data: { managerId: profile.id, contactId: contact.id, score: Number(score), factors, modelVersion } });
    res.status(201).json({ success: true, data: leadScore });
  } catch (e: any) {
    console.error('[crm] score contact failed:', e.message);
    res.status(500).json({ error: 'Could not score contact' });
  }
});

// GET /api/v1/crm/contacts/:id/scores
router.get('/contacts/:id/scores', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const scores = await prisma.leadScore.findMany({ where: { contactId: req.params.id, managerId: profile.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: scores });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reports ────────────────────────────────────────────────────────────────────

// GET /api/v1/crm/reports
router.get('/reports', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { type } = req.query;
    const where: any = { managerId: profile.id };
    if (type) where.type = type as string;
    const reports = await prisma.report.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: reports });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/reports
router.post('/reports', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { name, description, type, config, chartType, isDefault, isPublic } = req.body || {};
    if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });
    const report = await prisma.report.create({ data: { managerId: profile.id, name, description, type, config, chartType, isDefault: isDefault || false, isPublic: isPublic || false } });
    res.status(201).json({ success: true, data: report });
  } catch (e: any) {
    console.error('[crm] create report failed:', e.message);
    res.status(500).json({ error: 'Could not create report' });
  }
});

// POST /api/v1/crm/reports/:id/run
router.post('/reports/:id/run', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const report = await prisma.report.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const startTime = Date.now();
    let result: any = {};
    let rowCount = 0;

    // Simple report execution based on type
    switch (report.type) {
      case 'CONTACTS': {
        const contacts = await prisma.contact.findMany({ where: { managerId: profile.id } });
        const byStatus: Record<string, number> = {};
        contacts.forEach((c: any) => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
        result = { byStatus, total: contacts.length, contacts: contacts.slice(0, 100) };
        rowCount = contacts.length;
        break;
      }
      case 'DEALS': {
        const deals = await prisma.deal.findMany({ where: { managerId: profile.id }, include: { contact: true } });
        const byStage: Record<string, { count: number; value: number }> = {};
        deals.forEach((d: any) => { byStage[d.stage] = byStage[d.stage] || { count: 0, value: 0 }; byStage[d.stage].count++; byStage[d.stage].value += d.value; });
        result = { byStage, total: deals.length, totalValue: deals.reduce((s: number, d: any) => s + d.value, 0) };
        rowCount = deals.length;
        break;
      }
      case 'PIPELINE': {
        const deals = await prisma.deal.findMany({ where: { managerId: profile.id } });
        const stages = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
        const pipeline = stages.map(stage => ({ stage, count: deals.filter((d: any) => d.stage === stage).length, value: deals.filter((d: any) => d.stage === stage).reduce((s: number, d: any) => s + d.value, 0) }));
        result = { pipeline, totalDeals: deals.length, totalValue: deals.reduce((s: number, d: any) => s + d.value, 0) };
        rowCount = deals.length;
        break;
      }
      case 'TASKS': {
        const tasks = await prisma.task.findMany({ where: { managerId: profile.id } });
        const byStatus: Record<string, number> = {};
        tasks.forEach((t: any) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
        result = { byStatus, total: tasks.length };
        rowCount = tasks.length;
        break;
      }
      case 'CAMPAIGNS': {
        const campaigns = await prisma.campaign.findMany({ where: { managerId: profile.id } });
        result = { campaigns: campaigns.map((c: any) => ({ name: c.name, type: c.type, status: c.status, sent: c.sentCount, opens: c.openCount, clicks: c.clickCount })), total: campaigns.length };
        rowCount = campaigns.length;
        break;
      }
      default:
        result = { message: 'Unknown report type' };
    }

    const execution = await prisma.reportExecution.create({
      data: {
        reportId: report.id,
        managerId: profile.id,
        result,
        rowCount,
        durationMs: Date.now() - startTime,
      },
    });

    await prisma.report.update({ where: { id: report.id }, data: { lastRunAt: new Date() } });

    res.json({ success: true, data: { report, execution, result } });
  } catch (e: any) {
    console.error('[crm] run report failed:', e.message);
    res.status(500).json({ error: 'Could not run report' });
  }
});

// DELETE /api/v1/crm/reports/:id
router.delete('/reports/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const report = await prisma.report.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    await prisma.report.delete({ where: { id: report.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete report' });
  }
});

// ── Tickets ────────────────────────────────────────────────────────────────────

// GET /api/v1/crm/tickets
router.get('/tickets', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { status, priority, contactId } = req.query;
    const where: any = { managerId: profile.id };
    if (status) where.status = status as string;
    if (priority) where.priority = priority as string;
    if (contactId) where.contactId = contactId as string;
    const tickets = await prisma.ticket.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: tickets });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/tickets
router.post('/tickets', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { contactId, subject, description, status, priority, category, assigneeId } = req.body || {};
    if (!subject) return res.status(400).json({ error: 'Subject is required' });
    const ticket = await prisma.ticket.create({ data: { managerId: profile.id, contactId, subject, description, status: status || 'OPEN', priority: priority || 'MEDIUM', category, assigneeId } });
    res.status(201).json({ success: true, data: ticket });
  } catch (e: any) {
    console.error('[crm] create ticket failed:', e.message);
    res.status(500).json({ error: 'Could not create ticket' });
  }
});

// PATCH /api/v1/crm/tickets/:id
router.patch('/tickets/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { status, ...rest } = req.body || {};
    const data: any = { ...rest };
    if (status) data.status = status;
    if (status === 'RESOLVED') data.resolvedAt = new Date();
    if (status === 'CLOSED') data.closedAt = new Date();
    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update ticket' });
  }
});

// POST /api/v1/crm/tickets/:id/comments
router.post('/tickets/:id/comments', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { body, isInternal, authorId } = req.body || {};
    if (!body) return res.status(400).json({ error: 'Comment body is required' });
    const comment = await prisma.ticketComment.create({ data: { ticketId: ticket.id, managerId: profile.id, body, isInternal: isInternal || false, authorId } });
    res.status(201).json({ success: true, data: comment });
  } catch (e: any) {
    console.error('[crm] add comment failed:', e.message);
    res.status(500).json({ error: 'Could not add comment' });
  }
});

// GET /api/v1/crm/tickets/:id/comments
router.get('/tickets/:id/comments', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const comments = await prisma.ticketComment.findMany({ where: { ticketId: req.params.id, managerId: profile.id }, orderBy: { createdAt: 'asc' } });
    res.json({ success: true, data: comments });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Knowledge Base ─────────────────────────────────────────────────────────────

// GET /api/v1/crm/knowledge
router.get('/knowledge', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { category, status } = req.query;
    const where: any = { managerId: profile.id };
    if (category) where.category = category as string;
    if (status) where.status = status as string;
    const articles = await prisma.knowledgeArticle.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: articles });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/knowledge
router.post('/knowledge', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { title, slug, content, category, tags, status } = req.body || {};
    if (!title || !slug || !content) return res.status(400).json({ error: 'Title, slug, and content are required' });
    const article = await prisma.knowledgeArticle.create({ data: { managerId: profile.id, title, slug, content, category, tags: tags || [], status: status || 'DRAFT' } });
    res.status(201).json({ success: true, data: article });
  } catch (e: any) {
    console.error('[crm] create article failed:', e.message);
    res.status(500).json({ error: 'Could not create article' });
  }
});

// PATCH /api/v1/crm/knowledge/:id
router.patch('/knowledge/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const article = await prisma.knowledgeArticle.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    const updated = await prisma.knowledgeArticle.update({ where: { id: article.id }, data: req.body || {} });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update article' });
  }
});

// DELETE /api/v1/crm/knowledge/:id
router.delete('/knowledge/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const article = await prisma.knowledgeArticle.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    await prisma.knowledgeArticle.delete({ where: { id: article.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete article' });
  }
});

// ── Calendar Events ───────────────────────────────────────────────────────────

// GET /api/v1/crm/events
router.get('/events', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { startDate, endDate, contactId, dealId } = req.query;
    const where: any = { managerId: profile.id };
    if (startDate) where.startAt = { gte: new Date(startDate as string) };
    if (endDate) where.startAt = { ...where.startAt, lte: new Date(endDate as string) };
    if (contactId) where.contactId = contactId as string;
    if (dealId) where.dealId = dealId as string;
    const events = await prisma.calendarEvent.findMany({ where, orderBy: { startAt: 'asc' } });
    res.json({ success: true, data: events });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/events
router.post('/events', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { contactId, dealId, title, description, startAt, endAt, location, type, status, attendees } = req.body || {};
    if (!title || !startAt) return res.status(400).json({ error: 'Title and startAt are required' });
    const event = await prisma.calendarEvent.create({ data: { managerId: profile.id, contactId, dealId, title, description, startAt: new Date(startAt), endAt: endAt ? new Date(endAt) : null, location, type: type || 'MEETING', status: status || 'SCHEDULED', attendees } });
    res.status(201).json({ success: true, data: event });
  } catch (e: any) {
    console.error('[crm] create event failed:', e.message);
    res.status(500).json({ error: 'Could not create event' });
  }
});

// PATCH /api/v1/crm/events/:id
router.patch('/events/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const event = await prisma.calendarEvent.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const { startAt, endAt, ...rest } = req.body || {};
    const data: any = { ...rest };
    if (startAt) data.startAt = new Date(startAt);
    if (endAt) data.endAt = new Date(endAt);
    const updated = await prisma.calendarEvent.update({ where: { id: event.id }, data });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update event' });
  }
});

// DELETE /api/v1/crm/events/:id
router.delete('/events/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const event = await prisma.calendarEvent.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await prisma.calendarEvent.delete({ where: { id: event.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete event' });
  }
});

// ── Integrations ──────────────────────────────────────────────────────────────

// GET /api/v1/crm/integrations
router.get('/integrations', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const integrations = await prisma.integration.findMany({ where: { managerId: profile.id } });
    res.json({ success: true, data: integrations });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/integrations
router.post('/integrations', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { type, name, config, isActive } = req.body || {};
    if (!type || !name) return res.status(400).json({ error: 'Type and name are required' });
    const integration = await prisma.integration.create({ data: { managerId: profile.id, type, name, config, isActive: isActive ?? true } });
    res.status(201).json({ success: true, data: integration });
  } catch (e: any) {
    console.error('[crm] create integration failed:', e.message);
    res.status(500).json({ error: 'Could not create integration' });
  }
});

// PATCH /api/v1/crm/integrations/:id
router.patch('/integrations/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const integration = await prisma.integration.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    const updated = await prisma.integration.update({ where: { id: integration.id }, data: req.body || {} });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update integration' });
  }
});

// DELETE /api/v1/crm/integrations/:id
router.delete('/integrations/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const integration = await prisma.integration.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    await prisma.integration.delete({ where: { id: integration.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete integration' });
  }
});

// ── API Keys ──────────────────────────────────────────────────────────────────

// GET /api/v1/crm/api-keys
router.get('/api-keys', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const keys = await prisma.apiKey.findMany({ where: { managerId: profile.id } });
    res.json({ success: true, data: keys });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/crm/api-keys
router.post('/api-keys', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { name, permissions, expiresAt } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const key = `pab_${Buffer.from(`${profile.id}:${Date.now()}:${Math.random()}`).toString('base64url').slice(0, 32)}`;
    const apiKey = await prisma.apiKey.create({ data: { managerId: profile.id, name, key, permissions, expiresAt: expiresAt ? new Date(expiresAt) : null } });
    res.status(201).json({ success: true, data: apiKey });
  } catch (e: any) {
    console.error('[crm] create api key failed:', e.message);
    res.status(500).json({ error: 'Could not create API key' });
  }
});

// DELETE /api/v1/crm/api-keys/:id
router.delete('/api-keys/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const apiKey = await prisma.apiKey.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!apiKey) return res.status(404).json({ error: 'API key not found' });
    await prisma.apiKey.delete({ where: { id: apiKey.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not delete API key' });
  }
});

// ── AI Insights ───────────────────────────────────────────────────────────────

// GET /api/v1/crm/ai/insights
router.get('/ai/insights', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const { type, isRead, limit } = req.query;
    const where: any = { managerId: profile.id };
    if (type) where.type = type as string;
    if (isRead !== undefined) where.isRead = isRead === 'true';
    const insights = await prisma.aIInsight.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit ? parseInt(limit as string) : 50 });
    res.json({ success: true, data: insights });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/crm/ai/insights/:id/read
router.patch('/ai/insights/:id/read', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const insight = await prisma.aIInsight.findFirst({ where: { id: req.params.id, managerId: profile.id } });
    if (!insight) return res.status(404).json({ error: 'Insight not found' });
    const updated = await prisma.aIInsight.update({ where: { id: insight.id }, data: { isRead: true } });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not update insight' });
  }
});

// POST /api/v1/crm/ai/next-action/:contactId
router.post('/ai/next-action/:contactId', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const contact = await prisma.contact.findFirst({ where: { id: req.params.contactId, managerId: profile.id } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const actions: any[] = [];
    if (contact.status === 'LEAD') {
      actions.push({ actionType: 'EMAIL', title: 'Send welcome email', description: 'New leads respond best within 5 minutes', priority: 'HIGH', reasoning: 'Lead is new and untouchted' });
    }
    if (contact.status === 'PROSPECT') {
      actions.push({ actionType: 'CALL', title: 'Schedule discovery call', description: 'Prospects who get calls have 2x conversion rate', priority: 'HIGH', reasoning: 'Engagement score indicates interest' });
    }
    actions.push({ actionType: 'TASK', title: 'Add to follow-up sequence', description: 'Automated nurture sequence for this contact', priority: 'MEDIUM', reasoning: 'Consistent follow-up improves close rate' });
    if (actions.length === 0) {
      actions.push({ actionType: 'FOLLOW_UP', title: 'Check in on existing deal', description: 'Review deal stage and update notes', priority: 'MEDIUM', reasoning: 'No urgent actions detected' });
    }
    const created = await prisma.nextBestAction.createMany({ data: actions.map(a => ({ ...a, managerId: profile.id, contactId: contact.id })) });
    res.json({ success: true, data: actions });
  } catch (e: any) {
    console.error('[crm] ai next action failed:', e.message);
    res.status(500).json({ error: 'Could not generate next action' });
  }
});

// POST /api/v1/crm/ai/score/:contactId
router.post('/ai/score/:contactId', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const contact = await prisma.contact.findFirst({ where: { id: req.params.contactId, managerId: profile.id } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    let score = 50;
    if (contact.source === 'WEBSITE') score += 10;
    if (contact.source === 'REFERRAL') score += 20;
    if (contact.status === 'LEAD') score += 5;
    if (contact.status === 'PROSPECT') score += 15;
    if (contact.status === 'CUSTOMER') score += 30;
    score = Math.min(100, Math.max(0, score));
    const prediction = await prisma.leadScorePrediction.create({ data: { managerId: profile.id, contactId: contact.id, score, confidence: 0.75, modelVersion: 'v1', features: { source: contact.source, status: contact.status }, explanation: `Score based on source (${contact.source}) and status (${contact.status})` } });
    res.json({ success: true, data: prediction });
  } catch (e: any) {
    console.error('[crm] ai score failed:', e.message);
    res.status(500).json({ error: 'Could not generate score' });
  }
});

// POST /api/v1/crm/ai/email-draft
router.post('/ai/email-draft', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { contactId, context, tone } = req.body || {};
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });
    const profile = await prisma.propertyManagerProperty.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Not enrolled' });
    const contact = await prisma.contact.findFirst({ where: { id: contactId, managerId: profile.id } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const subject = `Following up on our conversation`;
    const body = `Hi ${contact.firstName || 'there'},\n\nI hope this message finds you well. I wanted to follow up on our recent conversation and see if you have any questions.\n\nBest regards,\n${profile.companyName || 'Team'}`;
    res.json({ success: true, data: { subject, body, tone: tone || 'professional' } });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not generate email draft' });
  }
});

export default router;
