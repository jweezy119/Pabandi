"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin = __importStar(require("firebase-admin"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const whatsapp_service_1 = require("../services/whatsapp.service");
const openwa_plugins_service_1 = require("../services/openwa.plugins.service");
const router = (0, express_1.Router)();
let db;
const getDb = () => {
    if (!db)
        db = admin.firestore();
    return db;
};
const CITY_KEYWORDS = ['karachi', 'lahore', 'islamabad', 'dubai', 'london', 'new york', 'chicago', 'singapore', 'toronto'];
const BUSINESS_KEYWORDS = ['hotel', 'lodge', 'resort', 'restaurant', 'cafe', 'salon', 'clinic', 'spa', 'fitness', 'property', 'rental', 'host'];
function computeLeadScore(lead) {
    const text = [lead.city, lead.role, lead.businessName, lead.why, lead.businessType, lead.phone]
        .map(value => String(value || ''))
        .join(' ')
        .toLowerCase();
    let score = 40;
    if (lead.phone)
        score += 10;
    if (lead.city && CITY_KEYWORDS.some(keyword => text.includes(keyword)))
        score += 10;
    if (lead.businessName || (lead.role || '').toLowerCase() === 'business')
        score += 15;
    if (BUSINESS_KEYWORDS.some(keyword => text.includes(keyword)))
        score += 10;
    if ((lead.why || '').length >= 20)
        score += 5;
    if ((lead.why || '').length >= 60)
        score += 5;
    return Math.min(100, Math.max(0, score));
}
// ── POST /waitlist — public, accepts both waitlist & city landing page format ──
router.post('/', async (req, res) => {
    try {
        const { name, phone, whatsapp, city, cityOther, role, why, businessName, type, userId, userEmail, utm_source, utm_medium, utm_campaign, utm_content, location } = req.body;
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
            outreachStatus: 'NEW', // NEW | CONTACTED | DEMO_SCHEDULED | ONBOARDED | NOT_INTERESTED
            outreachAttempts: 0,
            lastContactedAt: null,
            notes: null,
            isBusinessLead,
            score: computeLeadScore({ name, phone, city: cityResolved, role, businessName, why, businessType: type }),
        });
        res.json({ success: true, message: 'Welcome to Pabandi!', id: ref.id });
    }
    catch (error) {
        console.error('Waitlist error:', error);
        res.status(500).json({ success: false, error: 'Failed to join waitlist' });
    }
});
// ── GET /waitlist/count — public ──────────────────────────────────────────────
router.get('/count', async (_req, res) => {
    try {
        const snapshot = await getDb().collection('waitlist').count().get();
        res.json({ count: snapshot.data().count });
    }
    catch {
        res.json({ count: 847 });
    }
});
// ── GET /waitlist/leads — ADMIN: list leads with filters ─────────────────────
router.get('/leads', auth_middleware_1.authenticate, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN')
            return res.status(403).json({ error: 'Admin only' });
        const { city, status, businessOnly, limit = '200' } = req.query;
        let query = getDb().collection('waitlist')
            .orderBy('createdAt', 'desc').limit(Number(limit));
        // Firestore can only filter on one field at a time without composite index
        // so we filter city or status, then post-filter the rest
        if (city && !status)
            query = query.where('city', '==', city);
        if (status && !city)
            query = query.where('outreachStatus', '==', status);
        const snapshot = await query.get();
        let leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (city && status)
            leads = leads.filter((l) => l.city === city && l.outreachStatus === status);
        if (businessOnly === 'true')
            leads = leads.filter((l) => l.isBusinessLead);
        return res.json({ success: true, leads, total: leads.length });
    }
    catch (error) {
        console.error('Leads fetch error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch leads' });
    }
});
// ── PATCH /waitlist/leads/:id — ADMIN: update outreach status / notes ─────────
router.patch('/leads/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN')
            return res.status(403).json({ error: 'Admin only' });
        const { id } = req.params;
        const { outreachStatus, notes, incrementAttempt } = req.body;
        const updates = { updatedAt: new Date().toISOString() };
        if (outreachStatus)
            updates.outreachStatus = outreachStatus;
        if (notes !== undefined)
            updates.notes = notes;
        if (incrementAttempt) {
            const doc = await getDb().collection('waitlist').doc(id).get();
            updates.outreachAttempts = (doc.data()?.outreachAttempts || 0) + 1;
            updates.lastContactedAt = new Date().toISOString();
        }
        await getDb().collection('waitlist').doc(id).update(updates);
        return res.json({ success: true });
    }
    catch (error) {
        console.error('Lead update error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update lead' });
    }
});
// ── GET /waitlist/outreach-summary — ADMIN: pipeline KPIs ────────────────────
router.get('/outreach-summary', auth_middleware_1.authenticate, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN')
            return res.status(403).json({ error: 'Admin only' });
        const snapshot = await getDb().collection('waitlist').get();
        const leads = snapshot.docs.map(d => d.data());
        const byStatus = {
            NEW: leads.filter(l => !l.outreachStatus || l.outreachStatus === 'NEW').length,
            CONTACTED: leads.filter(l => l.outreachStatus === 'CONTACTED').length,
            DEMO_SCHEDULED: leads.filter(l => l.outreachStatus === 'DEMO_SCHEDULED').length,
            ONBOARDED: leads.filter(l => l.outreachStatus === 'ONBOARDED').length,
            NOT_INTERESTED: leads.filter(l => l.outreachStatus === 'NOT_INTERESTED').length,
        };
        const byCity = leads.reduce((acc, l) => {
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
    }
    catch (error) {
        console.error('Summary error:', error);
        return res.status(500).json({ success: false, error: 'Failed to get summary' });
    }
});
// ── GET /waitlist/lead-outreach/:id — ADMIN: scored plugin outreach preview ─────
router.get('/lead-outreach/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin only' });
        }
        const { id } = req.params;
        const doc = await getDb().collection('waitlist').doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }
        const lead = doc.data();
        const normalizeValue = (input) => (Array.isArray(input) ? input : [input])
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
        const plugins = (0, openwa_plugins_service_1.selectPlugins)(keywords, context, 3);
        const summary = (0, openwa_plugins_service_1.buildPluginSummary)(plugins);
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
    }
    catch (error) {
        console.error('Plugin outreach preview error:', error);
        return res.status(500).json({ success: false, error: 'Failed to build outreach preview' });
    }
});
// ── POST /waitlist/lead/:id/send-whatsapp — ADMIN: send scored outreach via OpenWA ──
router.post('/lead/:id/send-whatsapp', auth_middleware_1.authenticate, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin only' });
        }
        const { id } = req.params;
        const { to, sessionId } = req.body;
        const doc = await getDb().collection('waitlist').doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }
        const lead = doc.data();
        const fallbackPhone = String(lead.phone ?? lead.whatsapp ?? '');
        const destination = (to || fallbackPhone || '').trim();
        if (!destination) {
            return res.status(400).json({ success: false, error: 'to is required' });
        }
        const normalizeValue = (input) => (Array.isArray(input) ? input : [input])
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
        const plugins = (0, openwa_plugins_service_1.selectPlugins)(keywords, context, 3);
        const summary = (0, openwa_plugins_service_1.buildPluginSummary)(plugins);
        const personName = String(lead.name ?? '').trim();
        const businessName = String(lead.businessName ?? '').trim();
        const greeting = personName || businessName
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
        const result = await whatsapp_service_1.openwaService.sendText(destination, body, {
            sessionId: resolvedSessionId,
            pluginContext: 'pabandi:plugin-catalog-outreach',
        });
        const isSuccess = result.status !== 'failed';
        const updates = {
            updatedAt: new Date().toISOString(),
            outreachAttempts: Number(lead.outreachAttempts ?? 0) + (isSuccess ? 1 : 0),
            lastContactedAt: isSuccess ? new Date().toISOString() : (lead.lastContactedAt ?? null),
            outreachStatus: (lead.outreachStatus || 'NEW').toUpperCase(),
            lastOutreachChannel: 'whatsapp-openwa',
            lastOutreachBody: body,
            lastOutreachPlugins: plugins.map(plugin => plugin.id),
            lastOutreachKeywords: keywords,
            lastOutreachDestination: destination,
        };
        if (isSuccess) {
            updates.outreachStatus = 'CONTACTED';
        }
        await getDb().collection('waitlist').doc(id).update(updates);
        if (!isSuccess) {
            return res.status(502).json({
                success: false,
                error: 'OpenWA gateway rejected the send request',
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
    }
    catch (error) {
        console.error('OpenWA outreach send error:', error);
        return res.status(500).json({ success: false, error: 'Failed to send WhatsApp outreach' });
    }
});
exports.default = router;
//# sourceMappingURL=waitlist.routes.js.map