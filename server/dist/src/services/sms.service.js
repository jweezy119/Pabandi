"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsService = exports.SMSService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
class SMSService {
    // Initialize with env-based credentials
    constructor() {
        this.twilioClient = null;
        this.vonageClient = null;
        this.twilioFrom = null;
        this.vonageFrom = null;
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
        if (twilioSid && twilioToken) {
            this.twilioClient = (0, twilio_1.default)(twilioSid, twilioToken);
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
    async sendSMS(to, message, businessId) {
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
            }
            catch (error) {
                logger_1.logger.warn(`[SMSService] Twilio failed for ${formattedTo}, trying Vonage fallback`);
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
    async sendBulkSMS(numbers, message, businessId) {
        const results = [];
        let sent = 0;
        let failed = 0;
        // Rate limit: process sequentially to avoid provider throttling
        for (const number of numbers) {
            const result = await this.sendSMS(number, message, businessId);
            results.push(result);
            if (result.success) {
                sent++;
            }
            else {
                failed++;
            }
        }
        return { total: numbers.length, sent, failed, results };
    }
    async getStatus(messageId, provider = 'TWILIO') {
        if (provider === 'TWILIO' && this.twilioClient) {
            try {
                const msg = await this.twilioClient.messages(messageId).fetch();
                return {
                    status: msg.status.toUpperCase(),
                    deliveredAt: msg.dateSent || undefined,
                };
            }
            catch (error) {
                return { error: error.message };
            }
        }
        // Check local log as fallback
        const log = await database_1.prisma.sMSLog.findFirst({ where: { externalId: messageId } });
        if (log) {
            return { status: log.status, deliveredAt: log.deliveredAt || undefined };
        }
        return { error: 'Message not found' };
    }
    async handleTwilioWebhook(payload) {
        const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = payload;
        await database_1.prisma.sMSLog.updateMany({
            where: { externalId: MessageSid },
            data: {
                status: MessageStatus?.toUpperCase() || 'UNKNOWN',
                deliveredAt: MessageStatus === 'delivered' ? new Date() : undefined,
                error: ErrorCode ? `${ErrorCode}: ${ErrorMessage}` : undefined,
            },
        });
        // Also update ChannelMessage if applicable
        await database_1.prisma.channelMessage.updateMany({
            where: { externalId: MessageSid },
            data: {
                status: MessageStatus?.toUpperCase() || 'UNKNOWN',
                deliveredAt: MessageStatus === 'delivered' ? new Date() : undefined,
                failedAt: MessageStatus === 'failed' || MessageStatus === 'undelivered' ? new Date() : undefined,
                error: ErrorCode ? `${ErrorCode}: ${ErrorMessage}` : undefined,
            },
        });
        logger_1.logger.info(`[SMSService] Twilio webhook: ${MessageSid} -> ${MessageStatus}`);
    }
    async getSMSLogs(businessId, limit = 50, offset = 0) {
        return database_1.prisma.sMSLog.findMany({
            where: { businessId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
    }
    async sendViaVonage(to, message, businessId) {
        try {
            // Lazy-load vonage to avoid hard dependency
            const vonage = await this.loadVonageClient();
            if (!vonage) {
                return { success: false, provider: 'VONAGE', error: 'Vonage SDK not installed' };
            }
            const result = await vonage.sms.send({ to, from: this.vonageFrom, text: message });
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
            }
            else {
                return { success: false, provider: 'VONAGE', error: `Vonage error: ${msg.status}` };
            }
        }
        catch (error) {
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
    async loadVonageClient() {
        // Dynamic require to avoid hard dependency on Vonage SDK
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const VonageSdk = require('@vonage/server-sdk');
            if (!VonageSdk?.Vonage)
                return null;
            return new VonageSdk.Vonage({
                apiKey: process.env.VONAGE_API_KEY,
                apiSecret: process.env.VONAGE_API_SECRET,
            });
        }
        catch {
            return null;
        }
    }
    async logSMS(data) {
        try {
            await database_1.prisma.sMSLog.create({ data });
            // Also log as ChannelMessage
            await database_1.prisma.channelMessage.create({
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
        }
        catch (error) {
            logger_1.logger.error('[SMSService] Log error:', error.message);
        }
    }
    formatPhone(phone) {
        // Normalize to +92 format for Pakistan
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '+92' + cleaned.substring(1);
        }
        else if (cleaned.startsWith('92') && !cleaned.startsWith('+92')) {
            cleaned = '+' + cleaned;
        }
        else if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }
        return cleaned;
    }
    async estimateCost(messageSid, provider) {
        // Approximate cost in PKR
        if (provider === 'TWILIO') {
            // Twilio Pakistan: ~$0.05/SMS ≈ PKR 14
            return 14;
        }
        return 10; // Vonage estimate
    }
}
exports.SMSService = SMSService;
exports.smsService = new SMSService();
//# sourceMappingURL=sms.service.js.map