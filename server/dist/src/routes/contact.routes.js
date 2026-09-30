"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
function getBusinessId(req) {
    const businessId = req.body?.businessId || req.query?.businessId;
    if (!businessId)
        throw new Error('businessId is required');
    return businessId;
}
// ── CONTACTS (unified view of all contacts/leads/deals) ──
router.get('/contacts', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const leads = await database_1.prisma.crmClient.findMany({
            where: { businessId },
            orderBy: { createdAt: 'desc' },
            include: { deals: true, activities: true },
        });
        res.json({ success: true, data: leads });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.post('/contacts', async (req, res) => {
    try {
        const { name, email, phone, source, value, notes } = req.body;
        let finalPassportId = '';
        if (name) {
            const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
            const passport = await database_1.prisma.trustPassport.create({
                data: {
                    handle,
                    displayName: name,
                }
            });
            finalPassportId = passport.id;
        }
        const businessId = getBusinessId(req);
        const lead = await database_1.prisma.crmClient.create({
            data: {
                name, email, phone, notes: notes || null,
                businessId,
                passportId: finalPassportId || null,
                customData: { source, value: value ? Number(value) : null, stage: 'new', ownerId: 'system' }
            },
        });
        res.status(201).json({ success: true, data: lead });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.put('/contacts/:id', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const { name, email, phone, stage, value, company, notes } = req.body;
        const existing = await database_1.prisma.crmClient.findUnique({ where: { id: req.params.id, businessId } });
        if (!existing)
            return res.status(404).json({ success: false, error: 'Contact not found' });
        const customData = existing?.customData || {};
        if (stage !== undefined)
            customData.stage = stage;
        if (value !== undefined)
            customData.value = value;
        if (company !== undefined)
            customData.company = company;
        const lead = await database_1.prisma.crmClient.update({
            where: { id: req.params.id, businessId },
            data: { name, email, phone, notes, customData },
        });
        res.json({ success: true, data: lead });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.delete('/contacts/:id', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const deleted = await database_1.prisma.crmClient.delete({ where: { id: req.params.id, businessId } });
        res.json({ success: true, message: 'Contact deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/contacts/:id/activities', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const activities = await database_1.prisma.crmActivity.findMany({
            where: { clientId: req.params.id, businessId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: activities });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/contacts/:id/deals', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const deals = await database_1.prisma.crmDeal.findMany({
            where: { clientId: req.params.id, businessId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: deals });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/leads', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const leads = await database_1.prisma.crmClient.findMany({
            where: { businessId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: leads });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.post('/leads', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const { name, email, phone, source, value, ownerId, passportId } = req.body;
        let finalPassportId = passportId;
        if (!finalPassportId && name) {
            const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
            const passport = await database_1.prisma.trustPassport.create({
                data: {
                    handle,
                    displayName: name,
                }
            });
            finalPassportId = passport.id;
        }
        const lead = await database_1.prisma.crmClient.create({
            data: {
                name,
                email,
                phone,
                businessId,
                passportId: finalPassportId || null,
                customData: { source, value, ownerId: ownerId || 'system', stage: 'new' },
            },
        });
        res.json({ success: true, data: lead });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/leads/:id', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const lead = await database_1.prisma.crmClient.findUnique({
            where: { id: req.params.id, businessId },
            include: { deals: true, activities: true },
        });
        if (!lead)
            return res.status(404).json({ success: false, error: 'Lead not found' });
        res.json({ success: true, data: lead });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.put('/leads/:id/stage', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const { stage } = req.body;
        const existing = await database_1.prisma.crmClient.findUnique({ where: { id: req.params.id, businessId } });
        if (!existing)
            return res.status(404).json({ success: false, error: 'Lead not found' });
        const customData = existing?.customData || {};
        customData.stage = stage;
        const lead = await database_1.prisma.crmClient.update({
            where: { id: req.params.id, businessId },
            data: { customData },
        });
        res.json({ success: true, data: lead });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── DEALS ────────────────────────────────────────────
router.get('/deals', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const deals = await database_1.prisma.crmDeal.findMany({
            where: { businessId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: deals });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.post('/deals', async (req, res) => {
    try {
        const { leadId, title, amount, stage, closeDate, escrowId } = req.body;
        const deal = await database_1.prisma.crmDeal.create({
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── ACTIVITIES ───────────────────────────────────────
router.post('/activities', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const { leadId, type, content, dueAt } = req.body;
        const activity = await database_1.prisma.crmActivity.create({
            data: {
                clientId: leadId,
                businessId,
                type: type || 'NOTE',
                title: type || 'NOTE',
                description: content,
                dueDate: dueAt ? new Date(dueAt) : null,
            },
        });
        res.json({ success: true, data: activity });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── STATS ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const businessId = getBusinessId(req);
        const leads = await database_1.prisma.crmClient.count({ where: { businessId } });
        const deals = await database_1.prisma.crmDeal.count({ where: { businessId } });
        const activities = await database_1.prisma.crmActivity.count({ where: { businessId } });
        res.json({ success: true, data: { leads, deals, activities } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=contact.routes.js.map