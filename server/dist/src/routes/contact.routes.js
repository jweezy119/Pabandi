"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
// ── CONTACTS (unified view of all contacts/leads/deals) ──
router.get('/contacts', async (req, res) => {
    try {
        const leads = await database_1.prisma.contactLead.findMany({
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
        const lead = await database_1.prisma.contactLead.create({
            data: {
                name, email, phone, source, value: value ? Number(value) : null,
                notes: notes || null,
                businessId: 'default', ownerId: 'system', passportId: '',
                stage: 'new',
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
        const { name, email, phone, stage, value, company, notes } = req.body;
        const lead = await database_1.prisma.contactLead.update({
            where: { id: req.params.id },
            data: { name, email, phone, stage, value, company, notes },
        });
        res.json({ success: true, data: lead });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.delete('/contacts/:id', async (req, res) => {
    try {
        await database_1.prisma.contactLead.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Contact deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/contacts/:id/activities', async (req, res) => {
    try {
        const activities = await database_1.prisma.contactActivity.findMany({
            where: { leadId: req.params.id },
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
        const deals = await database_1.prisma.contactDeal.findMany({
            where: { leadId: req.params.id },
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
        const leads = await database_1.prisma.contactLead.findMany({
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
        const { name, email, phone, source, value, businessId, ownerId, passportId } = req.body;
        const lead = await database_1.prisma.contactLead.create({
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/leads/:id', async (req, res) => {
    try {
        const lead = await database_1.prisma.contactLead.findUnique({
            where: { id: req.params.id },
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
        const { stage } = req.body;
        const lead = await database_1.prisma.contactLead.update({
            where: { id: req.params.id },
            data: { stage },
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
        const deals = await database_1.prisma.contactDeal.findMany({
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
        const deal = await database_1.prisma.contactDeal.create({
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── ACTIVITIES ───────────────────────────────────────
router.post('/activities', async (req, res) => {
    try {
        const { leadId, type, content, dueAt } = req.body;
        const activity = await database_1.prisma.contactActivity.create({
            data: {
                leadId,
                type,
                content,
                dueAt: dueAt ? new Date(dueAt) : null,
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
        const leads = await database_1.prisma.contactLead.count();
        const deals = await database_1.prisma.contactDeal.count();
        const activities = await database_1.prisma.contactActivity.count();
        res.json({ success: true, data: { leads, deals, activities } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=contact.routes.js.map