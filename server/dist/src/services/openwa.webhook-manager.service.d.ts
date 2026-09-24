export interface OpenWAWebhookPayload {
    event: string;
    sessionId: string;
    timestamp: string;
    data: {
        id?: string;
        chatId?: string;
        from?: string;
        to?: string;
        body?: string;
        type?: string;
        fromMe?: boolean;
        hasMedia?: boolean;
        isGroup?: boolean;
        ack?: number;
        mediaUrl?: string;
        sender?: {
            id: string;
            name?: string;
            pushname?: string;
        };
        quotedMessage?: {
            id: string;
            body?: string;
        };
        [key: string]: unknown;
    };
}
export type WebhookHandler = (payload: OpenWAWebhookPayload) => void | Promise<void>;
export declare class OpenWAWebhookManager {
    private registeredWebhookId;
    private sessionId;
    private healthCheckTimer;
    private handlers;
    private started;
    /** The HMAC secret used to sign payloads. */
    get secret(): string;
    /** The full callback URL that OpenWA should POST to. */
    get callbackUrl(): string;
    /**
     * Boot the webhook manager: resolve session, register webhook, start
     * health-check loop. Should be called once on server startup.
     */
    start(): Promise<void>;
    /** Graceful shutdown: remove webhook and stop health-check. */
    stop(): Promise<void>;
    /**
     * Register a handler for a specific event type (e.g. `message.received`).
     * Use `*` to handle all events.
     */
    onEvent(event: string, handler: WebhookHandler): void;
    /**
     * Dispatch a webhook payload to all matching handlers.
     */
    dispatch(payload: OpenWAWebhookPayload): Promise<void>;
    /**
     * Verify the HMAC-SHA256 signature of an incoming webhook request body.
     * Returns `true` if valid, `false` otherwise.
     */
    verifySignature(rawBody: string | Buffer, signature: string | undefined): boolean;
    /**
     * Ensure the Pabandi webhook exists on the current session.
     * If there is already a matching webhook, update it if needed. Otherwise create one.
     */
    private ensureWebhook;
    /** Periodic health check: verify session is alive, re-register webhook if needed. */
    private runHealthCheck;
    private sleep;
}
export declare const webhookManager: OpenWAWebhookManager;
//# sourceMappingURL=openwa.webhook-manager.service.d.ts.map