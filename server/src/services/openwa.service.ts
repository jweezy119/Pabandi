import axios from 'axios';
import { EventEmitter } from 'events';

const OPENWA_BASE_URL = (process.env.OPENWA_API_URL || 'http://localhost:2785/api').replace(/\/$/, '');
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || '';
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || process.env.OPENWA_SESSION || 'default';

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

// ---------------------------------------------------------------------------
// Webhook types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Contact types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Catalog types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bulk message types
// ---------------------------------------------------------------------------

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
  progress?: { sent: number; failed: number; total: number };
  results?: unknown[];
  startedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class OpenWAService {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /** Emit internal events (e.g. webhook payloads forwarded to Pabandi consumers). */
  on(event: string, handler: (...args: unknown[]) => void) {
    this.emitter.on(event, handler);
  }

  emit(event: string, ...args: unknown[]) {
    this.emitter.emit(event, ...args);
  }

  // -------------------------------------------------------------------------
  // Low-level HTTP helper
  // -------------------------------------------------------------------------

  private async request<T>(path: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): Promise<T> {
    const url = `${OPENWA_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (OPENWA_API_KEY) {
      headers['X-API-Key'] = OPENWA_API_KEY;
    }

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

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  async listSessions(): Promise<OpenWASession[]> {
    return this.request<OpenWASession[]>('/sessions');
  }

  async createSession(name?: string): Promise<OpenWASession> {
    return this.request<OpenWASession>('/sessions', {
      method: 'POST',
      body: { name: name || OPENWA_SESSION_ID },
    });
  }

  async getSession(sessionId: string): Promise<OpenWASession> {
    return this.request<OpenWASession>(`/sessions/${encodeURIComponent(sessionId)}`);
  }

  async findBestSession(): Promise<OpenWASession | null> {
    try {
      const sessions = await this.listSessions();
      const connected = sessions.filter(session => session.connected || session.status === 'connected');
      const named = connected.find(session => session.id === OPENWA_SESSION_ID || session.name === OPENWA_SESSION_ID);
      return named || connected[0] || sessions[0] || null;
    } catch {
      return null;
    }
  }

  async resolveSessionId(): Promise<string> {
    const best = await this.findBestSession();
    return best?.id || OPENWA_SESSION_ID;
  }

  // -------------------------------------------------------------------------
  // Text messaging
  // -------------------------------------------------------------------------

  private toChatId(phone: string): string {
    return `${String(phone).replace(/[^\d]/g, '')}@c.us`;
  }

  async sendText(
    toPhone: string,
    message: string,
    options?: {
      sessionId?: string;
      pluginContext?: string;
    }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    const chatId = this.toChatId(toPhone);

    const payload: Record<string, unknown> = { chatId, text: message };
    if (options?.pluginContext) payload.pluginContext = options.pluginContext;

    const result = await this.request<{
      status?: string;
      id?: string;
      engine?: OpenWAEngine;
      plugins?: string[];
    }>(`/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
      method: 'POST',
      body: payload,
    });

    return {
      status: (result.status as OpenWAMessageSendResult['status']) || 'queued',
      messageId: result.id,
      engine: result.engine,
      plugins: result.plugins,
    };
  }

  async sendTextWithBestSession(
    toPhone: string,
    message: string,
    options?: { pluginContext?: string }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = await this.resolveSessionId();
    return this.sendText(toPhone, message, { sessionId, ...options });
  }

  async sendTextToBusiness(
    businessPhone: string,
    message: string,
    options?: {
      sessionId?: string;
      pluginContext?: string;
      businessId?: string;
    }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    const chatId = this.toChatId(businessPhone);

    const payload: Record<string, unknown> = { chatId, text: message };
    if (options?.pluginContext) payload.pluginContext = options.pluginContext;
    if (options?.businessId) payload.businessId = options.businessId;

    const result = await this.request<{
      status?: string;
      id?: string;
      engine?: OpenWAEngine;
      plugins?: string[];
    }>(`/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
      method: 'POST',
      body: payload,
    });

    return {
      status: (result.status as OpenWAMessageSendResult['status']) || 'queued',
      messageId: result.id,
      engine: result.engine,
      plugins: result.plugins,
    };
  }

  // -------------------------------------------------------------------------
  // Media messaging
  // -------------------------------------------------------------------------

  async sendImage(
    toPhone: string,
    mediaUrl: string,
    options?: { caption?: string; sessionId?: string }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-image`, {
      method: 'POST',
      body: { chatId: this.toChatId(toPhone), mediaUrl, caption: options?.caption },
    });
  }

  async sendVideo(
    toPhone: string,
    mediaUrl: string,
    options?: { caption?: string; sessionId?: string }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-video`, {
      method: 'POST',
      body: { chatId: this.toChatId(toPhone), mediaUrl, caption: options?.caption },
    });
  }

  async sendDocument(
    toPhone: string,
    mediaUrl: string,
    options?: { caption?: string; filename?: string; sessionId?: string }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-document`, {
      method: 'POST',
      body: { chatId: this.toChatId(toPhone), mediaUrl, caption: options?.caption, filename: options?.filename },
    });
  }

  async sendAudio(
    toPhone: string,
    mediaUrl: string,
    options?: { ptt?: boolean; sessionId?: string }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-audio`, {
      method: 'POST',
      body: { chatId: this.toChatId(toPhone), mediaUrl, ptt: options?.ptt },
    });
  }

  // -------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------

  async sendReaction(
    messageId: string,
    emoji: string,
    options?: { chatId?: string; sessionId?: string }
  ): Promise<{ success: boolean }> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/react`, {
      method: 'POST',
      body: { messageId, chatId: options?.chatId, emoji },
    });
  }

  // -------------------------------------------------------------------------
  // Reply / Forward
  // -------------------------------------------------------------------------

  async reply(
    chatId: string,
    quotedMessageId: string,
    text: string,
    options?: { sessionId?: string }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/reply`, {
      method: 'POST',
      body: { chatId, quotedMessageId, text },
    });
  }

  // -------------------------------------------------------------------------
  // Template messages
  // -------------------------------------------------------------------------

  async sendTemplate(
    chatId: string,
    templateName: string,
    variables?: Record<string, string>,
    options?: { sessionId?: string }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-template`, {
      method: 'POST',
      body: { chatId, templateName, variables },
    });
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  async createWebhook(sessionId: string, webhook: OpenWAWebhookCreate): Promise<OpenWAWebhook> {
    return this.request<OpenWAWebhook>(`/sessions/${encodeURIComponent(sessionId)}/webhooks`, {
      method: 'POST',
      body: webhook,
    });
  }

  async listWebhooks(sessionId: string): Promise<OpenWAWebhook[]> {
    return this.request<OpenWAWebhook[]>(`/sessions/${encodeURIComponent(sessionId)}/webhooks`);
  }

  async deleteWebhook(sessionId: string, webhookId: string): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(sessionId)}/webhooks/${encodeURIComponent(webhookId)}`, {
      method: 'DELETE',
    });
  }

  async testWebhook(sessionId: string, webhookId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/webhooks/${encodeURIComponent(webhookId)}/test`, {
      method: 'POST',
    });
  }

  // -------------------------------------------------------------------------
  // Contacts
  // -------------------------------------------------------------------------

  async getContacts(sessionId?: string): Promise<OpenWAContact[]> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request<OpenWAContact[]>(`/sessions/${encodeURIComponent(sid)}/contacts`);
  }

  async getContact(contactId: string, sessionId?: string): Promise<OpenWAContact> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request<OpenWAContact>(`/sessions/${encodeURIComponent(sid)}/contacts/${encodeURIComponent(contactId)}`);
  }

  async checkNumber(phone: string, sessionId?: string): Promise<{ number: string; exists: boolean; whatsappId: string | null }> {
    const sid = sessionId || OPENWA_SESSION_ID;
    const cleaned = String(phone).replace(/[^\d]/g, '');
    return this.request(`/sessions/${encodeURIComponent(sid)}/contacts/check/${encodeURIComponent(cleaned)}`);
  }

  async getProfilePicture(contactId: string, sessionId?: string): Promise<{ url: string | null }> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/contacts/${encodeURIComponent(contactId)}/profile-picture`);
  }

  // -------------------------------------------------------------------------
  // Labels
  // -------------------------------------------------------------------------

  async getLabels(sessionId?: string): Promise<unknown[]> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/labels`);
  }

  async assignLabel(chatId: string, labelId: string, sessionId?: string): Promise<{ success: boolean }> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/labels/${encodeURIComponent(labelId)}/chats`, {
      method: 'POST',
      body: { chatId },
    });
  }

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------

  async getCatalog(sessionId?: string): Promise<unknown> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/catalog`);
  }

  async getProducts(sessionId?: string, page = 1, limit = 20): Promise<{ products: OpenWACatalogProduct[]; total: number }> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/catalog/products?page=${page}&limit=${limit}`);
  }

  async sendProduct(chatId: string, productId: string, body?: string, sessionId?: string): Promise<OpenWAMessageSendResult> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/catalog/products/${encodeURIComponent(productId)}/send`, {
      method: 'POST',
      body: { chatId, body },
    });
  }

  async sendCatalog(chatId: string, body?: string, sessionId?: string): Promise<OpenWAMessageSendResult> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/catalog/send`, {
      method: 'POST',
      body: { chatId, body },
    });
  }

  // -------------------------------------------------------------------------
  // Bulk messaging
  // -------------------------------------------------------------------------

  async sendBulk(
    messages: OpenWABulkMessage[],
    options?: { delayBetweenMessages?: number; sessionId?: string }
  ): Promise<OpenWABulkResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/messages/send-bulk`, {
      method: 'POST',
      body: { messages, options: { delayBetweenMessages: options?.delayBetweenMessages || 3000 } },
    });
  }

  async getBatchStatus(batchId: string, sessionId?: string): Promise<OpenWABatchStatus> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/messages/batch/${encodeURIComponent(batchId)}`);
  }

  async cancelBatch(batchId: string, sessionId?: string): Promise<OpenWABatchStatus> {
    const sid = sessionId || OPENWA_SESSION_ID;
    return this.request(`/sessions/${encodeURIComponent(sid)}/messages/batch/${encodeURIComponent(batchId)}/cancel`, {
      method: 'POST',
    });
  }

  // -------------------------------------------------------------------------
  // Chat history
  // -------------------------------------------------------------------------

  async getChatHistory(
    chatId: string,
    options?: { limit?: number; includeMedia?: boolean; sessionId?: string }
  ): Promise<unknown[]> {
    const sid = options?.sessionId || OPENWA_SESSION_ID;
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.includeMedia) params.set('includeMedia', 'true');
    const qs = params.toString();
    return this.request(`/sessions/${encodeURIComponent(sid)}/messages/${encodeURIComponent(chatId)}/history${qs ? `?${qs}` : ''}`);
  }

  // -------------------------------------------------------------------------
  // Audit
  // -------------------------------------------------------------------------

  async getAudit(params?: { action?: string; sessionId?: string }): Promise<unknown> {
    const search = new URLSearchParams();
    if (params?.action) search.set('action', params.action);
    if (params?.sessionId) search.set('sessionId', params.sessionId);
    const qs = search.toString();
    return this.request<unknown>(`/audit${qs ? `?${qs}` : ''}`);
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async healthCheck(): Promise<{ status: string; sessions?: number }> {
    try {
      const result = await this.request<{ status: string; sessions?: number }>('/health');
      return result;
    } catch {
      return { status: 'unreachable' };
    }
  }
}

export const openwaService = new OpenWAService();
