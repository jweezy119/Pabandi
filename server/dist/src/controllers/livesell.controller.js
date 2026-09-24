"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIntegrations = getIntegrations;
exports.getShowState = getShowState;
exports.patchShowState = patchShowState;
exports.addOrder = addOrder;
exports.importEbay = importEbay;
exports.dropWhatsApp = dropWhatsApp;
const live_seller_service_1 = require("../services/live-seller.service");
async function getIntegrations(req, res) {
    const businessId = req.businessId;
    if (!businessId)
        return res.status(400).json({ success: false, error: 'Business profile not found' });
    const data = await live_seller_service_1.liveSellerService.listForBusiness(businessId);
    res.json({ success: true, data });
}
async function getShowState(req, res) {
    const businessId = req.businessId;
    const platform = req.params.platform.toUpperCase().replace('-', '_');
    const data = await live_seller_service_1.liveSellerService.getShowState(businessId, platform);
    res.json({ success: true, data });
}
async function patchShowState(req, res) {
    const businessId = req.businessId;
    const platform = req.params.platform.toUpperCase().replace('-', '_');
    const data = await live_seller_service_1.liveSellerService.upsertShowState(businessId, platform, req.body || {});
    res.json({ success: true, data });
}
async function addOrder(req, res) {
    const businessId = req.businessId;
    const platform = req.params.platform.toUpperCase().replace('-', '_');
    const data = await live_seller_service_1.liveSellerService.addOrder(businessId, platform, req.body || {});
    res.status(201).json({ success: true, data });
}
async function importEbay(req, res) {
    try {
        const businessId = req.businessId;
        if (!businessId)
            return res.status(400).json({ success: false, error: 'Business profile not found' });
        const data = await live_seller_service_1.liveSellerService.importEbayListings(businessId);
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function dropWhatsApp(req, res) {
    try {
        const businessId = req.businessId;
        const { chatId, itemId } = req.body;
        if (!businessId || !chatId || !itemId) {
            return res.status(400).json({ success: false, error: 'Missing parameters' });
        }
        const data = await live_seller_service_1.liveSellerService.dropEbayItemToWhatsApp(businessId, chatId, itemId);
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
//# sourceMappingURL=livesell.controller.js.map