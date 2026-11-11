import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface ApiKeyRecord {
  id: string;
  name: string;
  environment: 'test' | 'live';
  publishableKey: string;
  secretKeyMasked: string;
  secretKeyFull?: string; // Only returned on creation
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

export interface MerchantPayoutSettings {
  businessName: string;
  raastId: string;
  solanaWallet: string;
  jazzCashAccount: string;
  cardRouting: string;
  shariaCompliant: boolean;
  defaultCurrency: 'USD' | 'PKR';
  wakalaFeePercent: number;
  webhookUrl: string;
  webhookSecret: string;
  webhookEvents: string[];
}

export interface WebhookDeliveryLog {
  id: string;
  event: string;
  targetUrl: string;
  statusCode: number;
  latencyMs: number;
  payload: any;
  signature: string;
  timestamp: string;
  success: boolean;
  responseBody?: string;
}

export class DeveloperPortalService {
  private static instance: DeveloperPortalService;

  private apiKeys: Map<string, {
    id: string;
    name: string;
    environment: 'test' | 'live';
    publishableKey: string;
    secretKey: string;
    scopes: string[];
    createdAt: string;
    lastUsedAt: string | null;
    isActive: boolean;
  }> = new Map();

  private settings: MerchantPayoutSettings = {
    businessName: 'Pabandi Partner Merchant (Universal Escrow)',
    raastId: 'PK92HABB0001234567890101',
    solanaWallet: 'GsdP8LpG9YtWwR6j2xM8E1n4k3v7Q5z0PabandiEscrow',
    jazzCashAccount: '03001234567',
    cardRouting: 'square_connect_active',
    shariaCompliant: true,
    defaultCurrency: 'USD',
    wakalaFeePercent: 0.5,
    webhookUrl: 'https://api.example.com/webhooks/pabandi',
    webhookSecret: `whsec_${crypto.randomBytes(16).toString('hex')}`,
    webhookEvents: [
      'payment.created',
      'payment.escrow_locked',
      'payment.settled',
      'payment.disputed',
      'payout.completed',
    ],
  };

  private webhookLogs: WebhookDeliveryLog[] = [];

  private constructor() {
    this.seedDefaultKeys();
  }

  static getInstance(): DeveloperPortalService {
    if (!DeveloperPortalService.instance) {
      DeveloperPortalService.instance = new DeveloperPortalService();
    }
    return DeveloperPortalService.instance;
  }

  private seedDefaultKeys() {
    const testSecret = `sk_test_${crypto.randomBytes(18).toString('hex')}`;
    const liveSecret = `sk_live_${crypto.randomBytes(18).toString('hex')}`;

    const testKeyId = 'key_test_default_01';
    this.apiKeys.set(testKeyId, {
      id: testKeyId,
      name: 'Default Sandbox Key',
      environment: 'test',
      publishableKey: `pk_test_${crypto.randomBytes(12).toString('hex')}`,
      secretKey: testSecret,
      scopes: ['payments:read', 'payments:write', 'escrow:lock', 'ledger:read', 'webhooks:manage'],
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
      isActive: true,
    });

    const liveKeyId = 'key_live_default_02';
    this.apiKeys.set(liveKeyId, {
      id: liveKeyId,
      name: 'Production Storefront Key',
      environment: 'live',
      publishableKey: `pk_live_${crypto.randomBytes(12).toString('hex')}`,
      secretKey: liveSecret,
      scopes: ['payments:read', 'payments:write', 'escrow:lock', 'ledger:read'],
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      lastUsedAt: new Date(Date.now() - 1200000).toISOString(),
      isActive: true,
    });

    // Seed 2 initial webhook delivery logs
    this.webhookLogs.push({
      id: `whd_${Date.now() - 600000}`,
      event: 'payment.escrow_locked',
      targetUrl: this.settings.webhookUrl,
      statusCode: 200,
      latencyMs: 142,
      payload: {
        event: 'payment.escrow_locked',
        paymentId: 'pay_init_sol_002',
        amount: 350,
        currency: 'USDC',
        rail: 'solana',
        settlementSpeed: 'instant (<1s)',
        shariaMode: 'Mudarabah (0% Riba)',
      },
      signature: 'sha256=9b72a0c4d8...',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      success: true,
      responseBody: '{"received":true}',
    });
  }

  getApiKeys(): ApiKeyRecord[] {
    return Array.from(this.apiKeys.values()).map(k => ({
      id: k.id,
      name: k.name,
      environment: k.environment,
      publishableKey: k.publishableKey,
      secretKeyMasked: `${k.secretKey.substring(0, 8)}••••••••••••${k.secretKey.slice(-4)}`,
      scopes: k.scopes,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      isActive: k.isActive,
    }));
  }

  createApiKey(params: {
    name: string;
    environment: 'test' | 'live';
    scopes?: string[];
  }): ApiKeyRecord {
    const id = `key_${params.environment}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const prefix = params.environment === 'live' ? 'live' : 'test';
    const publishableKey = `pk_${prefix}_${crypto.randomBytes(12).toString('hex')}`;
    const secretKey = `sk_${prefix}_${crypto.randomBytes(18).toString('hex')}`;
    const now = new Date().toISOString();

    const record = {
      id,
      name: params.name || `${params.environment.toUpperCase()} API Key`,
      environment: params.environment,
      publishableKey,
      secretKey,
      scopes: params.scopes || ['payments:read', 'payments:write', 'escrow:lock'],
      createdAt: now,
      lastUsedAt: null,
      isActive: true,
    };

    this.apiKeys.set(id, record);
    logger.info(`[DeveloperPortal] Created API Key ${id} for ${params.name}`);

    return {
      id: record.id,
      name: record.name,
      environment: record.environment,
      publishableKey: record.publishableKey,
      secretKeyMasked: `${secretKey.substring(0, 8)}••••••••••••${secretKey.slice(-4)}`,
      secretKeyFull: secretKey,
      scopes: record.scopes,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      isActive: record.isActive,
    };
  }

  revokeApiKey(id: string): boolean {
    const key = this.apiKeys.get(id);
    if (!key) return false;
    key.isActive = false;
    this.apiKeys.set(id, key);
    logger.info(`[DeveloperPortal] Revoked API Key ${id}`);
    return true;
  }

  rollApiKey(id: string): ApiKeyRecord | null {
    const key = this.apiKeys.get(id);
    if (!key || !key.isActive) return null;

    const prefix = key.environment === 'live' ? 'live' : 'test';
    const newSecret = `sk_${prefix}_${crypto.randomBytes(18).toString('hex')}`;
    key.secretKey = newSecret;
    key.createdAt = new Date().toISOString();
    this.apiKeys.set(id, key);

    return {
      id: key.id,
      name: key.name,
      environment: key.environment,
      publishableKey: key.publishableKey,
      secretKeyMasked: `${newSecret.substring(0, 8)}••••••••••••${newSecret.slice(-4)}`,
      secretKeyFull: newSecret,
      scopes: key.scopes,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      isActive: key.isActive,
    };
  }

  getSettings(): MerchantPayoutSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<MerchantPayoutSettings>): MerchantPayoutSettings {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    logger.info('[DeveloperPortal] Updated merchant settlement settings');
    return { ...this.settings };
  }

  getWebhookDeliveries(): WebhookDeliveryLog[] {
    return [...this.webhookLogs].reverse();
  }

  async testWebhook(targetUrl?: string, eventType = 'payment.settled'): Promise<WebhookDeliveryLog> {
    const url = targetUrl || this.settings.webhookUrl;
    const now = new Date().toISOString();
    const deliveryId = `whd_${Date.now()}`;

    const payload = {
      id: `evt_${Date.now()}`,
      object: 'event',
      type: eventType,
      created: Math.floor(Date.now() / 1000),
      data: {
        paymentId: `pay_test_${Math.random().toString(36).substring(2, 8)}`,
        reference: `order_${Math.floor(100000 + Math.random() * 900000)}`,
        amount: eventType.includes('solana') ? 120.00 : 33600,
        currency: eventType.includes('solana') ? 'USDC' : 'PKR',
        rail: eventType.includes('solana') ? 'solana' : 'raast',
        status: 'SUCCEEDED',
        settlementSpeed: 'instant (<2s)',
        shariaCompliance: {
          status: 'COMPLIANT',
          governance: 'AAOIFI Standard No. 13 & No. 59',
          interestFree: true,
          contract: 'Mudarabah / Wakala',
        },
        merchantPayout: {
          raastIban: this.settings.raastId,
          solanaWallet: this.settings.solanaWallet,
          netSettlementAmount: eventType.includes('solana') ? 119.40 : 33600,
        },
      },
    };

    const signature = crypto
      .createHmac('sha256', this.settings.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const startTime = Date.now();
    let statusCode = 200;
    let success = true;
    let responseBody = '{"received":true,"status":"processed"}';

    // If external URL is configured and valid, attempt HTTP POST
    if (url && url.startsWith('http')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Pabandi-Webhook-Dispatcher/1.0',
            'X-Pabandi-Signature': `sha256=${signature}`,
            'X-Pabandi-Event': eventType,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = res.status;
        success = res.ok;
        responseBody = await res.text().catch(() => '');
      } catch (err: any) {
        // If external test fails or endpoint unreachable, capture response for debugging
        statusCode = 504;
        success = false;
        responseBody = `Webhook dispatch failed: ${err.message || 'Timeout / Connection refused'}`;
      }
    }

    const latencyMs = Math.max(12, Date.now() - startTime);

    const log: WebhookDeliveryLog = {
      id: deliveryId,
      event: eventType,
      targetUrl: url,
      statusCode,
      latencyMs,
      payload,
      signature: `sha256=${signature}`,
      timestamp: now,
      success,
      responseBody,
    };

    this.webhookLogs.push(log);
    // Keep max 50 logs in memory
    if (this.webhookLogs.length > 50) {
      this.webhookLogs.shift();
    }

    return log;
  }
}

export const developerPortalService = DeveloperPortalService.getInstance();
