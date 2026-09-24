"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveSellerService = exports.LiveSellerService = void 0;
const client_1 = require("@prisma/client");
const whatsapp_service_1 = require("./whatsapp.service");
const ebay_service_1 = require("./ebay.service");
class LiveSellerService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listForBusiness(businessId) {
        return this.prisma.liveSellerIntegration.findMany({ where: { businessId, isActive: true } });
    }
    async connect(businessId, input) {
        return this.prisma.liveSellerIntegration.upsert({
            where: { businessId_platform: { businessId, platform: input.platform } },
            update: {
                accessToken: input.accessToken,
                refreshToken: input.refreshToken,
                expiresAt: input.expiresAt,
                scope: input.scope,
                shopId: input.shopId,
                streamKey: input.streamKey ?? undefined,
                webhookUrl: input.webhookUrl ?? undefined,
                metadata: { ...(input.metadata || {}), lastConnectError: null },
                lastSyncAt: new Date(),
                isActive: true,
                revokedAt: null,
            },
            create: { businessId, ...input },
        });
    }
    async disconnect(businessId, platform) {
        return this.prisma.liveSellerIntegration.update({
            where: { businessId_platform: { businessId, platform } },
            data: { isActive: false, revokedAt: new Date() },
        });
    }
    defaultShow(businessId, platform) {
        return {
            isLive: false,
            title: undefined,
            streamKey: undefined,
            startedAt: undefined,
            viewerCount: undefined,
            items: [],
            recentOrders: [],
        };
    }
    async getShowState(businessId, platform) {
        const integration = await this.prisma.liveSellerIntegration.findUnique({
            where: { businessId_platform: { businessId, platform } },
            select: { metadata: true, accessToken: true, refreshToken: true, isActive: true, lastSyncAt: true, id: true },
        });
        if (!integration || !integration.isActive) {
            return this.defaultShow(businessId, platform);
        }
        const metadata = integration.metadata || {};
        const current = metadata.currentShow || this.defaultShow(businessId, platform);
        return {
            ...current,
            isLive: !!current?.isLive,
            items: Array.isArray(current?.items) ? current.items : [],
            recentOrders: Array.isArray(current?.recentOrders) ? current.recentOrders : [],
        };
    }
    async upsertShowState(businessId, platform, patch) {
        const integration = await this.prisma.liveSellerIntegration.findUnique({
            where: { businessId_platform: { businessId, platform } },
            select: { id: true, metadata: true },
        });
        if (!integration) {
            throw new Error('Live selling integration not connected');
        }
        const metadata = integration.metadata || {};
        const current = metadata.currentShow || this.defaultShow(businessId, platform);
        const next = {
            ...current,
            ...patch,
            items: patch.items ?? current.items,
            recentOrders: patch.recentOrders ?? current.recentOrders,
        };
        await this.prisma.liveSellerIntegration.update({
            where: { id: integration.id },
            data: {
                metadata: {
                    ...metadata,
                    currentShow: next,
                    lastShowUpdateAt: new Date().toISOString(),
                },
            },
        });
        return next;
    }
    async addOrder(businessId, platform, order) {
        const integration = await this.prisma.liveSellerIntegration.findUnique({
            where: { businessId_platform: { businessId, platform } },
            select: { id: true, metadata: true, isActive: true },
        });
        if (!integration || !integration.isActive) {
            throw new Error('Live selling integration not connected');
        }
        const metadata = integration.metadata || {};
        const current = metadata.currentShow || this.defaultShow(businessId, platform);
        const nextOrder = { ...order, id: order.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: order.createdAt || new Date().toISOString() };
        const next = {
            ...current,
            recentOrders: [nextOrder, ...current.recentOrders].slice(0, 50),
        };
        await this.prisma.liveSellerIntegration.update({
            where: { id: integration.id },
            data: {
                metadata: {
                    ...metadata,
                    currentShow: next,
                    lastOrderAt: nextOrder.createdAt,
                },
            },
        });
        return nextOrder;
    }
    async getSchedule(businessId, platform) {
        const integration = await this.prisma.liveSellerIntegration.findFirst({
            where: { businessId, platform, isActive: true },
            select: { metadata: true, id: true, lastSyncAt: true },
        });
        if (!integration)
            return [];
        const metadata = integration.metadata || {};
        return Array.isArray(metadata.schedule) ? metadata.schedule : [];
    }
    async setSchedule(businessId, platform, schedule) {
        const integration = await this.prisma.liveSellerIntegration.findFirst({
            where: { businessId, platform, isActive: true },
            select: { id: true, metadata: true },
        });
        if (!integration) {
            throw new Error('Live selling integration not connected');
        }
        const normalized = schedule.map((item, idx) => ({
            id: item.id || `sch_${Date.now()}_${idx}`,
            title: item.title || 'Untitled stream',
            startsAt: item.startsAt || new Date(Date.now() + idx * 3600 * 1000).toISOString(),
            endsAt: item.endsAt || new Date(Date.now() + idx * 3600 * 1000 + 60 * 60 * 1000).toISOString(),
            recurrence: item.recurrence || 'once',
            note: item.note || '',
        }));
        const metadata = integration.metadata || {};
        await this.prisma.liveSellerIntegration.update({
            where: { id: integration.id },
            data: {
                metadata: {
                    ...metadata,
                    schedule: normalized,
                    lastScheduleAt: new Date().toISOString(),
                },
            },
        });
        return normalized;
    }
    /**
     * Share a live selling product to a WhatsApp chat using OpenWA native product messages.
     */
    async shareProductOnWhatsApp(businessId, chatId, productId, body) {
        // Ideally we would resolve the business's specific OpenWA sessionId here,
        // but openwaService.sendProduct will fallback to the default connected session.
        return whatsapp_service_1.openwaService.sendProduct(chatId, productId, body);
    }
    /**
     * Share the full business catalog to a WhatsApp chat.
     */
    async shareCatalogOnWhatsApp(businessId, chatId, body) {
        return whatsapp_service_1.openwaService.sendCatalog(chatId, body);
    }
    // ==========================================
    // eBay Specific Integration
    // ==========================================
    async importEbayListings(businessId) {
        const integration = await this.prisma.liveSellerIntegration.findUnique({
            where: { businessId_platform: { businessId, platform: 'EBAY_LIVE' } }
        });
        if (!integration || !integration.isActive || !integration.accessToken) {
            throw new Error('eBay integration not connected or missing token.');
        }
        const ebayListings = await ebay_service_1.ebayService.fetchActiveListings(integration.accessToken);
        // Map eBay format to Pabandi ShowItem format
        const newItems = ebayListings.map(item => ({
            id: item.sku,
            name: item.product.title,
            description: item.product.description,
            price: parseFloat(item.price.value),
            currency: item.price.currency,
            inventory: item.availability.shipToLocationAvailability.quantity,
            images: item.product.imageUrls,
            buyItNow: true
        }));
        const currentShow = await this.getShowState(businessId, 'EBAY_LIVE');
        const mergedItems = [...currentShow.items, ...newItems];
        return this.upsertShowState(businessId, 'EBAY_LIVE', { items: mergedItems });
    }
    async dropEbayItemToWhatsApp(businessId, chatId, itemId) {
        const show = await this.getShowState(businessId, 'EBAY_LIVE');
        const item = show.items.find(i => i.id === itemId);
        if (!item) {
            throw new Error('eBay item not found in current show state');
        }
        // Construct a beautiful WhatsApp Drop Message
        const message = `🔥 *LIVE DROP: eBay Item* 🔥\n\n` +
            `📦 *${item.name}*\n` +
            `💰 Price: ${item.currency} ${item.price}\n` +
            `✨ ${item.description || 'Limited stock available!'}\n\n` +
            `👉 *Buy Now on eBay:* https://www.ebay.com/itm/${item.id}`;
        // Send via OpenWA or AI Service
        // For MVP we just send text. If we had the actual openwa image sender we could attach item.images[0]
        await whatsapp_service_1.openwaService.sendProduct(chatId, item.id, message);
        return { success: true, message: 'Broadcasted to WhatsApp' };
    }
}
exports.LiveSellerService = LiveSellerService;
exports.liveSellerService = new LiveSellerService(new client_1.PrismaClient());
//# sourceMappingURL=live-seller.service.js.map