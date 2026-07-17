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

export class OpenWAService {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

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

  async sendText(
    toPhone: string,
    message: string,
    options?: {
      sessionId?: string;
      pluginContext?: string;
    }
  ): Promise<OpenWAMessageSendResult> {
    const sessionId = options?.sessionId || OPENWA_SESSION_ID;
    const chatId = `${String(toPhone).replace(/[^\d]/g, '')}@c.us`;

    const payload: Record<string, unknown> = {
      to: chatId,
      text: message,
    };

    if (options?.pluginContext) {
      payload.pluginContext = options.pluginContext;
    }

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

  async getAudit(params?: { action?: string; sessionId?: string }): Promise<unknown> {
    const search = new URLSearchParams();
    if (params?.action) search.set('action', params.action);
    if (params?.sessionId) search.set('sessionId', params.sessionId);
    const qs = search.toString();
    return this.request<unknown>(`/audit${qs ? `?${qs}` : ''}`);
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

  async sendTextWithBestSession(
    toPhone: string,
    message: string,
    options?: {
      pluginContext?: string;
    }
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
    const chatId = `${String(businessPhone).replace(/[^\d]/g, '')}@c.us`;

    const payload: Record<string, unknown> = {
      to: chatId,
      text: message,
    };

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
}

export const openwaService = new OpenWAService();
