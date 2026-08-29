"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookManager = exports.OpenWAWebhookManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const whatsapp_service_1 = require("./whatsapp.service");
const logger_1 = require("../utils/logger");
const PABANDI_WEBHOOK_SECRET = process.env.OPENWA_WEBHOOK_SECRET || 'pabandi-webhook-secret-' + (process.env.NODE_ENV || 'development');
const PABANDI_BASE_URL = (process.env.PABANDI_API_URL || process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
const WEBHOOK_PATH = '/api/v1/openwa/webhook/incoming';
const HEALTH_CHECK_INTERVAL_MS = 60000;
const REGISTRATION_RETRY_DELAY_MS = 10000;
const MAX_REGISTRATION_RETRIES = 5;
// ---------------------------------------------------------------------------
// The webhook manager
// ---------------------------------------------------------------------------
class OpenWAWebhookManager {
    constructor() {
        this.registeredWebhookId = null;
        this.sessionId = null;
        this.healthCheckTimer = null;
        this.handlers = new Map();
        this.started = false;
    }
    /** The HMAC secret used to sign payloads. */
    get secret() {
        return PABANDI_WEBHOOK_SECRET;
    }
    /** The full callback URL that OpenWA should POST to. */
    get callbackUrl() {
        return `${PABANDI_BASE_URL}${WEBHOOK_PATH}`;
    }
    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------
    /**
     * Boot the webhook manager: resolve session, register webhook, start
     * health-check loop. Should be called once on server startup.
     */
    async start() {
        if (this.started)
            return;
        this.started = true;
        logger_1.logger.info('[WebhookManager] Starting OpenWA webhook manager...');
        let retries = 0;
        while (retries < MAX_REGISTRATION_RETRIES) {
            try {
                this.sessionId = await whatsapp_service_1.openwaService.resolveSessionId();
                await this.ensureWebhook();
                logger_1.logger.info(`[WebhookManager] Webhook registered for session ${this.sessionId} → ${this.callbackUrl}`);
                break;
            }
            catch (error) {
                retries += 1;
                logger_1.logger.warn(`[WebhookManager] Registration attempt ${retries}/${MAX_REGISTRATION_RETRIES} failed: ${error?.message || error}`);
                if (retries < MAX_REGISTRATION_RETRIES) {
                    await this.sleep(REGISTRATION_RETRY_DELAY_MS);
                }
            }
        }
        // Start health-check loop
        this.healthCheckTimer = setInterval(() => {
            this.runHealthCheck().catch(err => logger_1.logger.error(`[WebhookManager] Health check error: ${err?.message || err}`));
        }, HEALTH_CHECK_INTERVAL_MS);
    }
    /** Graceful shutdown: remove webhook and stop health-check. */
    async stop() {
        this.started = false;
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        if (this.registeredWebhookId && this.sessionId) {
            try {
                await whatsapp_service_1.openwaService.deleteWebhook(this.sessionId, this.registeredWebhookId);
                logger_1.logger.info(`[WebhookManager] Webhook ${this.registeredWebhookId} deleted on shutdown`);
            }
            catch (error) {
                logger_1.logger.warn(`[WebhookManager] Failed to delete webhook on shutdown: ${error?.message || error}`);
            }
        }
        this.registeredWebhookId = null;
        this.sessionId = null;
    }
    // -----------------------------------------------------------------------
    // Handler registration
    // -----------------------------------------------------------------------
    /**
     * Register a handler for a specific event type (e.g. `message.received`).
     * Use `*` to handle all events.
     */
    onEvent(event, handler) {
        const existing = this.handlers.get(event) || [];
        existing.push(handler);
        this.handlers.set(event, existing);
    }
    /**
     * Dispatch a webhook payload to all matching handlers.
     */
    async dispatch(payload) {
        const event = payload.event;
        // Run wildcard handlers
        const wildcardHandlers = this.handlers.get('*') || [];
        for (const handler of wildcardHandlers) {
            try {
                await handler(payload);
            }
            catch (error) {
                logger_1.logger.error(`[WebhookManager] Wildcard handler error: ${error?.message || error}`);
            }
        }
        // Run event-specific handlers
        const eventHandlers = this.handlers.get(event) || [];
        for (const handler of eventHandlers) {
            try {
                await handler(payload);
            }
            catch (error) {
                logger_1.logger.error(`[WebhookManager] Handler error for ${event}: ${error?.message || error}`);
            }
        }
        // Also emit on the OpenWA service EventEmitter for ad-hoc consumers
        whatsapp_service_1.openwaService.emit(`webhook:${event}`, payload);
        whatsapp_service_1.openwaService.emit('webhook:*', payload);
    }
    // -----------------------------------------------------------------------
    // HMAC verification
    // -----------------------------------------------------------------------
    /**
     * Verify the HMAC-SHA256 signature of an incoming webhook request body.
     * Returns `true` if valid, `false` otherwise.
     */
    verifySignature(rawBody, signature) {
        if (!signature)
            return false;
        const expected = crypto_1.default
            .createHmac('sha256', PABANDI_WEBHOOK_SECRET)
            .update(rawBody)
            .digest('hex');
        // Support "sha256=<hex>" prefix format
        const normalizedSig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
        try {
            return crypto_1.default.timingSafeEqual(Buffer.from(normalizedSig, 'hex'), Buffer.from(expected, 'hex'));
        }
        catch {
            return false;
        }
    }
    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------
    /**
     * Ensure the Pabandi webhook exists on the current session.
     * If there is already a matching webhook, update it if needed. Otherwise create one.
     */
    async ensureWebhook() {
        if (!this.sessionId) {
            throw new Error('Session ID not resolved');
        }
        const existing = await whatsapp_service_1.openwaService.listWebhooks(this.sessionId);
        // Find a webhook that already points to our callback URL
        const ourWebhook = existing.find(wh => wh.url === this.callbackUrl);
        if (ourWebhook) {
            this.registeredWebhookId = ourWebhook.id;
            logger_1.logger.info(`[WebhookManager] Reusing existing webhook ${ourWebhook.id}`);
            return;
        }
        // Create a new webhook that subscribes to all events we care about
        const created = await whatsapp_service_1.openwaService.createWebhook(this.sessionId, {
            url: this.callbackUrl,
            events: [
                'message.received',
                'message.sent',
                'message.ack',
                'message.failed',
                'message.reaction',
                'session.status',
                'session.disconnected',
            ],
            secret: PABANDI_WEBHOOK_SECRET,
            headers: {
                'X-Pabandi-Source': 'openwa-webhook-manager',
            },
            retryCount: 3,
        });
        this.registeredWebhookId = created.id;
    }
    /** Periodic health check: verify session is alive, re-register webhook if needed. */
    async runHealthCheck() {
        const health = await whatsapp_service_1.openwaService.healthCheck();
        if (health.status === 'unreachable') {
            logger_1.logger.warn('[WebhookManager] OpenWA is unreachable');
            return;
        }
        // Re-resolve session if needed
        if (this.sessionId) {
            try {
                const session = await whatsapp_service_1.openwaService.getSession(this.sessionId);
                if (!session.connected && session.status !== 'connected') {
                    logger_1.logger.warn(`[WebhookManager] Session ${this.sessionId} is not connected (status: ${session.status})`);
                }
            }
            catch {
                // Session may have been deleted; re-resolve
                logger_1.logger.warn(`[WebhookManager] Session ${this.sessionId} not found, re-resolving...`);
                this.sessionId = await whatsapp_service_1.openwaService.resolveSessionId();
                this.registeredWebhookId = null;
                await this.ensureWebhook();
            }
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.OpenWAWebhookManager = OpenWAWebhookManager;
exports.webhookManager = new OpenWAWebhookManager();
//# sourceMappingURL=openwa.webhook-manager.service.js.map