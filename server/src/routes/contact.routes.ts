import { Router } from 'express';
import { prisma } from '../utils/database';

const router = Router();

// ── CONTACTS (unified view of all contacts/leads/deals) ──

router.get('/contacts', async (req, res) => {
  try {
    const leads = await prisma.crmClient.findMany({
      orderBy: { createdAt: 'desc' },
      include: { deals: true, activities: true },
    });
    res.json({ success: true, data: leads });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const { name, email, phone, source, value, notes } = req.body;
    const lead = await prisma.crmClient.create({
      data: {
        name, email, phone, notes: notes || null,
        businessId: 'default',
        customData: { source, value: value ? Number(value) : null, stage: 'new', ownerId: 'system' }
      },
    });
    res.status(201).json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const { name, email, phone, stage, value, company, notes } = req.body;
    const existing = await prisma.crmClient.findUnique({ where: { id: req.params.id } });
    const customData: Record<string, any> = (existing?.customData as Record<string, any>) || {};
    if (stage !== undefined) customData.stage = stage;
    if (value !== undefined) customData.value = value;
    if (company !== undefined) customData.company = company;

    const lead = await prisma.crmClient.update({
      where: { id: req.params.id },
      data: { name, email, phone, notes, customData },
    });
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    await prisma.crmClient.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/contacts/:id/activities', async (req, res) => {
  try {
    const activities = await prisma.crmActivity.findMany({
      where: { clientId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: activities });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/contacts/:id/deals', async (req, res) => {
  try {
    const deals = await prisma.crmDeal.findMany({
      where: { clientId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: deals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/leads', async (req, res) => {
  try {
    const leads = await prisma.crmClient.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: leads });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/leads', async (req, res) => {
  try {
    const { name, email, phone, source, value, businessId, ownerId, passportId } = req.body;
    const lead = await prisma.crmClient.create({
      data: {
        name,
        email,
        phone,
        businessId: businessId || 'default',
        passportId: passportId || null,
        customData: { source, value, ownerId: ownerId || 'system', stage: 'new' },
      },
    });
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/leads/:id', async (req, res) => {
  try {
    const lead = await prisma.crmClient.findUnique({
      where: { id: req.params.id },
      include: { deals: true, activities: true },
    });
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/leads/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    const existing = await prisma.crmClient.findUnique({ where: { id: req.params.id } });
    const customData: Record<string, any> = (existing?.customData as Record<string, any>) || {};
    customData.stage = stage;
    
    const lead = await prisma.crmClient.update({
      where: { id: req.params.id },
      data: { customData },
    });
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DEALS ────────────────────────────────────────────

router.get('/deals', async (req, res) => {
  try {
    const deals = await prisma.crmDeal.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: deals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/deals', async (req, res) => {
  try {
    const { leadId, title, amount, stage, closeDate, escrowId } = req.body;
    const deal = await prisma.crmDeal.create({
      data: {
        clientId: leadId,
        businessId: 'default',
        title,
        value: amount,
        stage: stage || 'LEAD',
        expectedCloseDate: closeDate ? new Date(closeDate) : null,
        notes: escrowId ? `escrowId: ${escrowId}` : null,
      },
    });
    res.json({ success: true, data: deal });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── ACTIVITIES ───────────────────────────────────────

router.post('/activities', async (req, res) => {
  try {
    const { leadId, type, content, dueAt } = req.body;
    const activity = await prisma.crmActivity.create({
      data: {
        clientId: leadId,
        businessId: 'default',
        type: type || 'NOTE',
        title: type || 'NOTE',
        description: content,
        dueDate: dueAt ? new Date(dueAt) : null,
      },
    });
    res.json({ success: true, data: activity });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── STATS ────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const leads = await prisma.crmClient.count();
    const deals = await prisma.crmDeal.count();
    const activities = await prisma.crmActivity.count();
    res.json({ success: true, data: { leads, deals, activities } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
