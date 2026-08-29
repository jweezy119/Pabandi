"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogService = void 0;
const database_1 = require("../utils/database");
exports.catalogService = {
    /**
     * Look up a product from the BusinessService catalog.
     * If the business has Shopify linked, we could extend this to query Shopify Admin API directly.
     */
    async getProduct(businessId, itemId) {
        const service = await database_1.prisma.businessService.findUnique({ where: { id: itemId } });
        if (!service || service.businessId !== businessId || !service.isActive) {
            return null;
        }
        return service;
    },
    /**
     * Validates if a product is in stock.
     * In a full implementation, this checks the `inventoryCount` or calls Shopify's Inventory API.
     */
    async validateStock(itemId, quantity = 1) {
        const service = await database_1.prisma.businessService.findUnique({ where: { id: itemId } });
        if (!service || !service.isActive) {
            return false;
        }
        // For now, if it's active in Pabandi DB, we consider it in stock.
        // If we wanted true Shopify validation, we'd fetch store credentials and query inventory_levels.
        return true;
    },
    /**
     * Retrieve the latest active products for a catalog command.
     */
    async getCatalog(businessId, limit = 10) {
        return database_1.prisma.businessService.findMany({
            where: { businessId, isActive: true, duration: 0 },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }
};
//# sourceMappingURL=catalog.service.js.map