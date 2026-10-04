import twilio from 'twilio';
import { requireCredentials } from './sms-provider.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

interface SMSResult {
  success: boolean;
  messageId?: string;
  provider: 'TWILIO' | 'VONAGE';
  cost?: number;
  error?: string;
}

interface BulkSMSResult {
  total: number;
  sent: number;
  failed: number;
  results: SMSResult[];
}

export class SMSService {
  private twilioClient: twilio.Twilio | null = null;
  private vonageClient: any = null;
  private twilioFrom: string | null = null;
  private vonageFrom: string | null = null;

  // Initialize with env-based credentials
  constructor() {
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioToken) {
      this.twilioClient = twilio(twilioSid, twilioToken);
      this.twilioFrom = twilioFrom || null;
    }

    // Vonage/Nexmo - lazy init
    const vonageKey = process.env.VONAGE_API_KEY;
    const vonageSecret = process.env.VONAGE_API_SECRET;
    if (vonageKey && vonageSecret) {
      // We'll load vonage lazily to avoid hard dependency
      this.vonageFrom = process.env.VONAGE_FROM || 'Pabandi';
    }
  }

  /**
   * Send one SMS, preferring the BUSINESS'S OWN provider credentials.
   *
   * WHY THIS ORDER
   * -------------
   * A merchant who connected their own Twilio account is billed by Twilio, at their
   * rate, and Pabandi's cost of goods for that message is zero. Falling back to the
   * platform's shared credentials would quietly move that cost back onto our margin —
   * the exact thing bring-your-own exists to avoid — so it is only reached when the
   * business has NOT connected a provider.
   *
   * `smsProviderService.requireCredentials` THROWS when there is no verified connection,
   * rather than returning null, so an unconfigured business is distinguishable from a
   * misconfigured one and neither can silently become a platform-billed send.
   */
  async sendSMS(to: string, message: string, businessId?: string): Promise<SMSResult> {
    const formattedTo = this.formatPhone(to);

    if (businessId && businessId !== 'system') {
      try {
        const { provider, creds } = await requireCredentials(businessId);
        if (provider === 'TWILIO' && creds.accountSid && creds.authToken) {
          const client = twilio(creds.accountSid, creds.authToken);
          const result = await client.messages.create({
            body: message,
            from: creds.fromNumber,
            to: formattedTo,
            // The connection id is in the path so the callback can be verified against
            // THIS merchant's auth token, not a single platform-wide one.
            statusCallback: `${process.env.BASE_URL || ''}/api/v1/sms/webhook/twilio/${businessId}`,
          });
          await this.logSMS({
            businessId,
            to: formattedTo,
            message,
            provider: 'TWILIO',
            externalId: result.sid,
            status: 'SENT',
          });
          return { success: true, messageId: result.sid, provider: 'TWILIO' };
        }
        return this.sendViaVonage(formattedTo, message, businessId, {
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret,
          from: creds.fromNumber,
        });
      } catch (err: any) {
        // A business that HAS connected a provider must not silently fall through to the
        // platform's account: that is how their messages end up on our bill.
        if (err?.statusCode === 409) {
          return { success: false, provider: 'TWILIO', error: err.message };
        }
        logger.warn(`[SMSService] own-provider send failed for ${businessId}: ${err?.message}`);
        return { success: false, provider: 'TWILIO', error: err?.message || 'send failed' };
      }
    }

    // No business: platform credentials only. Used by system notifications, which have no
    // merchant to bill.
    if (this.twilioClient && this.twilioFrom) {
      try {
        const result = await this.twilioClient.messages.create({
          body: message,
          from: this.twilioFrom,
          to: formattedTo,
          statusCallback: `${process.env.BASE_URL || ''}/api/v1/sms/webhook/twilio`,
        });

        const cost = await this.estimateCost(result.sid, 'TWILIO');

        await this.logSMS({
          businessId: businessId || 'system',
          to: formattedTo,
          message,
          provider: 'TWILIO',
          externalId: result.sid,
          cost,
          status: 'SENT',
        });

        return { success: true, messageId: result.sid, provider: 'TWILIO', cost };
      } catch (error: any) {
        logger.warn(`[SMSService] Twilio failed for ${formattedTo}, trying Vonage fallback`);
        await this.logSMS({
          businessId: businessId || 'system',
          to: formattedTo,
          message,
          provider: 'TWILIO',
          status: 'FAILED',
          error: error.message,
        });
      }
    }

    // Fallback to Vonage
    if (this.vonageFrom) {
      return this.sendViaVonage(formattedTo, message, businessId);
    }

    return { success: false, provider: 'TWILIO', error: 'No SMS provider configured' };
  }

  async sendBulkSMS(numbers: string[], message: string, businessId?: string): Promise<BulkSMSResult> {
    const results: SMSResult[] = [];
    let sent = 0;
    let failed = 0;

    // Rate limit: process sequentially to avoid provider throttling
    for (const number of numbers) {
      const result = await this.sendSMS(number, message, businessId);
      results.push(result);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { total: numbers.length, sent, failed, results };
  }

  async getStatus(messageId: string, provider: 'TWILIO' | 'VONAGE' = 'TWILIO'): Promise<{ status?: string; deliveredAt?: Date; error?: string }> {
    if (provider === 'TWILIO' && this.twilioClient) {
      try {
        const msg = await this.twilioClient.messages(messageId).fetch();
        return {
          status: msg.status.toUpperCase(),
          deliveredAt: msg.dateSent || undefined,
        };
      } catch (error: any) {
        return { error: error.message };
      }
    }

    // Check local log as fallback
    const log = await prisma.sMSLog.findFirst({ where: { externalId: messageId } });
    if (log) {
      return { status: log.status, deliveredAt: log.deliveredAt || undefined };
    }

    return { error: 'Message not found' };
  }

  /**
   * Verify a Twilio request signature.
   *
   * The webhook is the only unauthenticated route in this file, so this is what stops
   * anyone forging delivery confirmations. Twilio signs the full callback URL plus the
   * POST fields with the account auth token; `validateRequest` recomputes and compares.
   *
   * The URL must be the one Twilio actually called, which is why the route rebuilds it
   * from protocol/host/originalUrl rather than trusting a forwarded host header.
   */
  verifyTwilioSignature(
    url: string,
    params: Record<string, string>,
    signature: string,
    authToken: string,
  ): boolean {
    try {
      return twilio.validateRequest(authToken, signature, url, params) === true;
    } catch (err) {
      logger.error('[SMS] Twilio signature validation threw:', err);
      return false;
    }
  }

  async handleTwilioWebhook(payload: any): Promise<void> {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = payload;

    await prisma.sMSLog.updateMany({
      where: { externalId: MessageSid },
      data: {
        status: MessageStatus?.toUpperCase() || 'UNKNOWN',
        deliveredAt: MessageStatus === 'delivered' ? new Date() : undefined,
        error: ErrorCode ? `${ErrorCode}: ${ErrorMessage}` : undefined,
      },
    });

    // Also update ChannelMessage if applicable
    await prisma.channelMessage.updateMany({
      where: { externalId: MessageSid },
      data: {
        status: MessageStatus?.toUpperCase() || 'UNKNOWN',
        deliveredAt: MessageStatus === 'delivered' ? new Date() : undefined,
        failedAt: MessageStatus === 'failed' || MessageStatus === 'undelivered' ? new Date() : undefined,
        error: ErrorCode ? `${ErrorCode}: ${ErrorMessage}` : undefined,
      },
    });

    logger.info(`[SMSService] Twilio webhook: ${MessageSid} -> ${MessageStatus}`);
  }

  async getSMSLogs(businessId: string, limit = 50, offset = 0) {
    return prisma.sMSLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Send via Vonage.
   *
   * `own` is supplied when the message is going through the merchant's own connected
   * account. Vonage's SDK signs with a key/secret pair baked into a client instance, so
   * the per-tenant credentials need their own client rather than the shared one — and
   * their own `from`, since a merchant's sender id is theirs.
   */
  private async sendViaVonage(
    to: string,
    message: string,
    businessId?: string,
    own?: { apiKey?: string; apiSecret?: string; from?: string },
  ): Promise<SMSResult> {
    try {
      const from = own?.from || this.vonageFrom;
      if (own?.apiKey && own?.apiSecret) {
        // Lazy import so Vonage stays an optional dependency.
        const vonageModule: any = await import('@vonage/server-sdk').catch(() => null);
        if (!vonageModule) {
          return { success: false, provider: 'VONAGE', error: 'Vonage SDK not installed' };
        }
        const Vonage = vonageModule.Vonage || vonageModule.default;
        const client = new Vonage({ apiKey: own.apiKey, apiSecret: own.apiSecret });
        const result = await client.sms.send({ to, from, text: message });
        const msg = result.messages[0];
        await this.logSMS({
          businessId: businessId || 'system',
          to,
          message,
          provider: 'VONAGE',
          externalId: msg['message-id'],
          cost: parseFloat(msg['message-price']) || 0,
          status: msg.status === '0' ? 'SENT' : 'FAILED',
          error: msg.status !== '0' ? `Error code: ${msg.status}` : undefined,
        });
        return msg.status === '0'
          ? { success: true, messageId: msg['message-id'], provider: 'VONAGE' }
          : { success: false, provider: 'VONAGE', error: `Vonage error: ${msg.status}` };
      }

      // Lazy-load vonage to avoid hard dependency
      const vonage = await this.loadVonageClient();
      if (!vonage) {
        return { success: false, provider: 'VONAGE', error: 'Vonage SDK not installed' };
      }

      const result = await vonage.sms.send({ to, from: from!, text: message });
      const msg = result.messages[0];
      const messageId = msg['message-id'];

      await this.logSMS({
        businessId: businessId || 'system',
        to,
        message,
        provider: 'VONAGE',
        externalId: messageId,
        cost: parseFloat(msg['message-price']) || 0,
        status: msg.status === '0' ? 'SENT' : 'FAILED',
        error: msg.status !== '0' ? `Error code: ${msg.status}` : undefined,
      });

      if (msg.status === '0') {
        return { success: true, messageId, provider: 'VONAGE', cost: parseFloat(msg['message-price']) || 0 };
      } else {
        return { success: false, provider: 'VONAGE', error: `Vonage error: ${msg.status}` };
      }
    } catch (error: any) {
      await this.logSMS({
        businessId: businessId || 'system',
        to,
        message,
        provider: 'VONAGE',
        status: 'FAILED',
        error: error.message,
      });
      return { success: false, provider: 'VONAGE', error: error.message };
    }
  }

  private async loadVonageClient(): Promise<any | null> {
    // Dynamic require to avoid hard dependency on Vonage SDK
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const VonageSdk = require('@vonage/server-sdk');
      if (!VonageSdk?.Vonage) return null;
      return new VonageSdk.Vonage({
        apiKey: process.env.VONAGE_API_KEY!,
        apiSecret: process.env.VONAGE_API_SECRET!,
      });
    } catch {
      return null;
    }
  }

  private async logSMS(data: {
    businessId: string;
    to: string;
    message: string;
    provider: 'TWILIO' | 'VONAGE';
    externalId?: string;
    cost?: number;
    status: string;
    error?: string;
  }): Promise<void> {
    try {
      await prisma.sMSLog.create({ data });
      // Also log as ChannelMessage
      await prisma.channelMessage.create({
        data: {
          businessId: data.businessId,
          customerId: data.to,
          channel: 'SMS',
          direction: 'OUTGOING',
          content: data.message,
          status: data.status,
          externalId: data.externalId,
          sentAt: data.status === 'SENT' ? new Date() : undefined,
          failedAt: data.status === 'FAILED' ? new Date() : undefined,
          error: data.error,
        },
      });
    } catch (error: any) {
      logger.error('[SMSService] Log error:', error.message);
    }
  }

  private formatPhone(phone: string): string {
    // Normalize to +92 format for Pakistan
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '+92' + cleaned.substring(1);
    } else if (cleaned.startsWith('92') && !cleaned.startsWith('+92')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  private async estimateCost(messageSid: string, provider: 'TWILIO' | 'VONAGE'): Promise<number> {
    // Approximate cost in PKR
    if (provider === 'TWILIO') {
      // Twilio Pakistan: ~$0.05/SMS ≈ PKR 14
      return 14;
    }
    return 10; // Vonage estimate
  }
}

export const smsService = new SMSService();
