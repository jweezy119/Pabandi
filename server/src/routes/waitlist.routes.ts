import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

let db: admin.firestore.Firestore;
const getDb = () => {
  if (!db) db = admin.firestore();
  return db;
};

// ── POST /waitlist — public, accepts both waitlist & city landing page format ──
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, phone, whatsapp, city, cityOther, role, why, businessName, type,
            userId, userEmail, utm_source, utm_medium, utm_campaign, utm_content, location } = req.body;

    const cityResolved = city === 'other' ? cityOther : (city || location || null);
    const isBusinessLead = role === 'Business' || !!businessName;

    const ref = await getDb().collection('waitlist').add({
      name, phone: phone || whatsapp || null,
      city: cityResolved, role: role || 'Customer', why: why || null,
      businessName: businessName || null, businessType: type || null,
      userId: userId || null, userEmail: userEmail || null,
      utm_source: utm_source || null, utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null, utm_content: utm_content || null,
      createdAt: new Date().toISOString(),
      // ── Outreach pipeline ──
      outreachStatus: 'NEW',   // NEW | CONTACTED | DEMO_SCHEDULED | ONBOARDED | NOT_INTERESTED
      outreachAttempts: 0,
      lastContactedAt: null,
      notes: null,
      isBusinessLead,
    });

    res.json({ success: true, message: 'Welcome to Pabandi!', id: ref.id });
  } catch (error) {
    console.error('Waitlist error:', error);
    res.status(500).json({ success: false, error: 'Failed to join waitlist' });
  }
});

// ── GET /waitlist/count — public ──────────────────────────────────────────────
router.get('/count', async (_req: Request, res: Response) => {
  try {
    const snapshot = await getDb().collection('waitlist').count().get();
    res.json({ count: snapshot.data().count });
  } catch {
    res.json({ count: 847 });
  }
});

// ── GET /waitlist/leads — ADMIN: list leads with filters ─────────────────────
router.get('/leads', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

    const { city, status, businessOnly, limit = '200' } = req.query;

    let query: admin.firestore.Query = getDb().collection('waitlist')
      .orderBy('createdAt', 'desc').limit(Number(limit));

    // Firestore can only filter on one field at a time without composite index
    // so we filter city or status, then post-filter the rest
    if (city && !status) query = query.where('city', '==', city);
    if (status && !city) query = query.where('outreachStatus', '==', status);

    const snapshot = await query.get();
    let leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Record<string, any> }));

    if (city && status) leads = leads.filter((l: any) => l.city === city && l.outreachStatus === status);
    if (businessOnly === 'true') leads = leads.filter((l: any) => l.isBusinessLead);

    return res.json({ success: true, leads, total: leads.length });
  } catch (error) {
    console.error('Leads fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch leads' });
  }
});

// ── PATCH /waitlist/leads/:id — ADMIN: update outreach status / notes ─────────
router.patch('/leads/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

    const { id } = req.params;
    const { outreachStatus, notes, incrementAttempt } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (outreachStatus) updates.outreachStatus = outreachStatus;
    if (notes !== undefined) updates.notes = notes;
    if (incrementAttempt) {
      const doc = await getDb().collection('waitlist').doc(id).get();
      updates.outreachAttempts = (doc.data()?.outreachAttempts || 0) + 1;
      updates.lastContactedAt = new Date().toISOString();
    }

    await getDb().collection('waitlist').doc(id).update(updates);
    return res.json({ success: true });
  } catch (error) {
    console.error('Lead update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update lead' });
  }
});

// ── GET /waitlist/outreach-summary — ADMIN: pipeline KPIs ────────────────────
router.get('/outreach-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

    const snapshot = await getDb().collection('waitlist').get();
    const leads = snapshot.docs.map(d => d.data());

    const byStatus = {
      NEW: leads.filter(l => !l.outreachStatus || l.outreachStatus === 'NEW').length,
      CONTACTED: leads.filter(l => l.outreachStatus === 'CONTACTED').length,
      DEMO_SCHEDULED: leads.filter(l => l.outreachStatus === 'DEMO_SCHEDULED').length,
      ONBOARDED: leads.filter(l => l.outreachStatus === 'ONBOARDED').length,
      NOT_INTERESTED: leads.filter(l => l.outreachStatus === 'NOT_INTERESTED').length,
    };

    const byCity = leads.reduce((acc: Record<string, number>, l) => {
      const c = l.city || 'Unknown';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      summary: {
        total: leads.length,
        businessLeads: leads.filter(l => l.isBusinessLead).length,
        byStatus, byCity,
        conversionRate: leads.length > 0
          ? ((byStatus.ONBOARDED / leads.length) * 100).toFixed(1) : '0.0',
      },
    });
  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

export default router;
