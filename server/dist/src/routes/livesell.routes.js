"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const live_seller_service_1 = require("../services/live-seller.service");
const apiResponse_1 = require("../utils/apiResponse");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
async function requireBusiness(req, res) {
    const biz = await database_1.prisma.business.findFirst({ where: { ownerId: req.user.id } });
    if (!biz) {
        res.locals = res.locals || {};
        res.locals.businessMissing = true;
        return null;
    }
    return biz;
}
function stateToken(userId, businessId, platform) {
    return jsonwebtoken_1.default.sign({ userId, businessId, platform }, JWT_SECRET, { expiresIn: '15m' });
}
function decodeState(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
router.get('', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const integrations = await live_seller_service_1.liveSellerService.listForBusiness(biz.id);
        return (0, apiResponse_1.ok)(res, integrations);
    }
    catch (e) {
        console.error('Failed to list integrations', e);
        return (0, apiResponse_1.fail)(res, 'Failed to list integrations', 500);
    }
});
router.get('/:platform/state', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const platform = req.params.platform.toUpperCase().replace('-', '_');
        const state = await live_seller_service_1.liveSellerService.getShowState(biz.id, platform);
        return (0, apiResponse_1.ok)(res, state);
    }
    catch (e) {
        console.error('Failed to load show state', e);
        return (0, apiResponse_1.fail)(res, 'Failed to load show state', 500);
    }
});
router.patch('/:platform/state', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const platform = req.params.platform.toUpperCase().replace('-', '_');
        const state = await live_seller_service_1.liveSellerService.upsertShowState(biz.id, platform, req.body || {});
        return (0, apiResponse_1.ok)(res, state);
    }
    catch (e) {
        console.error('Failed to update show state', e);
        return (0, apiResponse_1.fail)(res, 'Failed to update show state', 500);
    }
});
router.get('/:platform/catalog', async (req, res) => {
    try {
        const platform = req.params.platform.toUpperCase().replace('-', '_');
        return (0, apiResponse_1.ok)(res, { platform, items: [] });
    }
    catch (e) {
        console.error('Failed to load catalog', e);
        return (0, apiResponse_1.fail)(res, 'Failed to load catalog', 500);
    }
});
router.post('/:platform/orders', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const platform = req.params.platform.toUpperCase().replace('-', '_');
        const order = await live_seller_service_1.liveSellerService.addOrder(biz.id, platform, req.body || {});
        return (0, apiResponse_1.ok)(res, order, 201);
    }
    catch (e) {
        console.error('Failed to add order', e);
        return (0, apiResponse_1.fail)(res, 'Failed to add order', 500);
    }
});
router.get('/:platform/schedule', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const platform = req.params.platform.toUpperCase().replace('-', '_');
        const schedule = await live_seller_service_1.liveSellerService.getSchedule(biz.id, platform);
        return (0, apiResponse_1.ok)(res, schedule);
    }
    catch (e) {
        console.error('Failed to load schedule', e);
        return (0, apiResponse_1.fail)(res, 'Failed to load schedule', 500);
    }
});
router.post('/:platform/schedule', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const platform = req.params.platform.toUpperCase().replace('-', '_');
        const schedule = await live_seller_service_1.liveSellerService.setSchedule(biz.id, platform, req.body?.schedule || []);
        return (0, apiResponse_1.ok)(res, schedule);
    }
    catch (e) {
        console.error('Failed to save schedule', e);
        return (0, apiResponse_1.fail)(res, 'Failed to save schedule', 500);
    }
});
router.get('/connect/:platform', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const platform = req.params.platform;
        if (!['tiktok-live', 'youtube-shopping', 'shopify-live', 'ebay-live', 'amazon-live', 'instagram-live', 'custom-web'].includes(platform)) {
            return (0, apiResponse_1.fail)(res, 'Unsupported platform', 400);
        }
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const token = stateToken(req.user.id, biz.id, platform);
        if (platform === 'tiktok-live') {
            return passport_1.default.authenticate('tiktok', { state: token })(req, res, next);
        }
        if (platform === 'youtube-shopping') {
            return passport_1.default.authenticate('google', { state: token, scope: ['https://www.googleapis.com/auth/youtube.readonly'] })(req, res, next);
        }
        if (platform === 'shopify-live') {
            return (0, apiResponse_1.fail)(res, 'Shopify connect needs a Shopify OAuth strategy.', 400);
        }
        if (['ebay-live', 'amazon-live', 'instagram-live', 'custom-web'].includes(platform)) {
            return (0, apiResponse_1.fail)(res, 'Live-sell connect is not implemented for this platform yet', 400);
        }
    }
    catch (e) {
        next(e);
    }
});
router.get('/callback/tiktok', passport_1.default.authenticate('tiktok', { session: false, failureRedirect: `${FRONTEND_URL}/business?livesell_error=callback_failed` }), async (req, res) => {
    try {
        const state = decodeState(req.query.state);
        const profile = req.user || req.authInfo;
        const platform = state.platform.toUpperCase().replace('-', '_');
        await live_seller_service_1.liveSellerService.connect(state.businessId, {
            platform,
            accessToken: profile?.accessToken || req.accessToken || '',
            refreshToken: profile?.refreshToken || req.refreshToken || '',
            expiresAt: profile?.expiresAt ? new Date(profile.expiresAt) : undefined,
            scope: profile?.scope || null,
            metadata: { rawProfile: profile },
        });
        res.redirect(`${FRONTEND_URL}/business?livesell_success=${state.platform}`);
    }
    catch (e) {
        console.error('Live sell callback error', e);
        return res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
    }
});
router.get('/callback/google', passport_1.default.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/business?livesell_error=callback_failed` }), async (req, res) => {
    try {
        const state = decodeState(req.query.state);
        const profile = req.user || req.authInfo;
        await live_seller_service_1.liveSellerService.connect(state.businessId, {
            platform: 'YOUTUBE_SHOPPING',
            accessToken: profile?.accessToken || req.accessToken || '',
            refreshToken: profile?.refreshToken || req.refreshToken || '',
            expiresAt: profile?.expiresAt ? new Date(profile.expiresAt) : undefined,
            scope: profile?.scope || null,
            metadata: { rawProfile: profile },
        });
        res.redirect(`${FRONTEND_URL}/business?livesell_success=youtube-shopping`);
    }
    catch (e) {
        console.error('YouTube callback error', e);
        return res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
    }
});
router.get('/callback/shopify', passport_1.default.authenticate('shopify', { session: false, failureRedirect: `${FRONTEND_URL}/business?livesell_error=callback_failed` }), async (req, res) => {
    try {
        const state = decodeState(req.query.state);
        const profile = req.user || req.authInfo;
        await live_seller_service_1.liveSellerService.connect(state.businessId, {
            platform: 'SHOPIFY_LIVE',
            accessToken: profile?.accessToken || req.accessToken || '',
            refreshToken: profile?.refreshToken || req.refreshToken || '',
            expiresAt: profile?.expiresAt ? new Date(profile.expiresAt) : undefined,
            scope: profile?.scope || null,
            shopId: profile?.shop || profile?.shopDomain || null,
            metadata: { rawProfile: profile },
        });
        res.redirect(`${FRONTEND_URL}/business?livesell_success=shopify-live`);
    }
    catch (e) {
        console.error('Shopify callback error', e);
        return res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
    }
});
router.delete('/:platform', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        await live_seller_service_1.liveSellerService.disconnect(biz.id, req.params.platform.toUpperCase().replace('-', '_'));
        return (0, apiResponse_1.ok)(res, { message: 'Integration disconnected' });
    }
    catch (e) {
        console.error('Failed to disconnect integration', e);
        return (0, apiResponse_1.fail)(res, 'Failed to disconnect integration', 500);
    }
});
router.post('/ebay/import', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const data = await live_seller_service_1.liveSellerService.importEbayListings(biz.id);
        return (0, apiResponse_1.ok)(res, data);
    }
    catch (e) {
        console.error('Failed to import eBay listings', e);
        return (0, apiResponse_1.fail)(res, e.message, 500);
    }
});
router.post('/whatsapp/drop', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const biz = await requireBusiness(req, res);
        if (!biz)
            return (0, apiResponse_1.fail)(res, 'Business profile not found', 400);
        const { chatId, itemId } = req.body;
        const data = await live_seller_service_1.liveSellerService.dropEbayItemToWhatsApp(biz.id, chatId, itemId);
        return (0, apiResponse_1.ok)(res, data);
    }
    catch (e) {
        console.error('Failed to drop item to WhatsApp', e);
        return (0, apiResponse_1.fail)(res, e.message, 500);
    }
});
exports.default = router;
//# sourceMappingURL=livesell.routes.js.map