"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openwaDropBotService = void 0;
const database_1 = require("../utils/database");
const catalog_service_1 = require("./catalog.service");
exports.openwaDropBotService = {
    isDropEngineCommand(message) {
        const lower = message.trim().toLowerCase();
        return lower.startsWith('!drop') || lower.startsWith('!buy') || lower.startsWith('!catalog');
    },
    async handleDropEngineCommand(businessId, customerPhone, message) {
        const lower = message.trim().toLowerCase();
        if (lower.startsWith('!drop')) {
            return this.handleDropCommand(businessId, message);
        }
        else if (lower.startsWith('!buy')) {
            return this.handleBuyCommand(businessId, customerPhone, message);
        }
        else if (lower.startsWith('!catalog')) {
            return this.handleCatalogCommand(businessId);
        }
        return 'Unknown command.';
    },
    async handleDropCommand(businessId, message) {
        const parts = message.trim().split(/\s+/);
        if (parts.length < 3) {
            return 'Format: !drop [price] [item name]';
        }
        const price = parseFloat(parts[1]);
        if (isNaN(price)) {
            return 'Format error: price must be a number.';
        }
        const itemName = parts.slice(2).join(' ');
        const business = await database_1.prisma.business.findUnique({ where: { id: businessId } });
        if (!business) {
            return 'Error: Business not found.';
        }
        const service = await database_1.prisma.businessService.create({
            data: {
                businessId,
                name: itemName,
                price,
                duration: 0,
                isActive: true,
            },
        });
        const encodedItem = encodeURIComponent(service.name);
        const checkoutSession = await database_1.prisma.checkoutSession.create({
            data: {
                businessId,
                amount: price,
                currency: 'USD',
                successUrl: `https://pabandi.com/s/${business.slug || business.id}?success=true`,
                cancelUrl: `https://pabandi.com/s/${business.slug || business.id}`,
                metadata: { source: 'drop_bot_drop', serviceId: service.id, itemName: service.name },
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        const link = `https://pabandi.com/checkout/${checkoutSession.id}`;
        return `DROP LIVE\n${itemName} - $${price}\n\nReply !buy ${service.id} or tap here:\n${link}`;
    },
    async handleBuyCommand(businessId, customerPhone, message) {
        const parts = message.trim().split(/\s+/);
        if (parts.length < 2) {
            return 'Format: !buy [item_id]';
        }
        const itemId = parts[1];
        const service = await catalog_service_1.catalogService.getProduct(businessId, itemId);
        if (!service) {
            return 'Item not found or no longer available.';
        }
        const inStock = await catalog_service_1.catalogService.validateStock(itemId);
        if (!inStock) {
            return 'Sorry, this item is out of stock!';
        }
        const business = await database_1.prisma.business.findUnique({ where: { id: businessId } });
        const checkoutSession = await database_1.prisma.checkoutSession.create({
            data: {
                businessId,
                amount: service.price,
                currency: 'USD',
                successUrl: `https://pabandi.com/s/${business?.slug || business?.id}?success=true`,
                cancelUrl: `https://pabandi.com/s/${business?.slug || business?.id}`,
                metadata: { source: 'drop_bot_buy', serviceId: service.id, itemName: service.name, customerPhone },
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
            },
        });
        const link = `https://pabandi.com/checkout/${checkoutSession.id}`;
        return `Great choice! Secure your ${service.name} ($${service.price}) instantly via Web3 Escrow:\n${link}`;
    },
    async handleCatalogCommand(businessId) {
        const services = await catalog_service_1.catalogService.getCatalog(businessId);
        if (services.length === 0) {
            return 'No active drops right now. Stay tuned!';
        }
        const lines = ['Available Drops'];
        services.forEach(s => {
            lines.push(`${s.name} - $${s.price} (!buy ${s.id})`);
        });
        return lines.join('\n');
    },
};
//# sourceMappingURL=openwa.drop-bot.service.js.map