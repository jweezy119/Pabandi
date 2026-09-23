import { Router } from 'express';
import { prisma } from '../utils/database';

const router = Router();

// ── CONTACTS (unified view of all contacts/leads/deals) ──

router.get('/contacts', async (req, res) => {
  try {
    const leads = await prisma.contactLead.findMany({
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
    const lead = await prisma.contactLead.create({
      data: {
        name, email, phone, source, value: value ? Number(value) : null,
        notes: notes || null,
        businessId: 'default', ownerId: 'system', passportId: '',
        stage: 'new',
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
    const lead = await prisma.contactLead.update({
      where: { id: req.params.id },
      data: { name, email, phone, stage, value, company, notes },
    });
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    await prisma.contactLead.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/contacts/:id/activities', async (req, res) => {
  try {
    const activities = await prisma.contactActivity.findMany({
      where: { leadId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: activities });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/contacts/:id/deals', async (req, res) => {
  try {
    const deals = await prisma.contactDeal.findMany({
      where: { leadId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: deals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/leads', async (req, res) => {
  try {
    const leads = await prisma.contactLead.findMany({
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
    const lead = await prisma.contactLead.create({
      data: {
        name,
        email,
        phone,
        source,
        value,
        businessId: businessId || 'default',
        ownerId: ownerId || 'system',
        passportId: passportId || '',
        stage: 'new',
      },
    });
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/leads/:id', async (req, res) => {
  try {
    const lead = await prisma.contactLead.findUnique({
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
    const lead = await prisma.contactLead.update({
      where: { id: req.params.id },
      data: { stage },
    });
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DEALS ────────────────────────────────────────────

router.get('/deals', async (req, res) => {
  try {
    const deals = await prisma.contactDeal.findMany({
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
    const deal = await prisma.contactDeal.create({
      data: {
        leadId,
        title,
        amount,
        stage: stage || 'open',
        closeDate: closeDate ? new Date(closeDate) : null,
        escrowId,
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
    const activity = await prisma.contactActivity.create({
      data: {
        leadId,
        type,
        content,
        dueAt: dueAt ? new Date(dueAt) : null,
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
    const leads = await prisma.contactLead.count();
    const deals = await prisma.contactDeal.count();
    const activities = await prisma.contactActivity.count();
    res.json({ success: true, data: { leads, deals, activities } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
