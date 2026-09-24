export type RentAutomationRun = {
    processed: number;
    remindersSent: number;
    lateFeesApplied: number;
    errors: string[];
};
export declare const rentAutomationService: {
    /**
     * Daily job: scan active leases, generate pending rent payments for the period,
     * send reminders, and apply late fees after grace period.
     */
    runDailyRentAutomation(): Promise<RentAutomationRun>;
    /**
     * Mark a rent payment as paid.
     */
    markRentPaid(paymentId: string, method: string, reference?: string): Promise<{
        property: {
            manager: ({
                user: {
                    email: string;
                };
            } & {
                id: string;
                companyName: string | null;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                logoUrl: string | null;
                slug: string | null;
                domain: string | null;
                brandColor: string | null;
                tagline: string | null;
                active: boolean;
                businessType: string;
            }) | null;
        } & {
            state: string | null;
            id: string;
            companyName: string | null;
            createdAt: Date;
            updatedAt: Date;
            userId: string | null;
            logoUrl: string | null;
            managerId: string | null;
            status: string;
            address: string | null;
            city: string | null;
            country: string;
            latitude: number | null;
            longitude: number | null;
            slug: string | null;
            domain: string | null;
            title: string;
            propertyId: string | null;
            zip: string | null;
            bedrooms: number;
            bathrooms: number;
            rentAmount: number | null;
            rentPeriod: string;
            brandColor: string | null;
            tagline: string | null;
            active: boolean;
            businessType: string;
        };
    } & {
        method: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        notes: string | null;
        amount: number;
        paidAt: Date | null;
        propertyId: string;
        unitId: string | null;
        tenantEmail: string;
        reference: string | null;
        dueDate: Date;
    }>;
};
//# sourceMappingURL=rentAutomation.service.d.ts.map