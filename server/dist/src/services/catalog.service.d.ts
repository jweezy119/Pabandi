export declare const catalogService: {
    /**
     * Look up a product from the BusinessService catalog.
     * If the business has Shopify linked, we could extend this to query Shopify Admin API directly.
     */
    getProduct(businessId: string, itemId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        businessId: string;
        isActive: boolean;
        description: string | null;
        price: number;
        duration: number;
    } | null>;
    /**
     * Validates if a product is in stock.
     * In a full implementation, this checks the `inventoryCount` or calls Shopify's Inventory API.
     */
    validateStock(itemId: string, quantity?: number): Promise<boolean>;
    /**
     * Retrieve the latest active products for a catalog command.
     */
    getCatalog(businessId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        businessId: string;
        isActive: boolean;
        description: string | null;
        price: number;
        duration: number;
    }[]>;
};
//# sourceMappingURL=catalog.service.d.ts.map