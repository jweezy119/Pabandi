import { Router } from 'express';
import { prisma } from '../utils/database';

const router = Router();

// ── LEADS ────────────────────────────────────────────

router.get('/leads', async (req, res) => {
  try {
    const leads = await prisma.pipelineLead.findMany({
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
    const lead = await prisma.pipelineLead.create({
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
    const lead = await prisma.pipelineLead.findUnique({
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
    const lead = await prisma.pipelineLead.update({
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
    const deals = await prisma.pipelineDeal.findMany({
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
    const deal = await prisma.pipelineDeal.create({
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
    const activity = await prisma.pipelineActivity.create({
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
    const leads = await prisma.pipelineLead.count();
    const deals = await prisma.pipelineDeal.count();
    const activities = await prisma.pipelineActivity.count();
    res.json({ success: true, data: { leads, deals, activities } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
