export declare class AbodeRevenueService {
    getRevenueSummary(managerId: string, period: 'week' | 'month' | 'year'): Promise<{
        period: "year" | "week" | "month";
        totalRevenue: number;
        totalExpenses: number;
        netIncome: number;
        paymentCount: number;
        averagePayment: number;
    }>;
    getRentCollectionRate(managerId: string): Promise<{
        totalTenants: number;
        paidTenants: number;
        collectionRate: number;
    }>;
    getTopProperties(managerId: string): Promise<{
        id: string;
        status: string;
        title: string;
        address: string | null;
        _count: {
            units: number;
        };
        rentAmount: number | null;
    }[]>;
}
export declare class AbodeTenantService {
    getTenants(managerId: string): Promise<{
        email: string;
        phone: string | null;
        id: string;
        createdAt: Date;
        firstName: string | null;
        lastName: string | null;
        updatedAt: Date;
        status: string;
        managerId: string;
        riskBand: string | null;
        notes: string | null;
        propertyId: string | null;
        depositHeld: number;
        totalStays: number;
        totalDisputes: number;
        balanceUsdc: number;
        balancePab: number;
        lastStayAt: Date | null;
    }[]>;
    getTenantDetail(tenantId: string): Promise<{
        leases: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            managerId: string;
            depositAmount: number;
            notes: string | null;
            propertyId: string | null;
            rentAmount: number;
            rentPeriod: string;
            unitId: string | null;
            tenantEmail: string;
            tenantName: string | null;
            startDate: Date;
            endDate: Date;
            petFee: number;
            petMonthly: number;
            lateFee: number;
            lateGraceDays: number;
            utilities: string[];
            renewalTerms: string | null;
            terminationNoticeDays: number;
            tenantId: string | null;
        }[];
        maintenanceRequests: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            managerId: string;
            title: string;
            notes: string | null;
            description: string | null;
            resolvedAt: Date | null;
            priority: string;
            propertyId: string | null;
            unitId: string | null;
            tenantEmail: string | null;
            tenantId: string | null;
            cost: number | null;
            vendorId: string | null;
            vendorName: string | null;
            vendorNotes: string | null;
        }[];
        paymentHistory: {
            id: string;
            createdAt: Date;
            type: string;
            description: string | null;
            category: string;
            amount: number;
            date: Date;
            propertyId: string;
            unitId: string | null;
            tenantEmail: string | null;
        }[];
        email: string;
        phone: string | null;
        id: string;
        createdAt: Date;
        firstName: string | null;
        lastName: string | null;
        updatedAt: Date;
        status: string;
        managerId: string;
        riskBand: string | null;
        notes: string | null;
        propertyId: string | null;
        depositHeld: number;
        totalStays: number;
        totalDisputes: number;
        balanceUsdc: number;
        balancePab: number;
        lastStayAt: Date | null;
    } | null>;
    updateTenantRisk(tenantId: string, riskBand: string): Promise<{
        email: string;
        phone: string | null;
        id: string;
        createdAt: Date;
        firstName: string | null;
        lastName: string | null;
        updatedAt: Date;
        status: string;
        managerId: string;
        riskBand: string | null;
        notes: string | null;
        propertyId: string | null;
        depositHeld: number;
        totalStays: number;
        totalDisputes: number;
        balanceUsdc: number;
        balancePab: number;
        lastStayAt: Date | null;
    }>;
}
export declare class AbodeLeaseService {
    getLeases(managerId: string, status?: string): Promise<({
        property: {
            title: string;
            address: string | null;
        } | null;
        unit: {
            unitNumber: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        depositAmount: number;
        notes: string | null;
        propertyId: string | null;
        rentAmount: number;
        rentPeriod: string;
        unitId: string | null;
        tenantEmail: string;
        tenantName: string | null;
        startDate: Date;
        endDate: Date;
        petFee: number;
        petMonthly: number;
        lateFee: number;
        lateGraceDays: number;
        utilities: string[];
        renewalTerms: string | null;
        terminationNoticeDays: number;
        tenantId: string | null;
    })[]>;
    createLease(data: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        depositAmount: number;
        notes: string | null;
        propertyId: string | null;
        rentAmount: number;
        rentPeriod: string;
        unitId: string | null;
        tenantEmail: string;
        tenantName: string | null;
        startDate: Date;
        endDate: Date;
        petFee: number;
        petMonthly: number;
        lateFee: number;
        lateGraceDays: number;
        utilities: string[];
        renewalTerms: string | null;
        terminationNoticeDays: number;
        tenantId: string | null;
    }>;
    renewLease(leaseId: string, data: {
        endDate: Date;
        rentAmount?: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        depositAmount: number;
        notes: string | null;
        propertyId: string | null;
        rentAmount: number;
        rentPeriod: string;
        unitId: string | null;
        tenantEmail: string;
        tenantName: string | null;
        startDate: Date;
        endDate: Date;
        petFee: number;
        petMonthly: number;
        lateFee: number;
        lateGraceDays: number;
        utilities: string[];
        renewalTerms: string | null;
        terminationNoticeDays: number;
        tenantId: string | null;
    }>;
    terminateLease(leaseId: string, reason?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        depositAmount: number;
        notes: string | null;
        propertyId: string | null;
        rentAmount: number;
        rentPeriod: string;
        unitId: string | null;
        tenantEmail: string;
        tenantName: string | null;
        startDate: Date;
        endDate: Date;
        petFee: number;
        petMonthly: number;
        lateFee: number;
        lateGraceDays: number;
        utilities: string[];
        renewalTerms: string | null;
        terminationNoticeDays: number;
        tenantId: string | null;
    }>;
}
export declare class AbodeMaintenanceService {
    submitRequest(tenantId: string, data: {
        category: string;
        description: string;
        priority: string;
        photos?: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        title: string;
        notes: string | null;
        description: string | null;
        resolvedAt: Date | null;
        priority: string;
        propertyId: string | null;
        unitId: string | null;
        tenantEmail: string | null;
        tenantId: string | null;
        cost: number | null;
        vendorId: string | null;
        vendorName: string | null;
        vendorNotes: string | null;
    }>;
    getRequests(managerId: string, status?: string): Promise<({
        property: {
            title: string;
        } | null;
        unit: {
            unitNumber: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        title: string;
        notes: string | null;
        description: string | null;
        resolvedAt: Date | null;
        priority: string;
        propertyId: string | null;
        unitId: string | null;
        tenantEmail: string | null;
        tenantId: string | null;
        cost: number | null;
        vendorId: string | null;
        vendorName: string | null;
        vendorNotes: string | null;
    })[]>;
    updateRequestStatus(requestId: string, status: string, notes?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        title: string;
        notes: string | null;
        description: string | null;
        resolvedAt: Date | null;
        priority: string;
        propertyId: string | null;
        unitId: string | null;
        tenantEmail: string | null;
        tenantId: string | null;
        cost: number | null;
        vendorId: string | null;
        vendorName: string | null;
        vendorNotes: string | null;
    }>;
    assignVendor(requestId: string, vendorId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        managerId: string;
        title: string;
        notes: string | null;
        description: string | null;
        resolvedAt: Date | null;
        priority: string;
        propertyId: string | null;
        unitId: string | null;
        tenantEmail: string | null;
        tenantId: string | null;
        cost: number | null;
        vendorId: string | null;
        vendorName: string | null;
        vendorNotes: string | null;
    }>;
}
export declare class AbodeCommunicationService {
    sendMessage(propertyId: string, senderEmail: string, recipientEmail: string, body: string): Promise<{
        id: string;
        createdAt: Date;
        body: string;
        subject: string | null;
        propertyId: string;
        senderId: string | null;
        unitId: string | null;
        mimeType: string;
        conversationId: string;
        senderEmail: string | null;
        senderName: string | null;
        recipientId: string | null;
        recipientEmail: string | null;
        isRead: boolean;
        readAt: Date | null;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    broadcastToTenants(propertyId: string, message: string): Promise<{
        success: boolean;
        recipientCount: number;
    }>;
    getMessageHistory(conversationId: string): Promise<{
        id: string;
        createdAt: Date;
        body: string;
        subject: string | null;
        propertyId: string;
        senderId: string | null;
        unitId: string | null;
        mimeType: string;
        conversationId: string;
        senderEmail: string | null;
        senderName: string | null;
        recipientId: string | null;
        recipientEmail: string | null;
        isRead: boolean;
        readAt: Date | null;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
}
export declare const abodeRevenue: AbodeRevenueService;
export declare const abodeTenant: AbodeTenantService;
export declare const abodeLease: AbodeLeaseService;
export declare const abodeMaintenance: AbodeMaintenanceService;
export declare const abodeCommunication: AbodeCommunicationService;
//# sourceMappingURL=abode.service.d.ts.map