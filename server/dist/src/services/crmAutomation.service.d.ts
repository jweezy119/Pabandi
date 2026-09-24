export interface RiskScoreResult {
    score: number;
    band: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: {
        label: string;
        impact: number;
    }[];
}
export declare const crmAutomationService: {
    generateMonthlyRent(): Promise<{
        generated: number;
        errors: string[];
    }>;
    applyLateFees(): Promise<{
        applied: number;
        totalAmount: number;
        errors: string[];
    }>;
    checkLeaseExpirations(): Promise<{
        notified: number;
        errors: string[];
    }>;
    autoAssignVendor(maintenanceId: string): Promise<{
        vendorId: string;
        score: number;
    } | null>;
    generatePropertyFinancials(propertyId: string, startDate: Date, endDate: Date): Promise<{
        propertyId: string;
        period: {
            start: Date;
            end: Date;
        };
        totalIncome: number;
        totalExpenses: number;
        rentCollected: number;
        lateFees: number;
        maintenanceExpenses: number;
        netOperatingIncome: number;
        estimatedValue: number | null;
        capRate: number | null;
    }>;
    generateCashFlowForecast(propertyId: string, months?: number): Promise<{
        propertyId: string;
        months: number;
        monthlyRent: number;
        vacancyRate: number;
        forecast: {
            month: string;
            expectedRent: number;
            vacancyRate: number;
        }[];
    }>;
    calculateTenantRiskScore(tenantId: string): Promise<RiskScoreResult>;
};
//# sourceMappingURL=crmAutomation.service.d.ts.map