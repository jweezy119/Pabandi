"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
const EVOLUTION_BASE_URL = (process.env.EVOLUTION_API_URL || process.env.OPENWA_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || process.env.OPENWA_API_KEY || '';
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE_ID || process.env.OPENWA_SESSION_ID || 'pabandi-main';
class EvolutionProvider {
    constructor() {
        this.emitter = new events_1.EventEmitter();
    }
    on(event, handler) {
        this.emitter.on(event, handler);
    }
    emit(event, ...args) {
        this.emitter.emit(event, ...args);
    }
    async request(path, init) {
        const url = `${EVOLUTION_BASE_URL}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
        };
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
    // --- Session Management ---
    async listSessions() {
        const instances = await this.request('/instance/fetchInstances');
        return instances.map((inst) => ({
            id: inst.instance.instanceName,
            name: inst.instance.instanceName,
            engine: 'baileys',
            status: inst.instance.status,
            connected: inst.instance.status === 'open',
        }));
    }
    async createSession(name) {
        const instanceName = name || DEFAULT_INSTANCE;
        const result = await this.request('/instance/create', {
            method: 'POST',
            body: { instanceName, qrcode: true }
        });
        return {
            id: result.instance.instanceName,
            name: result.instance.instanceName,
            engine: 'baileys',
            status: result.instance.status,
        };
    }
    async getSession(sessionId) {
        const state = await this.request(`/instance/connectionState/${encodeURIComponent(sessionId)}`);
        return {
            id: sessionId,
            name: sessionId,
            engine: 'baileys',
            status: state.instance.state,
            connected: state.instance.state === 'open'
        };
    }
    async findBestSession() {
        const sessions = await this.listSessions();
        const connected = sessions.filter(s => s.connected);
        const named = connected.find(s => s.id === DEFAULT_INSTANCE);
        return named || connected[0] || sessions[0] || null;
    }
    async resolveSessionId() {
        const best = await this.findBestSession();
        return best?.id || DEFAULT_INSTANCE;
    }
    // --- Messaging ---
    async sendText(toPhone, message, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        const result = await this.request(`/message/sendText/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { number: toPhone, text: message }
        });
        return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
    }
    async sendTextWithBestSession(toPhone, message, options) {
        const sessionId = await this.resolveSessionId();
        return this.sendText(toPhone, message, { sessionId, ...options });
    }
    async sendTextToBusiness(businessPhone, message, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE; // Multi-instance logic can route by businessId here later
        return this.sendText(businessPhone, message, { sessionId, ...options });
    }
    async sendImage(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        const result = await this.request(`/message/sendMedia/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { number: toPhone, media: mediaUrl, mediatype: 'image', caption: options?.caption }
        });
        return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
    }
    async sendVideo(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        const result = await this.request(`/message/sendMedia/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { number: toPhone, media: mediaUrl, mediatype: 'video', caption: options?.caption }
        });
        return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
    }
    async sendDocument(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        const result = await this.request(`/message/sendMedia/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { number: toPhone, media: mediaUrl, mediatype: 'document', fileName: options?.filename, caption: options?.caption }
        });
        return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
    }
    async sendAudio(toPhone, mediaUrl, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        const result = await this.request(`/message/sendWhatsAppAudio/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { number: toPhone, audio: mediaUrl }
        });
        return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
    }
    async sendReaction(messageId, emoji, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        await this.request(`/message/sendReaction/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { reactionMessage: { key: { id: messageId }, reaction: emoji } }
        });
        return { success: true };
    }
    async reply(chatId, quotedMessageId, text, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        const result = await this.request(`/message/sendText/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { number: chatId, text, quoted: { key: { id: quotedMessageId } } }
        });
        return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
    }
    async sendTemplate(chatId, templateName, variables, options) {
        // Evolution API doesn't have a direct "sendTemplate" mapping unless it's Official WhatsApp Cloud API.
        // For Baileys, we usually just render the text and send it, or use Buttons (if supported).
        // Stubbing this to render locally and send as text for now.
        const rendered = `${templateName} [Evolution Fallback Template Rendering needed]`;
        return this.sendText(chatId, rendered, options);
    }
    // --- V2 Feature: Send Presence ---
    async sendPresence(chatId, type, options) {
        const sessionId = options?.sessionId || DEFAULT_INSTANCE;
        await this.request(`/chat/sendPresence/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { number: chatId, delay: 1000, presence: type }
        });
    }
    // --- Stubs for less critical OpenWA methods (to satisfy the interface during migration) ---
    async createWebhook(sessionId, webhook) {
        await this.request(`/webhook/set/${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            body: { enabled: true, url: webhook.url, webhook_by_events: false, events: webhook.events || ['MESSAGES_UPSERT'] }
        });
        return { id: 'evolution_webhook', sessionId, url: webhook.url, events: webhook.events || [], active: true, retryCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
    async listWebhooks(sessionId) { return []; }
    async deleteWebhook(sessionId, webhookId) { }
    async testWebhook(sessionId, webhookId) { return { success: true }; }
    async getContacts(sessionId) { return []; }
    async getContact(contactId, sessionId) { return { id: contactId }; }
    async checkNumber(phone, sessionId) {
        const sid = sessionId || DEFAULT_INSTANCE;
        const result = await this.request(`/chat/whatsappNumbers/${encodeURIComponent(sid)}`, { method: 'POST', body: { numbers: [phone] } });
        const data = result[0];
        return { number: phone, exists: data?.exists, whatsappId: data?.jid };
    }
    async getProfilePicture(contactId, sessionId) { return { url: null }; }
    async getLabels(sessionId) { return []; }
    async assignLabel(chatId, labelId, sessionId) { return { success: true }; }
    async getCatalog(sessionId) { console.warn('[Evolution] getCatalog not supported'); return null; }
    async getProducts(sessionId, page, limit) { console.warn('[Evolution] getProducts not supported'); return { products: [], total: 0 }; }
    async sendProduct(chatId, productId, body, sessionId) { console.warn('[Evolution] sendProduct not supported'); return { status: 'failed' }; }
    async sendCatalog(chatId, body, sessionId) { console.warn('[Evolution] sendCatalog not supported'); return { status: 'failed' }; }
    async sendBulk(messages, options) { return { batchId: 'evolution_bulk', status: 'queued', totalMessages: messages.length }; }
    async getBatchStatus(batchId, sessionId) { return { batchId, status: 'completed' }; }
    async cancelBatch(batchId, sessionId) { return { batchId, status: 'cancelled' }; }
    async getChatHistory(chatId, options) { return []; }
    async getAudit(params) { return null; }
    async healthCheck() {
        try {
            await this.listSessions();
            return { status: 'ok' };
        }
        catch {
            return { status: 'unreachable' };
        }
    }
}
exports.EvolutionProvider = EvolutionProvider;
//# sourceMappingURL=evolution.service.js.map