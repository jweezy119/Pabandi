export declare const inventoryService: {
    createProduct(data: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: string | null;
        vendorId: string | null;
        venueId: string | null;
        quantity: number;
        unitPrice: number;
        sku: string;
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
        updatedAt: Date;
        name: string;
        category: string | null;
        vendorId: string | null;
        venueId: string | null;
        quantity: number;
        unitPrice: number;
        sku: string;
        minStock: number;
    })[]>;
    updateStock(productId: string, quantity: number, reason: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: string | null;
        vendorId: string | null;
        venueId: string | null;
        quantity: number;
        unitPrice: number;
        sku: string;
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
            updatedAt: Date;
            name: string;
            category: string | null;
            vendorId: string | null;
            venueId: string | null;
            quantity: number;
            unitPrice: number;
            sku: string;
            minStock: number;
        }[];
        purchaseOrders: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            totalAmount: number;
            submittedAt: Date | null;
            vendorId: string | null;
            items: import("@prisma/client/runtime/library").JsonValue | null;
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
        submittedAt: Date | null;
        vendorId: string | null;
        items: import("@prisma/client/runtime/library").JsonValue | null;
        receivedAt: Date | null;
        poNumber: string | null;
    }>;
    submitPurchaseOrder(poId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        totalAmount: number;
        submittedAt: Date | null;
        vendorId: string | null;
        items: import("@prisma/client/runtime/library").JsonValue | null;
        receivedAt: Date | null;
        poNumber: string | null;
    }>;
    receivePurchaseOrder(poId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        totalAmount: number;
        submittedAt: Date | null;
        vendorId: string | null;
        items: import("@prisma/client/runtime/library").JsonValue | null;
        receivedAt: Date | null;
        poNumber: string | null;
    } | null>;
    recordWaste(data: any): Promise<{
        id: string;
        createdAt: Date;
        reason: string | null;
        productId: string | null;
        venueId: string | null;
        quantity: number;
    } | null>;
    getWasteReport(venueId: string, startDate: Date, endDate: Date): Promise<{
        id: string;
        createdAt: Date;
        reason: string | null;
        productId: string | null;
        venueId: string | null;
        quantity: number;
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
            updatedAt: Date;
            name: string;
            category: string | null;
            vendorId: string | null;
            venueId: string | null;
            quantity: number;
            unitPrice: number;
            sku: string;
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
            productId: string | null;
            referenceId: string | null;
            quantity: number;
        }[];
        wasteReport: {
            id: string;
            createdAt: Date;
            reason: string | null;
            productId: string | null;
            venueId: string | null;
            quantity: number;
        }[];
    }>;
};
//# sourceMappingURL=inventory.service.d.ts.map