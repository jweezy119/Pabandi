export declare const catalogService: {
    /**
     * Look up a product from the BusinessService catalog.
     * If the business has Shopify linked, we could extend this to query Shopify Admin API directly.
     */
    getProduct(businessId: string, itemId: string): Promise<{
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        businessId: string;
        isActive: boolean;
        description: string | null;
        category: string | null;
        price: number;
        duration: number;
        imageUrl: string | null;
        tags: import("@prisma/client/runtime/library").JsonValue | null;
        discountPrice: number | null;
        bookingLeadTime: number | null;
        maxBookingsPerDay: number | null;
        locationType: string | null;
        requirements: string | null;
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
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        businessId: string;
        isActive: boolean;
        description: string | null;
        category: string | null;
        price: number;
        duration: number;
        imageUrl: string | null;
        tags: import("@prisma/client/runtime/library").JsonValue | null;
        discountPrice: number | null;
        bookingLeadTime: number | null;
        maxBookingsPerDay: number | null;
        locationType: string | null;
        requirements: string | null;
    }[]>;
};
//# sourceMappingURL=catalog.service.d.ts.map