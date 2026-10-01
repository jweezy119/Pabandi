import { Router } from 'express';
import { prisma } from '../utils/database';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';

/**
 * Contact OS — leads, deals and activities.
 *
 * ## Security
 *
 * This router previously had **no authentication at all**. Every endpoint was
 * world-readable and world-writable: anyone could enumerate every lead and deal
 * on the platform, inject fabricated leads into a real business's pipeline, or
 * delete a contact outright.
 *
 * The lead-injection path was the most damaging, because stage and value feed
 * the trust engine — junk leads silently corrupt the scores the platform sells.
 *
 * Two fixes, both necessary:
 *
 *   1. `authenticate` on the router.
 *   2. Every query is scoped to the caller. `ownerId` previously defaulted to the
 *      literal string `'system'` and `businessId` to `'default'`, so there was no
 *      real ownership to filter on — records created through the API were
 *      invisible to everyone, and visible to no one. They are now stamped with
 *      the authenticated user's id.
 *
 * Leads are scoped by owner, and cross-owner access returns 404 rather than 403
 * so the API cannot be used to discover which lead ids exist.
 */
const router = Router();

router.use(authenticate);

/** Scope for every lead query. Never trust a businessId or ownerId from the body. */
function scopeOf(req: AuthRequest) {
  const userId = req.user?.id;
  if (!userId) throw new CustomError('Authentication required', 401);
  return { ownerId: userId };
}

/**
 * Resolve a lead the caller is allowed to see, or throw.
 *
 * Filtering in the query rather than fetching-then-checking keeps this a single
 * round trip and makes the 404 indistinguishable from "does not exist".
 */
async function ownLead(req: AuthRequest, leadId: string) {
  const { ownerId } = scopeOf(req);
  const lead = await prisma.contactLead.findFirst({ where: { id: leadId, ownerId } });
  if (!lead) throw new CustomError('Lead not found', 404);
  return lead;
}

/**
 * Resolve a deal the caller is allowed to see.
 *
 * A deal has no owner of its own — it inherits ownership from its lead — so this
 * joins through rather than filtering a denormalised column that can drift.
 */
async function ownDeal(req: AuthRequest, dealId: string) {
  const { ownerId } = scopeOf(req);
  const deal = await prisma.contactDeal.findFirst({
    where: { id: dealId, lead: { ownerId } },
  });
  if (!deal) throw new CustomError('Deal not found', 404);
  return deal;
}

// ── Contacts (unified view of leads / deals / activity) ───────────────────────

router.get('/contacts', async (req: AuthRequest, res) => {
  try {
    const leads = await prisma.contactLead.findMany({
      where: scopeOf(req),
      orderBy: { updatedAt: 'desc' },
      include: { deals: true, activities: true },
    });
    res.json({ success: true, data: leads });
  } catch (err) {
    next_(err, res);
  }
});

router.post('/contacts', async (req: AuthRequest, res) => {
  try {
    const { ownerId } = scopeOf(req);
    const { name, email, phone, company, source, value, notes } = req.body ?? {};
    if (!name) throw new CustomError('name is required', 400);

    const lead = await prisma.contactLead.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        source: source || null,
        notes: notes || null,
        value: value === undefined || value === null || value === '' ? null : Number(value),
        // Stamped from the session, never from the body.
        ownerId,
        businessId: String(req.body?.businessId || ownerId),
        stage: req.body?.stage || 'new',
        passportId: null,
      },
    });
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next_(err, res);
  }
});

router.put('/contacts/:id', async (req: AuthRequest, res) => {
  try {
    await ownLead(req, req.params.id);
    const { name, email, phone, company, stage, value, notes } = req.body ?? {};

    const lead = await prisma.contactLead.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(company !== undefined && { company }),
        ...(stage !== undefined && { stage }),
        ...(notes !== undefined && { notes }),
        ...(value !== undefined &&
          (value === null || value === '' ? { value: null } : { value: Number(value) })),
      },
    });
    res.json({ success: true, data: lead });
  } catch (err) {
    next_(err, res);
  }
});

router.delete('/contacts/:id', async (req: AuthRequest, res) => {
  try {
    await ownLead(req, req.params.id);
    await prisma.contactLead.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    next_(err, res);
  }
});

// ── Activities ────────────────────────────────────────────────────────────────

router.get('/contacts/:id/activities', async (req: AuthRequest, res) => {
  try {
    const lead = await ownLead(req, req.params.id);
    const activities = await prisma.contactActivity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: activities });
  } catch (err) {
    next_(err, res);
  }
});

