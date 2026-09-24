"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const builder_service_1 = require("../services/builder.service");
const router = (0, express_1.Router)();
// POST /api/v1/builder/register
router.post('/register', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { companyName, licenseNumber } = req.body;
        if (!companyName)
            return res.status(400).json({ error: 'companyName is required' });
        const profile = await builder_service_1.builderService.createProfile(userId, { companyName, licenseNumber });
        res.status(201).json({ success: true, data: profile });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/builder/profile
router.get('/profile', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const profile = await builder_service_1.builderService.getProfile(userId);
        res.json({ success: true, data: profile });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/builder/projects
router.get('/projects', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const profile = await builder_service_1.builderService.getProfile(userId);
        if (!profile)
            return res.status(404).json({ error: 'Builder profile not found' });
        const projects = await builder_service_1.builderService.getProjects(profile.id);
        res.json({ success: true, data: projects });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/builder/projects
router.post('/projects', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const profile = await builder_service_1.builderService.getProfile(userId);
        if (!profile)
            return res.status(404).json({ error: 'Builder profile not found' });
        const { name, location, description, totalUnits, startDate, expectedCompletion } = req.body;
        if (!name || !location || !totalUnits || !startDate || !expectedCompletion) {
            return res.status(400).json({ error: 'name, location, totalUnits, startDate, expectedCompletion are required' });
        }
        const project = await builder_service_1.builderService.createProject(profile.id, {
            name, location, description, totalUnits: parseInt(totalUnits),
            startDate: new Date(startDate), expectedCompletion: new Date(expectedCompletion),
        });
        res.status(201).json({ success: true, data: project });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/builder/projects/:id
router.get('/projects/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const project = await builder_service_1.builderService.getProjectDetail(req.params.id);
        if (!project)
            return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, data: project });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/builder/units
router.post('/units', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { projectId, unitNumber, type, size, price, floor } = req.body;
        if (!projectId || !unitNumber || !type || !size || !price) {
            return res.status(400).json({ error: 'projectId, unitNumber, type, size, price are required' });
        }
        const unit = await builder_service_1.builderService.addUnit(projectId, {
            unitNumber, type, size: parseInt(size), price: parseFloat(price), floor: floor ? parseInt(floor) : undefined,
        });
        res.status(201).json({ success: true, data: unit });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/builder/units/:id/book
router.post('/units/:id/book', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const buyerId = req.body.buyerId || req.user?.id;
        const unit = await builder_service_1.builderService.bookUnit(req.params.id, buyerId);
        res.json({ success: true, data: unit });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/builder/units/:id/sell
router.post('/units/:id/sell', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const buyerId = req.body.buyerId || req.user?.id;
        const unit = await builder_service_1.builderService.sellUnit(req.params.id, buyerId);
        res.json({ success: true, data: unit });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/builder/buyers
router.get('/buyers', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const profile = await builder_service_1.builderService.getProfile(userId);
        if (!profile)
            return res.status(404).json({ error: 'Builder profile not found' });
        const buyers = await builder_service_1.builderService.getBuyers(profile.id);
        res.json({ success: true, data: buyers });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/builder/installments
router.get('/installments', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const profile = await builder_service_1.builderService.getProfile(userId);
        if (!profile)
            return res.status(404).json({ error: 'Builder profile not found' });
        const status = req.query.status;
        const installments = await builder_service_1.builderService.getInstallments(profile.id, status);
        res.json({ success: true, data: installments });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/builder/milestones
router.post('/milestones', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { projectId, title, description, dueDate } = req.body;
        if (!projectId || !title || !dueDate) {
            return res.status(400).json({ error: 'projectId, title, dueDate are required' });
        }
        const milestone = await builder_service_1.builderService.addMilestone(projectId, {
            title, description, dueDate: new Date(dueDate),
        });
        res.status(201).json({ success: true, data: milestone });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/v1/builder/milestones/:id/complete
router.put('/milestones/:id/complete', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const milestone = await builder_service_1.builderService.completeMilestone(req.params.id);
        res.json({ success: true, data: milestone });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/builder/reminders/:id
router.post('/reminders/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await builder_service_1.builderService.sendReminder(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/builder/trust-score
router.get('/trust-score', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const profile = await builder_service_1.builderService.getProfile(userId);
        if (!profile)
            return res.status(404).json({ error: 'Builder profile not found' });
        const score = await builder_service_1.builderService.getTrustScore(profile.id);
        res.json({ success: true, data: score });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/builder/search
router.get('/search', async (req, res) => {
    try {
        const { location, priceMin, priceMax, type } = req.query;
        const projects = await builder_service_1.builderService.searchProjects({
            location: location,
            priceMin: priceMin ? parseFloat(priceMin) : undefined,
            priceMax: priceMax ? parseFloat(priceMax) : undefined,
            type: type,
        });
        res.json({ success: true, data: projects });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=builder.routes.js.map