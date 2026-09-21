import twilio from 'twilio';
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

  async sendSMS(to: string, message: string, businessId?: string): Promise<SMSResult> {
    const formattedTo = this.formatPhone(to);

    // Try Twilio first
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

  private async sendViaVonage(to: string, message: string, businessId?: string): Promise<SMSResult> {
    try {
      // Lazy-load vonage to avoid hard dependency
      const vonageModule = await import('@vonage/server-sdk').catch(() => null);
      if (!vonageModule) {
        return { success: false, provider: 'VONAGE', error: 'Vonage SDK not installed' };
      }

      const vonage = new vonageModule.Vonage({
        apiKey: process.env.VONAGE_API_KEY!,
        apiSecret: process.env.VONAGE_API_SECRET!,
      });

      const result = await vonage.sms.send({ to, from: this.vonageFrom!, text: message });
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
