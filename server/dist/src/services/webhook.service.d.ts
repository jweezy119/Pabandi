declare class WebhookService {
    private MAX_RETRIES;
    private RETRY_DELAY_MS;
    /**
     * Dispatches a webhook event to all subscribed active endpoints for a business.
     * @param eventName - The name of the event (e.g., 'reservation.created')
     * @param businessId - The business ID
     * @param payload - The data payload to send
     */
    dispatch(eventName: string, businessId: string, payload: any): Promise<void>;
    private sendWithRetry;
    /**
     * Dispatches an event to all OAuth Clients that have an active OAuthToken for the user,
     * provided they have configured a webhookUrl.
     */
    dispatchToOAuthClients(userId: string, eventName: string, payload: any): Promise<void>;
    create(managerId: string, url: string, events: string[], secret?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        url: string;
        secret: string | null;
        events: string[];
        lastTriggeredAt: Date | null;
        failureCount: number;
        managerId: string;
    }>;
    list(managerId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        url: string;
        secret: string | null;
        events: string[];
        lastTriggeredAt: Date | null;
        failureCount: number;
        managerId: string;
    }[]>;
    update(managerId: string, webhookId: string, data: {
        url?: string;
        events?: string[];
        isActive?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        url: string;
        secret: string | null;
        events: string[];
        lastTriggeredAt: Date | null;
        failureCount: number;
        managerId: string;
    }>;
    delete(managerId: string, webhookId: string): Promise<{
        success: boolean;
    }>;
}
export declare const webhookService: WebhookService;
export {};
//# sourceMappingURL=webhook.service.d.ts.map