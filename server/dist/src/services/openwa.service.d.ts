import { WhatsAppProvider } from './whatsapp.provider';
export type OpenWAEngine = 'baileys' | 'whatsapp-web.js';
export interface OpenWASession {
    id: string;
    name?: string;
    engine?: OpenWAEngine;
    status?: string;
    connected?: boolean;
    createdAt?: string;
}
export interface OpenWAMessageSendResult {
    status: 'queued' | 'sent' | 'failed';
    messageId?: string;
    engine?: OpenWAEngine;
    plugins?: string[];
}
export interface OpenWAWebhookFilterCondition {
    field: 'sender' | 'recipient' | 'body' | 'type' | 'mentions' | 'fromMe' | 'hasMedia' | 'isGroup';
    operator: 'is' | 'isNot' | 'contains' | 'startsWith' | 'endsWith' | 'matches';
    value: unknown;
}
export interface OpenWAWebhookFilters {
    conditions: OpenWAWebhookFilterCondition[];
}
export interface OpenWAWebhookCreate {
    url: string;
    events?: string[];
    secret?: string;
    headers?: Record<string, string>;
    filters?: OpenWAWebhookFilters | null;
    retryCount?: number;
}
export interface OpenWAWebhook {
    id: string;
    sessionId: string;
    url: string;
    events: string[];
    filters?: OpenWAWebhookFilters | null;
    active: boolean;
    retryCount: number;
    lastTriggeredAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface OpenWAContact {
    id: string;
    name?: string;
    shortName?: string;
    pushname?: string;
    number?: string;
    isGroup?: boolean;
    isMyContact?: boolean;
    profilePicUrl?: string;
}
export interface OpenWACatalogProduct {
    id: string;
    name: string;
    description?: string;
    price?: number;
    currency?: string;
    images?: string[];
    url?: string;
    availability?: string;
}
export interface OpenWABulkMessage {
    chatId: string;
    text?: string;
    mediaUrl?: string;
    caption?: string;
}
export interface OpenWABulkResult {
    batchId: string;
    status: string;
    totalMessages: number;
    estimatedCompletionTime?: string;
    statusUrl?: string;
}
export interface OpenWABatchStatus {
    batchId: string;
    status: string;
    progress?: {
        sent: number;
        failed: number;
        total: number;
    };
    results?: unknown[];
    startedAt?: string;
    completedAt?: string;
}
export declare class OpenWAService implements WhatsAppProvider {
    private emitter;
    constructor();
    /** Emit internal events (e.g. webhook payloads forwarded to Pabandi consumers). */
    on(event: string, handler: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;
    private request;
    listSessions(): Promise<OpenWASession[]>;
    createSession(name?: string): Promise<OpenWASession>;
    getSession(sessionId: string): Promise<OpenWASession>;
    findBestSession(): Promise<OpenWASession | null>;
    resolveSessionId(): Promise<string>;
    private toChatId;
    sendText(toPhone: string, message: string, options?: {
        sessionId?: string;
        pluginContext?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendTextWithBestSession(toPhone: string, message: string, options?: {
        pluginContext?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendTextToBusiness(businessPhone: string, message: string, options?: {
        sessionId?: string;
        pluginContext?: string;
        businessId?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendImage(toPhone: string, mediaUrl: string, options?: {
        caption?: string;
        sessionId?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendVideo(toPhone: string, mediaUrl: string, options?: {
        caption?: string;
        sessionId?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendDocument(toPhone: string, mediaUrl: string, options?: {
        caption?: string;
        filename?: string;
        sessionId?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendAudio(toPhone: string, mediaUrl: string, options?: {
        ptt?: boolean;
        sessionId?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendReaction(messageId: string, emoji: string, options?: {
        chatId?: string;
        sessionId?: string;
    }): Promise<{
        success: boolean;
    }>;
    reply(chatId: string, quotedMessageId: string, text: string, options?: {
        sessionId?: string;
    }): Promise<OpenWAMessageSendResult>;
    sendTemplate(chatId: string, templateName: string, variables?: Record<string, string>, options?: {
        sessionId?: string;
    }): Promise<OpenWAMessageSendResult>;
    createWebhook(sessionId: string, webhook: OpenWAWebhookCreate): Promise<OpenWAWebhook>;
    listWebhooks(sessionId: string): Promise<OpenWAWebhook[]>;
    deleteWebhook(sessionId: string, webhookId: string): Promise<void>;
    testWebhook(sessionId: string, webhookId: string): Promise<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>;
    getContacts(sessionId?: string): Promise<OpenWAContact[]>;
    getContact(contactId: string, sessionId?: string): Promise<OpenWAContact>;
    checkNumber(phone: string, sessionId?: string): Promise<{
        number: string;
        exists: boolean;
        whatsappId: string | null;
    }>;
    getProfilePicture(contactId: string, sessionId?: string): Promise<{
        url: string | null;
    }>;
    getLabels(sessionId?: string): Promise<unknown[]>;
    assignLabel(chatId: string, labelId: string, sessionId?: string): Promise<{
        success: boolean;
    }>;
    getCatalog(sessionId?: string): Promise<unknown>;
    getProducts(sessionId?: string, page?: number, limit?: number): Promise<{
        products: OpenWACatalogProduct[];
        total: number;
    }>;
    sendProduct(chatId: string, productId: string, body?: string, sessionId?: string): Promise<OpenWAMessageSendResult>;
    sendCatalog(chatId: string, body?: string, sessionId?: string): Promise<OpenWAMessageSendResult>;
    sendBulk(messages: OpenWABulkMessage[], options?: {
        delayBetweenMessages?: number;
        sessionId?: string;
    }): Promise<OpenWABulkResult>;
    getBatchStatus(batchId: string, sessionId?: string): Promise<OpenWABatchStatus>;
    cancelBatch(batchId: string, sessionId?: string): Promise<OpenWABatchStatus>;
    getChatHistory(chatId: string, options?: {
        limit?: number;
        includeMedia?: boolean;
        sessionId?: string;
    }): Promise<unknown[]>;
    getAudit(params?: {
        action?: string;
        sessionId?: string;
    }): Promise<unknown>;
    healthCheck(): Promise<{
        status: string;
        sessions?: number;
    }>;
    sendPresence(chatId: string, type: 'composing' | 'recording' | 'available' | 'unavailable', options?: {
        sessionId?: string;
    }): Promise<void>;
}
//# sourceMappingURL=openwa.service.d.ts.map