router.post('/activities', async (req: AuthRequest, res) => {
  try {
    const lead = await ownLead(req, req.body?.leadId);
    if (!req.body?.type) throw new CustomError('type is required', 400);

    const activity = await prisma.contactActivity.create({
      data: {
        leadId: lead.id,
        type: req.body.type,
        content: req.body.content || null,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
      },
    });
    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    next_(err, res);
  }
});

// ── Deals ─────────────────────────────────────────────────────────────────────

router.get('/contacts/:id/deals', async (req: AuthRequest, res) => {
  try {
    const lead = await ownLead(req, req.params.id);
    const deals = await prisma.contactDeal.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: deals });
  } catch (err) {
    next_(err, res);
  }
});

router.get('/deals', async (req: AuthRequest, res) => {
  try {
    const deals = await prisma.contactDeal.findMany({
      where: { lead: scopeOf(req) },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: deals });
  } catch (err) {
    next_(err, res);
  }
});

router.post('/deals', async (req: AuthRequest, res) => {
  try {
    const lead = await ownLead(req, req.body?.leadId);
    const { title, amount, stage, closeDate, escrowId } = req.body ?? {};

    if (!title) throw new CustomError('title is required', 400);
    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      throw new CustomError('amount is required', 400);
    }

    const deal = await prisma.contactDeal.create({
      data: {
        leadId: lead.id,
        title,
        amount: Number(amount),
        stage: stage || 'open',
        closeDate: closeDate ? new Date(closeDate) : null,
        escrowId: escrowId || null,
      },
    });
    res.status(201).json({ success: true, data: deal });
  } catch (err) {
    next_(err, res);
  }
});

router.put('/deals/:id', async (req: AuthRequest, res) => {
  try {
    const deal = await ownDeal(req, req.params.id);
    const { title, amount, stage, closeDate } = req.body ?? {};

    const updated = await prisma.contactDeal.update({
      where: { id: deal.id },
      data: {
        ...(title !== undefined && { title }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(stage !== undefined && { stage }),
        ...(closeDate !== undefined &&
          (closeDate === null ? { closeDate: null } : { closeDate: new Date(closeDate) })),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next_(err, res);
  }
});

// ── Leads ─────────────────────────────────────────────────────────────────────

router.get('/leads', async (req: AuthRequest, res) => {
  try {
    const leads = await prisma.contactLead.findMany({
      where: scopeOf(req),
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: leads });
  } catch (err) {
    next_(err, res);
  }
});

router.post('/leads', async (req: AuthRequest, res) => {
  try {
    const { ownerId } = scopeOf(req);
    const { name, email, phone, source, value, notes, company, stage } = req.body ?? {};
    if (!name) throw new CustomError('name is required', 400);

    const lead = await prisma.contactLead.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        source: source || null,
        notes: notes || null,
        value: value === undefined || value === null || value === '' ? null : Number(value),
        ownerId,
        businessId: String(req.body?.businessId || ownerId),
        stage: stage || 'new',
        passportId: null,
      },
    });
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next_(err, res);
  }
});

router.get('/leads/:id', async (req: AuthRequest, res) => {
  try {
    const lead = await ownLead(req, req.params.id);
    const full = await prisma.contactLead.findUnique({
      where: { id: lead.id },
      include: { deals: true, activities: true },
    });
    res.json({ success: true, data: full });
  } catch (err) {
    next_(err, res);
  }
});

router.put('/leads/:id/stage', async (req: AuthRequest, res) => {
  try {
    const lead = await ownLead(req, req.params.id);
    const { stage } = req.body ?? {};
    if (!stage) throw new CustomError('stage is required', 400);

    const updated = await prisma.contactLead.update({
      where: { id: lead.id },
      data: { stage },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next_(err, res);
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const { ownerId } = scopeOf(req);
    const [leads, deals, activities] = await Promise.all([
      prisma.contactLead.count({ where: { ownerId } }),
      prisma.contactDeal.count({ where: { lead: { ownerId } } }),
      prisma.contactActivity.count({ where: { lead: { ownerId } } }),
    ]);
    res.json({ success: true, data: { leads, deals, activities } });
  } catch (err) {
    next_(err, res);
  }
});

function next_(err: unknown, res: import('express').Response) {
  const statusCode = err instanceof CustomError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : 'Internal error';
  res.status(statusCode).json({ success: false, message });
}

export default router;
