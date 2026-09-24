/**
 * Fire webhooks for a given manager when a CRM event occurs.
 * Best-effort: failures are logged and counted but never block the caller.
 */
export declare function fireWebhooks(managerId: string, event: string, payload: any): Promise<void>;
/**
 * Record an activity in the CRM audit log.
 */
export declare function logActivity(managerId: string, action: string, entityType: string, entityId: string, description: string, metadata?: any): Promise<void>;
//# sourceMappingURL=pmWebhook.service.d.ts.map