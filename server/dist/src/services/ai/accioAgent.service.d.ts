export interface AccioSourcingItem {
    itemName: string;
    quantity: number;
    estimatedPricePKR: number;
    accioUrl: string;
}
export declare class AccioAgentService {
    /**
     * Analyze upcoming reservations for a business to detect supply needs.
     */
    analyzeUpcomingDemand(businessId: string): Promise<{
        totalGuestsPredicted: number;
        needs: AccioSourcingItem[];
    }>;
    /**
     * Draft a sourcing order using Accio Work.
     */
    draftSourcingOrder(businessId: string, needs: AccioSourcingItem[]): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessId: string;
        status: import(".prisma/client").$Enums.SourcingOrderStatus;
        items: import("@prisma/client/runtime/library").JsonValue;
        estimatedCostPKR: number;
        accioWorkOrderId: string | null;
    } | null>;
    /**
     * Confirm the order via Accio Work (Mock API).
     */
    confirmOrder(orderId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessId: string;
        status: import(".prisma/client").$Enums.SourcingOrderStatus;
        items: import("@prisma/client/runtime/library").JsonValue;
        estimatedCostPKR: number;
        accioWorkOrderId: string | null;
    }>;
    /**
     * Trend-to-Service: Analyze local trends to suggest new profitable equipment/services.
     */
    discoverTrends(businessId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessId: string;
        status: import(".prisma/client").$Enums.TrendStatus;
        description: string;
        estimatedCostPKR: number;
        equipmentName: string;
        suggestedServicePrice: number;
        projectedBookings: number;
        projectedRoiPercent: number;
        accioWorkUrl: string | null;
    }[]>;
    /**
     * One-click Launch Service from a Trend.
     */
    launchTrendService(trendId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessId: string;
        status: import(".prisma/client").$Enums.TrendStatus;
        description: string;
        estimatedCostPKR: number;
        equipmentName: string;
        suggestedServicePrice: number;
        projectedBookings: number;
        projectedRoiPercent: number;
        accioWorkUrl: string | null;
    }>;
}
export declare const accioAgentService: AccioAgentService;
//# sourceMappingURL=accioAgent.service.d.ts.map