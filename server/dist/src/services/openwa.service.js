"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWAService = void 0;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
const OPENWA_BASE_URL = (process.env.OPENWA_API_URL || 'http://localhost:2785/api').replace(/\/$/, '');
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || '';
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || process.env.OPENWA_SESSION || 'default';
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
class OpenWAService {
    constructor() {
        this.emitter = new events_1.EventEmitter();
    }
    /** Emit internal events (e.g. webhook payloads forwarded to Pabandi consumers). */
    on(event, handler) {
        this.emitter.on(event, handler);
    }
    emit(event, ...args) {
        this.emitter.emit(event, ...args);
    }
    // -------------------------------------------------------------------------
    // Low-level HTTP helper
    // -------------------------------------------------------------------------
    async request(path, init) {
        const url = `${OPENWA_BASE_URL}${path}`;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (OPENWA_API_KEY) {
            headers['X-API-Key'] = OPENWA_API_KEY;
        }
        if (init?.headers) {
            Object.assign(headers, init.headers);
        }
        const response = await (0, axios_1.default)({
            url,
            method: init?.method || 'GET',
            headers,
            data: init?.body,
        });
        return response.data;
    }
    // -------------------------------------------------------------------------
    // Session management
    // -------------------------------------------------------------------------
    async listSessions() {
        return this.request('/sessions');
    }
    async createSession(name) {
        return this.request('/sessions', {
            method: 'POST',
            body: { name: name || OPENWA_SESSION_ID },
        });
    }
    async getSession(sessionId) {
        return this.request(`/sessions/${encodeURIComponent(sessionId)}`);
    }
    async findBestSession() {
        try {
            const sessions = await this.listSessions();
            const connected = sessions.filter(session => session.connected || session.status === 'connected');
            const named = connected.find(session => session.id === OPENWA_SESSION_ID || session.name === OPENWA_SESSION_ID);
            return named || connected[0] || sessions[0] || null;
        }
        catch {
            return null;
        }
    }
    async resolveSessionId() {
        const best = await this.findBestSession();
        return best?.id || OPENWA_SESSION_ID;
    }
    // -------------------------------------------------------------------------
    // Text messaging
    // -------------------------------------------------------------------------
    toChatId(phone) {
        return `${String(phone).replace(/[^\d]/g, '')}@c.us`;
    }
    async sendText(toPhone, message, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        const chatId = this.toChatId(toPhone);
        const payload = { chatId, text: message };
        if (options?.pluginContext)
            payload.pluginContext = options.pluginContext;
        const result = await this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
            method: 'POST',
            body: payload,
        });
        return {
            status: result.status || 'queued',
            messageId: result.id,
            engine: result.engine,
            plugins: result.plugins,
        };
    }
    async sendTextWithBestSession(toPhone, message, options) {
        const sessionId = await this.resolveSessionId();
        return this.sendText(toPhone, message, { sessionId, ...options });
    }
    async sendTextToBusiness(businessPhone, message, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        const chatId = this.toChatId(businessPhone);
        const payload = { chatId, text: message };
        if (options?.pluginContext)
            payload.pluginContext = options.pluginContext;
        if (options?.businessId)
            payload.businessId = options.businessId;
        const result = await this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
            method: 'POST',
            body: payload,
        });
        return {
            status: result.status || 'queued',
            messageId: result.id,
            engine: result.engine,
            plugins: result.plugins,
        };
    }
    // -------------------------------------------------------------------------
    // Media messaging
    // -------------------------------------------------------------------------
    async sendImage(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-image`, {
            method: 'POST',
            body: { chatId: this.toChatId(toPhone), mediaUrl, caption: options?.caption },
        });
    }
    async sendVideo(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-video`, {
            method: 'POST',
            body: { chatId: this.toChatId(toPhone), mediaUrl, caption: options?.caption },
        });
    }
    async sendDocument(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-document`, {
            method: 'POST',
            body: { chatId: this.toChatId(toPhone), mediaUrl, caption: options?.caption, filename: options?.filename },
        });
    }
    async sendAudio(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-audio`, {
            method: 'POST',
            body: { chatId: this.toChatId(toPhone), mediaUrl, ptt: options?.ptt },
        });
    }
    // -------------------------------------------------------------------------
    // Reactions
    // -------------------------------------------------------------------------
    async sendReaction(messageId, emoji, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/react`, {
            method: 'POST',
            body: { messageId, chatId: options?.chatId, emoji },
        });
    }
    // -------------------------------------------------------------------------
    // Reply / Forward
    // -------------------------------------------------------------------------
    async reply(chatId, quotedMessageId, text, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/reply`, {
            method: 'POST',
            body: { chatId, quotedMessageId, text },
        });
    }
    // -------------------------------------------------------------------------
    // Template messages
    // -------------------------------------------------------------------------
    async sendTemplate(chatId, templateName, variables, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-template`, {
            method: 'POST',
            body: { chatId, templateName, variables },
        });
    }
    // -------------------------------------------------------------------------
    // Webhooks
    // -------------------------------------------------------------------------
    async createWebhook(sessionId, webhook) {
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/webhooks`, {
            method: 'POST',
            body: webhook,
        });
    }
    async listWebhooks(sessionId) {
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/webhooks`);
    }
    async deleteWebhook(sessionId, webhookId) {
        await this.request(`/sessions/${encodeURIComponent(sessionId)}/webhooks/${encodeURIComponent(webhookId)}`, {
            method: 'DELETE',
        });
    }
    async testWebhook(sessionId, webhookId) {
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/webhooks/${encodeURIComponent(webhookId)}/test`, {
            method: 'POST',
        });
    }
    // -------------------------------------------------------------------------
    // Contacts
    // -------------------------------------------------------------------------
    async getContacts(sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/contacts`);
    }
    async getContact(contactId, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/contacts/${encodeURIComponent(contactId)}`);
    }
    async checkNumber(phone, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        const cleaned = String(phone).replace(/[^\d]/g, '');
        return this.request(`/sessions/${encodeURIComponent(sid)}/contacts/check/${encodeURIComponent(cleaned)}`);
    }
    async getProfilePicture(contactId, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/contacts/${encodeURIComponent(contactId)}/profile-picture`);
    }
    // -------------------------------------------------------------------------
    // Labels
    // -------------------------------------------------------------------------
    async getLabels(sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/labels`);
    }
    async assignLabel(chatId, labelId, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/labels/${encodeURIComponent(labelId)}/chats`, {
            method: 'POST',
            body: { chatId },
        });
    }
    // -------------------------------------------------------------------------
    // Catalog
    // -------------------------------------------------------------------------
    async getCatalog(sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/catalog`);
    }
    async getProducts(sessionId, page = 1, limit = 20) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/catalog/products?page=${page}&limit=${limit}`);
    }
    async sendProduct(chatId, productId, body, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/catalog/products/${encodeURIComponent(productId)}/send`, {
            method: 'POST',
            body: { chatId, body },
        });
    }
    async sendCatalog(chatId, body, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/catalog/send`, {
            method: 'POST',
            body: { chatId, body },
        });
    }
    // -------------------------------------------------------------------------
    // Bulk messaging
    // -------------------------------------------------------------------------
    async sendBulk(messages, options) {
        const sessionId = options?.sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-bulk`, {
            method: 'POST',
            body: { messages, options: { delayBetweenMessages: options?.delayBetweenMessages || 3000 } },
        });
    }
    async getBatchStatus(batchId, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/messages/batch/${encodeURIComponent(batchId)}`);
    }
    async cancelBatch(batchId, sessionId) {
        const sid = sessionId || OPENWA_SESSION_ID;
        return this.request(`/sessions/${encodeURIComponent(sid)}/messages/batch/${encodeURIComponent(batchId)}/cancel`, {
            method: 'POST',
        });
    }
    // -------------------------------------------------------------------------
    // Chat history
    // -------------------------------------------------------------------------
    async getChatHistory(chatId, options) {
        const sid = options?.sessionId || OPENWA_SESSION_ID;
        const params = new URLSearchParams();
        if (options?.limit)
            params.set('limit', String(options.limit));
        if (options?.includeMedia)
            params.set('includeMedia', 'true');
        const qs = params.toString();
        return this.request(`/sessions/${encodeURIComponent(sid)}/messages/${encodeURIComponent(chatId)}/history${qs ? `?${qs}` : ''}`);
    }
    // -------------------------------------------------------------------------
    // Audit
    // -------------------------------------------------------------------------
    async getAudit(params) {
        const search = new URLSearchParams();
        if (params?.action)
            search.set('action', params.action);
        if (params?.sessionId)
            search.set('sessionId', params.sessionId);
        const qs = search.toString();
        return this.request(`/audit${qs ? `?${qs}` : ''}`);
    }
    // -------------------------------------------------------------------------
    // Health
    // -------------------------------------------------------------------------
    async healthCheck() {
        try {
            const result = await this.request('/health');
            return result;
        }
        catch {
            return { status: 'unreachable' };
        }
    }
    async sendPresence(chatId, type, options) {
        // OpenWA doesn't support sendPresence natively via API out of the box in this wrapper,
        // so this is a no-op fallback.
        return Promise.resolve();
    }
}
exports.OpenWAService = OpenWAService;
//# sourceMappingURL=openwa.service.js.map