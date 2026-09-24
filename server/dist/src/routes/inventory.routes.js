"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_service_1 = require("../services/inventory.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── Products ──────────────────────────────────────────────────────────────
router.get('/venues/:venueId/products', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const products = await inventory_service_1.inventoryService.getProducts(req.params.venueId);
        res.json({ success: true, data: products });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load products' });
    }
});
router.post('/products', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const product = await inventory_service_1.inventoryService.createProduct(req.body);
        res.status(201).json({ success: true, data: product });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create product' });
    }
});
router.post('/products/:id/stock', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { quantity, reason } = req.body;
        const result = await inventory_service_1.inventoryService.updateStock(req.params.id, quantity, reason);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update stock' });
    }
});
// ── Vendors ──────────────────────────────────────────────────────────────
router.get('/venues/:venueId/vendors', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const vendors = await inventory_service_1.inventoryService.getVendors(req.params.venueId);
        res.json({ success: true, data: vendors });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load vendors' });
    }
});
router.post('/vendors', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const vendor = await inventory_service_1.inventoryService.createVendor(req.body);
        res.status(201).json({ success: true, data: vendor });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create vendor' });
    }
});
// ── Purchase Orders ──────────────────────────────────────────────────────
router.post('/purchase-orders', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const po = await inventory_service_1.inventoryService.createPurchaseOrder(req.body);
        res.status(201).json({ success: true, data: po });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create purchase order' });
    }
});
router.post('/purchase-orders/:id/submit', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await inventory_service_1.inventoryService.submitPurchaseOrder(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to submit PO' });
    }
});
router.post('/purchase-orders/:id/receive', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await inventory_service_1.inventoryService.receivePurchaseOrder(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to receive PO' });
    }
});
// ── Waste ────────────────────────────────────────────────────────────────
router.post('/waste', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await inventory_service_1.inventoryService.recordWaste(req.body);
        res.status(201).json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to record waste' });
    }
});
// ── Reports ──────────────────────────────────────────────────────────────
router.get('/venues/:venueId/inventory-value', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const value = await inventory_service_1.inventoryService.getInventoryValue(req.params.venueId);
        res.json({ success: true, data: value });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get inventory value' });
    }
});
router.get('/venues/:venueId/report', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const report = await inventory_service_1.inventoryService.getInventoryReport(req.params.venueId);
        res.json({ success: true, data: report });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get report' });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map