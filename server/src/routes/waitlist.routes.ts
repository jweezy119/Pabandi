import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { openwaService } from '../services/openwa.service';
import { loadPluginCatalog, scorePlugin, selectPlugins, buildPluginSummary } from '../services/openwa.plugins.service';

const router = Router();

let db: admin.firestore.Firestore;
const getDb = () => {
  if (!db) db = admin.firestore();
  return db;
};

const CITY_KEYWORDS = ['karachi', 'lahore', 'islamabad', 'dubai', 'london', 'new york', 'chicago', 'singapore', 'toronto'];
const BUSINESS_KEYWORDS = ['hotel', 'lodge', 'resort', 'restaurant', 'cafe', 'salon', 'clinic', 'spa', 'fitness', 'property', 'rental', 'host'];

function computeLeadScore(lead: { name?: string | null; phone?: string | null; city?: string | null; role?: string | null; businessName?: string | null; why?: string | null; businessType?: string | null }): number {
  const text = [lead.city, lead.role, lead.businessName, lead.why, lead.businessType, lead.phone]
    .map(value => String(value || ''))
    .join(' ')
    .toLowerCase();

  let score = 40;
  if (lead.phone) score += 10;
  if (lead.city && CITY_KEYWORDS.some(keyword => text.includes(keyword))) score += 10;
  if (lead.businessName || (lead.role || '').toLowerCase() === 'business') score += 15;
  if (BUSINESS_KEYWORDS.some(keyword => text.includes(keyword))) score += 10;
  if ((lead.why || '').length >= 20) score += 5;
  if ((lead.why || '').length >= 60) score += 5;

  return Math.min(100, Math.max(0, score));
}

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
      score: computeLeadScore({ name, phone, city: cityResolved, role, businessName, why, businessType: type }),
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
        avgScore: leads.length > 0 ? (leads.reduce((sum, l) => sum + Number(l.score || 0), 0) / leads.length).toFixed(1) : '0.0',
      },
    });
  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

// ── GET /waitlist/lead-outreach/:id — ADMIN: scored plugin outreach preview ─────
router.get('/lead-outreach/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { id } = req.params;
    const doc = await getDb().collection('waitlist').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const lead = doc.data() as Record<string, unknown>;

    const normalizeValue = (input: unknown) => (Array.isArray(input) ? input : [input])
      .map(value => String(value).trim())
      .filter(Boolean);

    const keywords = normalizeValue([
      lead.city,
      lead.role,
      lead.businessType,
      lead.businessName,
      lead.why,
    ]);

    const context = {
      city: String(lead.city ?? ''),
      businessName: String(lead.businessName ?? ''),
      role: String(lead.role ?? ''),
      businessType: String(lead.businessType ?? ''),
    };

    const plugins = selectPlugins(keywords, context, 3);
    const summary = buildPluginSummary(plugins);

    const greeting = [
      `Pabandi outreach for${lead.businessName ? ` *${String(lead.businessName)}*` : ' your business'}.`,
      '',
      '1) Claim your profile',
      '2) View bookings',
      '3) Enable escrow + Web3 reliability',
    ]
      .filter(Boolean)
      .join('\n');

    const baseMessage = `${greeting}\n\nBookings are easier with verified attendance, escrow protection, and Pabandi Trust scoring.`;

    const outreachBody = summary ? `${baseMessage}\n\n${summary}` : baseMessage;

    return res.json({
      success: true,
      data: {
        id,
        lead,
        keywords,
        plugins,
        outreachBody,
      },
    });
  } catch (error) {
    console.error('Plugin outreach preview error:', error);
    return res.status(500).json({ success: false, error: 'Failed to build outreach preview' });
  }
});

// ── POST /waitlist/lead/:id/send-whatsapp — ADMIN: send scored outreach via OpenWA ──
router.post('/lead/:id/send-whatsapp', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { id } = req.params;
    const { to, sessionId } = req.body as { to?: string; sessionId?: string };

    const doc = await getDb().collection('waitlist').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const lead = doc.data() as Record<string, unknown>;

    const fallbackPhone = String(lead.phone ?? lead.whatsapp ?? '');
    const destination = (to || fallbackPhone || '').trim();

    if (!destination) {
      return res.status(400).json({ success: false, error: 'to is required' });
    }

    const normalizeValue = (input: unknown) => (Array.isArray(input) ? input : [input])
      .map(value => String(value).trim())
      .filter(Boolean);

    const keywords = normalizeValue([
      lead.city,
      lead.role,
      lead.businessType,
      lead.businessName,
      lead.why,
    ]);

    const context = {
      city: String(lead.city ?? ''),
      businessName: String(lead.businessName ?? ''),
      role: String(lead.role ?? ''),
      businessType: String(lead.businessType ?? ''),
    };

    const plugins = selectPlugins(keywords, context, 3);
    const summary = buildPluginSummary(plugins);

    const personName = String(lead.name ?? '').trim();
    const businessName = String(lead.businessName ?? '').trim();

    const greeting =
      personName || businessName
        ? `Hi ${personName || businessName}!`
        : 'Hello!';

    const body = [
      greeting,
      '',
      "You're missing bookings on Pabandi.",
      '',
      businessName
        ? `${businessName} is not yet fully set up for verified bookings, escrow deposits, and Pabandi Trust scoring.`
        : 'Your location is not yet fully set up for verified bookings, escrow deposits, and Pabandi Trust scoring.',
      '',
      'Claim your profile free to accept bookings and eliminate no-shows:',
      'https://pabandi.com/business/claim',
      '',
      summary,
    ]
      .filter(Boolean)
      .join('\n');

    const resolvedSessionId = sessionId || process.env.OPENWA_SESSION_ID || process.env.OPENWA_SESSION || 'default';
    const openwaUrl = `${(process.env.OPENWA_API_URL || 'http://localhost:2785/api').replace(/\/$/, '')}/sessions/${encodeURIComponent(resolvedSessionId)}/messages/send-text`;

    const response = await fetch(openwaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.OPENWA_API_KEY ? { 'X-API-Key': process.env.OPENWA_API_KEY } : {}),
      },
      body: JSON.stringify({
        to: destination.replace(/[^0-9]/g, '') + '@c.us',
        text: body,
        pluginContext: 'pabandi:plugin-catalog-outreach',
      }),
    });

    const result = await response.json().catch(() => ({}));

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      outreachAttempts: Number(lead.outreachAttempts ?? 0) + (response.ok ? 1 : 0),
      lastContactedAt: response.ok ? new Date().toISOString() : (lead.lastContactedAt ?? null),
      outreachStatus: ((lead.outreachStatus as string) || 'NEW').toUpperCase(),
      lastOutreachChannel: 'whatsapp-openwa',
      lastOutreachBody: body,
      lastOutreachPlugins: plugins.map(plugin => plugin.id),
      lastOutreachKeywords: keywords,
      lastOutreachDestination: destination,
    };

    if (response.ok) {
      updates.outreachStatus = 'CONTACTED';
    }

    await getDb().collection('waitlist').doc(id).update(updates);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: result?.message || 'OpenWA gateway rejected the send request',
        gateway: result,
      });
    }

    return res.json({
      success: true,
      data: {
        to: destination,
        sessionId: resolvedSessionId,
        outreachBody: body,
        plugins,
        gateway: result,
      },
    });
  } catch (error) {
    console.error('OpenWA outreach send error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send WhatsApp outreach' });
  }
});

export default router;
