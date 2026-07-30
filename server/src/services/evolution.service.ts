import axios from 'axios';
import { EventEmitter } from 'events';
import { WhatsAppProvider } from './whatsapp.provider';
import {
  OpenWASession,
  OpenWAMessageSendResult,
  OpenWAWebhookCreate,
  OpenWAWebhook,
  OpenWAContact,
  OpenWACatalogProduct,
  OpenWABulkMessage,
  OpenWABulkResult,
  OpenWABatchStatus
} from './openwa.service'; // We reuse these types for now as per V2 plan

const EVOLUTION_BASE_URL = (process.env.EVOLUTION_API_URL || process.env.OPENWA_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || process.env.OPENWA_API_KEY || '';
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE_ID || process.env.OPENWA_SESSION_ID || 'pabandi-main';

export class EvolutionProvider implements WhatsAppProvider {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  on(event: string, handler: (...args: any[]) => void): void {
    this.emitter.on(event, handler);
  }

  emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }

  private async request<T>(path: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): Promise<T> {
    const url = `${EVOLUTION_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    if (init?.headers) {
      Object.assign(headers, init.headers);
    }

    const response = await axios({
      url,
      method: (init?.method as any) || 'GET',
      headers,
      data: init?.body,
    });

    return response.data as T;
  }

  // --- Session Management ---

  async listSessions(): Promise<OpenWASession[]> {
    const instances = await this.request<any[]>('/instance/fetchInstances');
    return instances.map((inst: any) => ({
      id: inst.instance.instanceName,
      name: inst.instance.instanceName,
      engine: 'baileys',
      status: inst.instance.status,
      connected: inst.instance.status === 'open',
    }));
  }

  async createSession(name?: string): Promise<OpenWASession> {
    const instanceName = name || DEFAULT_INSTANCE;
    const result = await this.request<any>('/instance/create', {
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

  async getSession(sessionId: string): Promise<OpenWASession> {
    const state = await this.request<any>(`/instance/connectionState/${encodeURIComponent(sessionId)}`);
    return {
      id: sessionId,
      name: sessionId,
      engine: 'baileys',
      status: state.instance.state,
      connected: state.instance.state === 'open'
    };
  }

  async findBestSession(): Promise<OpenWASession | null> {
    const sessions = await this.listSessions();
    const connected = sessions.filter(s => s.connected);
    const named = connected.find(s => s.id === DEFAULT_INSTANCE);
    return named || connected[0] || sessions[0] || null;
  }

  async resolveSessionId(): Promise<string> {
    const best = await this.findBestSession();
    return best?.id || DEFAULT_INSTANCE;
  }

  // --- Messaging ---

  async sendText(toPhone: string, message: string, options?: { sessionId?: string; pluginContext?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    const result = await this.request<any>(`/message/sendText/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { number: toPhone, text: message }
    });
    return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
  }

  async sendTextWithBestSession(toPhone: string, message: string, options?: { pluginContext?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = await this.resolveSessionId();
    return this.sendText(toPhone, message, { sessionId, ...options });
  }

  async sendTextToBusiness(businessPhone: string, message: string, options?: { sessionId?: string; pluginContext?: string; businessId?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE; // Multi-instance logic can route by businessId here later
    return this.sendText(businessPhone, message, { sessionId, ...options });
  }

  async sendImage(toPhone: string, mediaUrl: string, options?: { caption?: string; sessionId?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    const result = await this.request<any>(`/message/sendMedia/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { number: toPhone, media: mediaUrl, mediatype: 'image', caption: options?.caption }
    });
    return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
  }

  async sendVideo(toPhone: string, mediaUrl: string, options?: { caption?: string; sessionId?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    const result = await this.request<any>(`/message/sendMedia/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { number: toPhone, media: mediaUrl, mediatype: 'video', caption: options?.caption }
    });
    return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
  }

  async sendDocument(toPhone: string, mediaUrl: string, options?: { caption?: string; filename?: string; sessionId?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    const result = await this.request<any>(`/message/sendMedia/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { number: toPhone, media: mediaUrl, mediatype: 'document', fileName: options?.filename, caption: options?.caption }
    });
    return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
  }

  async sendAudio(toPhone: string, mediaUrl: string, options?: { ptt?: boolean; sessionId?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    const result = await this.request<any>(`/message/sendWhatsAppAudio/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { number: toPhone, audio: mediaUrl }
    });
    return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
  }

  async sendReaction(messageId: string, emoji: string, options?: { chatId?: string; sessionId?: string }): Promise<{ success: boolean }> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    await this.request<any>(`/message/sendReaction/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { reactionMessage: { key: { id: messageId }, reaction: emoji } }
    });
    return { success: true };
  }

  async reply(chatId: string, quotedMessageId: string, text: string, options?: { sessionId?: string }): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    const result = await this.request<any>(`/message/sendText/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { number: chatId, text, quoted: { key: { id: quotedMessageId } } }
    });
    return { status: 'sent', messageId: result?.key?.id, engine: 'baileys' };
  }

  async sendTemplate(chatId: string, templateName: string, variables?: Record<string, string>, options?: { sessionId?: string }): Promise<OpenWAMessageSendResult> {
    // Evolution API doesn't have a direct "sendTemplate" mapping unless it's Official WhatsApp Cloud API.
    // For Baileys, we usually just render the text and send it, or use Buttons (if supported).
    // Stubbing this to render locally and send as text for now.
    const rendered = `${templateName} [Evolution Fallback Template Rendering needed]`;
    return this.sendText(chatId, rendered, options);
  }

  // --- V2 Feature: Send Presence ---
  async sendPresence(chatId: string, type: 'composing' | 'recording' | 'available' | 'unavailable', options?: { sessionId?: string }): Promise<void> {
    const sessionId = options?.sessionId || DEFAULT_INSTANCE;
    await this.request<any>(`/chat/sendPresence/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { number: chatId, delay: 1000, presence: type }
    });
  }

  // --- Stubs for less critical OpenWA methods (to satisfy the interface during migration) ---
  
  async createWebhook(sessionId: string, webhook: OpenWAWebhookCreate): Promise<OpenWAWebhook> {
    await this.request<any>(`/webhook/set/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: { enabled: true, url: webhook.url, webhook_by_events: false, events: webhook.events || ['MESSAGES_UPSERT'] }
    });
    return { id: 'evolution_webhook', sessionId, url: webhook.url, events: webhook.events || [], active: true, retryCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  async listWebhooks(sessionId: string): Promise<OpenWAWebhook[]> { return []; }
  async deleteWebhook(sessionId: string, webhookId: string): Promise<void> {}
  async testWebhook(sessionId: string, webhookId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> { return { success: true }; }
  
  async getContacts(sessionId?: string): Promise<OpenWAContact[]> { return []; }
  async getContact(contactId: string, sessionId?: string): Promise<OpenWAContact> { return { id: contactId }; }
  async checkNumber(phone: string, sessionId?: string): Promise<{ number: string; exists: boolean; whatsappId: string | null }> {
    const sid = sessionId || DEFAULT_INSTANCE;
    const result = await this.request<any[]>(`/chat/whatsappNumbers/${encodeURIComponent(sid)}`, { method: 'POST', body: { numbers: [phone] } });
    const data = result[0];
    return { number: phone, exists: data?.exists, whatsappId: data?.jid };
  }
  async getProfilePicture(contactId: string, sessionId?: string): Promise<{ url: string | null }> { return { url: null }; }
  
  async getLabels(sessionId?: string): Promise<unknown[]> { return []; }
  async assignLabel(chatId: string, labelId: string, sessionId?: string): Promise<{ success: boolean }> { return { success: true }; }
  
  async getCatalog(sessionId?: string): Promise<unknown> { console.warn('[Evolution] getCatalog not supported'); return null; }
  async getProducts(sessionId?: string, page?: number, limit?: number): Promise<{ products: OpenWACatalogProduct[]; total: number }> { console.warn('[Evolution] getProducts not supported'); return { products: [], total: 0 }; }
  async sendProduct(chatId: string, productId: string, body?: string, sessionId?: string): Promise<OpenWAMessageSendResult> { console.warn('[Evolution] sendProduct not supported'); return { status: 'failed' }; }
  async sendCatalog(chatId: string, body?: string, sessionId?: string): Promise<OpenWAMessageSendResult> { console.warn('[Evolution] sendCatalog not supported'); return { status: 'failed' }; }
  
  async sendBulk(messages: OpenWABulkMessage[], options?: { delayBetweenMessages?: number; sessionId?: string }): Promise<OpenWABulkResult> { return { batchId: 'evolution_bulk', status: 'queued', totalMessages: messages.length }; }
  async getBatchStatus(batchId: string, sessionId?: string): Promise<OpenWABatchStatus> { return { batchId, status: 'completed' }; }
  async cancelBatch(batchId: string, sessionId?: string): Promise<OpenWABatchStatus> { return { batchId, status: 'cancelled' }; }
  
  async getChatHistory(chatId: string, options?: { limit?: number; includeMedia?: boolean; sessionId?: string }): Promise<unknown[]> { return []; }
  async getAudit(params?: { action?: string; sessionId?: string }): Promise<unknown> { return null; }
  
  async healthCheck(): Promise<{ status: string; sessions?: number }> {
    try {
      await this.listSessions();
      return { status: 'ok' };
    } catch {
      return { status: 'unreachable' };
    }
  }
}
