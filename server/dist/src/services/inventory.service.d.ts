export declare const inventoryService: {
    createProduct(data: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        category: string | null;
        vendorId: string | null;
        venueId: string | null;
        sku: string;
        unitPrice: number;
        quantity: number;
        minStock: number;
    }>;
    getProducts(venueId: string): Promise<({
        vendor: {
            email: string | null;
            phone: string | null;
            contact: string | null;
            id: string;
            createdAt: Date;
            name: string;
            address: string | null;
            venueId: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        category: string | null;
        vendorId: string | null;
        venueId: string | null;
        sku: string;
        unitPrice: number;
        quantity: number;
        minStock: number;
    })[]>;
    updateStock(productId: string, quantity: number, reason: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        category: string | null;
        vendorId: string | null;
        venueId: string | null;
        sku: string;
        unitPrice: number;
        quantity: number;
        minStock: number;
    } | null>;
    triggerLowStockAlert(productId: string): Promise<void>;
    createVendor(data: any): Promise<{
        email: string | null;
        phone: string | null;
        contact: string | null;
        id: string;
        createdAt: Date;
        name: string;
        address: string | null;
        venueId: string | null;
    }>;
    getVendors(venueId: string): Promise<({
        products: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            category: string | null;
            vendorId: string | null;
            venueId: string | null;
            sku: string;
            unitPrice: number;
            quantity: number;
            minStock: number;
        }[];
        purchaseOrders: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            totalAmount: number;
            items: import("@prisma/client/runtime/library").JsonValue | null;
            submittedAt: Date | null;
            vendorId: string | null;
            receivedAt: Date | null;
            poNumber: string | null;
        }[];
    } & {
        email: string | null;
        phone: string | null;
        contact: string | null;
        id: string;
        createdAt: Date;
        name: string;
        address: string | null;
        venueId: string | null;
    })[]>;
    createPurchaseOrder(data: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        totalAmount: number;
        items: import("@prisma/client/runtime/library").JsonValue | null;
        submittedAt: Date | null;
        vendorId: string | null;
        receivedAt: Date | null;
        poNumber: string | null;
    }>;
    submitPurchaseOrder(poId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        totalAmount: number;
        items: import("@prisma/client/runtime/library").JsonValue | null;
        submittedAt: Date | null;
        vendorId: string | null;
        receivedAt: Date | null;
        poNumber: string | null;
    }>;
    receivePurchaseOrder(poId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        totalAmount: number;
        items: import("@prisma/client/runtime/library").JsonValue | null;
        submittedAt: Date | null;
        vendorId: string | null;
        receivedAt: Date | null;
        poNumber: string | null;
    } | null>;
    recordWaste(data: any): Promise<{
        id: string;
        createdAt: Date;
        reason: string | null;
        venueId: string | null;
        quantity: number;
        productId: string | null;
    } | null>;
    getWasteReport(venueId: string, startDate: Date, endDate: Date): Promise<{
        id: string;
        createdAt: Date;
        reason: string | null;
        venueId: string | null;
        quantity: number;
        productId: string | null;
    }[]>;
    getInventoryValue(venueId: string): Promise<{
        totalValue: number;
        totalItems: number;
        lowStockCount: number;
        productCount: number;
    }>;
    getInventoryReport(venueId: string): Promise<{
        products: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            category: string | null;
            vendorId: string | null;
            venueId: string | null;
            sku: string;
            unitPrice: number;
            quantity: number;
            minStock: number;
        }[];
        value: {
            totalValue: number;
            totalItems: number;
            lowStockCount: number;
            productCount: number;
        };
        recentTransactions: {
            id: string;
            createdAt: Date;
            type: string;
            amount: number;
            referenceId: string | null;
            quantity: number;
            productId: string | null;
        }[];
        wasteReport: {
            id: string;
            createdAt: Date;
            reason: string | null;
            venueId: string | null;
            quantity: number;
            productId: string | null;
        }[];
    }>;
};
//# sourceMappingURL=inventory.service.d.ts.map