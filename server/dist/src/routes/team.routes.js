"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const team_service_1 = require("../services/team.service");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
// Routes needing ADMIN or above
router.post('/invite', (0, permissions_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { businessId, name, email, role, payRate, payType } = req.body;
        const member = await team_service_1.TeamService.inviteMember({ businessId: String(businessId), name, email, role, payRate, payType });
        res.json(member);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.patch('/:id/deactivate', (0, permissions_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const businessId = String(req.query.businessId || req.body.businessId);
        const member = await team_service_1.TeamService.removeMember(req.params.id, businessId);
        res.json(member);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.patch('/:id/role', (0, permissions_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const businessId = String(req.query.businessId || req.body.businessId);
        const { role } = req.body;
        const member = await team_service_1.TeamService.updateMember(req.params.id, businessId, { role });
        res.json(member);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Any team member with VIEWER or above can list
router.get('/', (0, permissions_1.requireRole)('VIEWER'), async (req, res) => {
    try {
        const businessId = String(req.query.businessId);
        const members = await team_service_1.TeamService.getTeamMembers(businessId);
        res.json(members);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/:id', (0, permissions_1.requireRole)('VIEWER'), async (req, res) => {
    try {
        const businessId = String(req.query.businessId);
        const member = await team_service_1.TeamService.getTeamMember(req.params.id, businessId);
        res.json(member);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Public invite accept
router.post('/accept-invite', async (req, res) => {
    try {
        const { token } = req.body;
        const member = await team_service_1.TeamService.acceptInvite(token);
        res.json(member);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=team.routes.js.map