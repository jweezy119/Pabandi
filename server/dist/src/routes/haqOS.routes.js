"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const haqOS_service_1 = require("../services/haqOS.service");
const router = (0, express_1.Router)();
// Revenue
router.get('/revenue', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const period = req.query.period || 'month';
        const summary = await haqOS_service_1.haqRevenue.getRevenueSummary(userId, period);
        res.json({ success: true, data: summary });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get revenue summary' });
    }
});
router.get('/revenue/collection-rate', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const rate = await haqOS_service_1.haqRevenue.getRentCollectionRate(userId);
        res.json({ success: true, data: rate });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get collection rate' });
    }
});
router.get('/revenue/top-properties', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const properties = await haqOS_service_1.haqRevenue.getTopProperties(userId);
        res.json({ success: true, data: properties });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get top properties' });
    }
});
// Tenants
router.get('/tenants', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const tenants = await haqOS_service_1.haqTenant.getTenants(userId);
        res.json({ success: true, data: tenants });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get tenants' });
    }
});
router.get('/tenants/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const tenant = await haqOS_service_1.haqTenant.getTenantDetail(req.params.id);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        res.json({ success: true, data: tenant });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get tenant details' });
    }
});
router.put('/tenants/:id/risk', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { riskBand } = req.body;
        const tenant = await haqOS_service_1.haqTenant.updateTenantRisk(req.params.id, riskBand);
        res.json({ success: true, data: tenant });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update tenant risk' });
    }
});
// Leases
router.get('/leases', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const status = req.query.status;
        const leases = await haqOS_service_1.haqLease.getLeases(userId, status);
        res.json({ success: true, data: leases });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get leases' });
    }
});
router.post('/leases', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const lease = await haqOS_service_1.haqLease.createLease({ ...req.body, managerId: userId });
        res.status(201).json({ success: true, data: lease });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create lease' });
    }
});
router.put('/leases/:id/renew', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const lease = await haqOS_service_1.haqLease.renewLease(req.params.id, req.body);
        res.json({ success: true, data: lease });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to renew lease' });
    }
});
router.put('/leases/:id/terminate', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { reason } = req.body;
        const lease = await haqOS_service_1.haqLease.terminateLease(req.params.id, reason);
        res.json({ success: true, data: lease });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to terminate lease' });
    }
});
// Maintenance
router.get('/maintenance', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const status = req.query.status;
        const requests = await haqOS_service_1.haqMaintenance.getRequests(userId, status);
        res.json({ success: true, data: requests });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get maintenance requests' });
    }
});
router.post('/maintenance', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { tenantId, ...data } = req.body;
        const request = await haqOS_service_1.haqMaintenance.submitRequest(tenantId, data);
        res.status(201).json({ success: true, data: request });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to submit request' });
    }
});
router.put('/maintenance/:id/status', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const request = await haqOS_service_1.haqMaintenance.updateRequestStatus(req.params.id, status, notes);
        res.json({ success: true, data: request });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update request status' });
    }
});
router.post('/maintenance/:id/assign', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { vendorId } = req.body;
        const request = await haqOS_service_1.haqMaintenance.assignVendor(req.params.id, vendorId);
        res.json({ success: true, data: request });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to assign vendor' });
    }
});
// Messages
router.post('/messages', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { propertyId, senderEmail, recipientEmail, body } = req.body;
        const result = await haqOS_service_1.haqCommunication.sendMessage(propertyId, senderEmail, recipientEmail, body);
        res.status(201).json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});
router.post('/broadcast', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { propertyId, message } = req.body;
        const result = await haqOS_service_1.haqCommunication.broadcastToTenants(propertyId, message);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to broadcast' });
    }
});
router.get('/messages/:conversationId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const messages = await haqOS_service_1.haqCommunication.getMessageHistory(req.params.conversationId);
        res.json({ success: true, data: messages });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get messages' });
    }
});
exports.default = router;
//# sourceMappingURL=haqOS.routes.js.map