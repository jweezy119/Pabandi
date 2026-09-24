export interface Alert {
    id: string;
    type: 'info' | 'warning' | 'critical' | 'opportunity';
    title: string;
    message: string;
    entityType: 'client' | 'job' | 'payment' | 'provider';
    entityId: string;
    createdAt: Date;
    dismissed: boolean;
}
type AlertSeed = Omit<Alert, 'id' | 'createdAt' | 'dismissed'>;
/**
 * Generate alerts for a business based on client, job, and employee data.
 * This is the core rule engine of the trust-aware revenue system.
 */
export declare function generateAlerts(serviceBusinessId: string): Promise<AlertSeed[]>;
/**
 * Get active (non-dismissed) alerts for a business.
 * Generates fresh alerts from current data and merges with stored ones.
 */
export declare function getActiveAlerts(serviceBusinessId: string): Promise<any[]>;
/**
 * Dismiss an alert by ID.
 */
export declare function dismissAlert(alertId: string, serviceBusinessId: string): Promise<any>;
export {};
//# sourceMappingURL=alerts.service.d.ts.map