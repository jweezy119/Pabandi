import { WhatsAppProvider } from './whatsapp.provider';
import { OpenWASession, OpenWAMessageSendResult, OpenWAWebhookCreate, OpenWAWebhook, OpenWAContact, OpenWACatalogProduct, OpenWABulkMessage, OpenWABulkResult, OpenWABatchStatus } from './openwa.service';
export declare class EvolutionProvider implements WhatsAppProvider {
    private emitter;
    constructor();
    on(event: string, handler: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    private request;
    listSessions(): Promise<OpenWASession[]>;
    createSession(name?: string): Promise<OpenWASession>;
    getSession(sessionId: string): Promise<OpenWASession>;
    findBestSession(): Promise<OpenWASession | null>;
    resolveSessionId(): Promise<string>;
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
    sendPresence(chatId: string, type: 'composing' | 'recording' | 'available' | 'unavailable', options?: {
        sessionId?: string;
    }): Promise<void>;
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
}
//# sourceMappingURL=evolution.service.d.ts.map