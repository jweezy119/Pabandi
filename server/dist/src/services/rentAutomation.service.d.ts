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
                userId: string;
                createdAt: Date;
                companyName: string | null;
                updatedAt: Date;
                tagline: string | null;
                logoUrl: string | null;
                slug: string | null;
                domain: string | null;
                active: boolean;
                businessType: string;
                brandColor: string | null;
            }) | null;
        } & {
            id: string;
            userId: string | null;
            createdAt: Date;
            companyName: string | null;
            updatedAt: Date;
            tagline: string | null;
            status: string;
            state: string | null;
            logoUrl: string | null;
            managerId: string | null;
            title: string;
            address: string | null;
            city: string | null;
            country: string;
            latitude: number | null;
            longitude: number | null;
            slug: string | null;
            domain: string | null;
            bedrooms: number;
            propertyId: string | null;
            active: boolean;
            businessType: string;
            brandColor: string | null;
            zip: string | null;
            bathrooms: number;
            rentAmount: number | null;
            rentPeriod: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        method: string | null;
        notes: string | null;
        amount: number;
        dueDate: Date;
        propertyId: string;
        unitId: string | null;
        tenantEmail: string;
        paidAt: Date | null;
        reference: string | null;
    }>;
};
//# sourceMappingURL=rentAutomation.service.d.ts.map