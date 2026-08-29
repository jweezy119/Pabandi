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
}
export declare const webhookService: WebhookService;
export {};
//# sourceMappingURL=webhook.service.d.ts.map