"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelRouter = exports.ChannelRouterService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const telegram_service_1 = require("./telegram.service");
const sms_service_1 = require("./sms.service");
class ChannelRouterService {
    constructor() {
        this.channelPriority = ['WHATSAPP', 'TELEGRAM', 'SMS'];
    }
    async getPreferredChannel(userId) {
        // Check user preference from DB
        const preference = await database_1.prisma.userChannelPreference.findUnique({
            where: { userId },
        });
        if (preference)
            return preference.channel;
        // Default: WhatsApp (most popular in Pakistan)
        return 'WHATSAPP';
    }
    async setPreferredChannel(userId, channel) {
        await database_1.prisma.userChannelPreference.upsert({
            where: { userId },
            update: { channel },
            create: { userId, channel },
        });
    }
    async routeMessage(businessId, customerId, message, channels, options) {
        const preferredChannel = await this.getPreferredChannel(customerId);
        const channelsToTry = channels || [preferredChannel, ...this.channelPriority.filter(c => c !== preferredChannel)];
        for (const channel of channelsToTry) {
            const result = await this.sendViaChannel(channel, businessId, customerId, message, options);
            if (result.success) {
                return result;
            }
            logger_1.logger.warn(`[ChannelRouter] ${channel} failed for ${customerId}, trying next...`);
        }
        return { success: false, channel: 'SMS', error: 'All channels failed' };
    }
    async fallback(businessId, customerId, message, fromChannel, toChannel, options) {
        logger_1.logger.info(`[ChannelRouter] Fallback from ${fromChannel} to ${toChannel} for ${customerId}`);
        return this.sendViaChannel(toChannel, businessId, customerId, message, options);
    }
    async trackDelivery(messageId, channel) {
        const message = await database_1.prisma.channelMessage.findFirst({
            where: { externalId: messageId },
        });
        if (!message)
            return { status: 'UNKNOWN' };
        return {
            status: message.status,
            deliveredAt: message.deliveredAt || undefined,
        };
    }
    async getUnifiedInbox(businessId, options) {
        const { channel, status, limit = 50, offset = 0 } = options || {};
        return database_1.prisma.channelMessage.findMany({
            where: {
                businessId,
                ...(channel ? { channel } : {}),
                ...(status ? { status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
    }
    async getChannelStats(businessId, startDate, endDate) {
        const dateFilter = startDate && endDate ? {
            createdAt: { gte: startDate, lte: endDate },
        } : {};
        const channels = ['WHATSAPP', 'TELEGRAM', 'SMS'];
        const stats = {};
        for (const channel of channels) {
            const total = await database_1.prisma.channelMessage.count({
                where: { businessId, channel, ...dateFilter },
            });
            const sent = await database_1.prisma.channelMessage.count({
                where: { businessId, channel, status: 'SENT', ...dateFilter },
            });
            const delivered = await database_1.prisma.channelMessage.count({
                where: { businessId, channel, status: 'DELIVERED', ...dateFilter },
            });
            const failed = await database_1.prisma.channelMessage.count({
                where: { businessId, channel, status: 'FAILED', ...dateFilter },
            });
            const pending = await database_1.prisma.channelMessage.count({
                where: { businessId, channel, status: 'PENDING', ...dateFilter },
            });
            // Cost calculation (PKR)
            let cost = 0;
            if (channel === 'SMS') {
                const smsLogs = await database_1.prisma.sMSLog.findMany({
                    where: { businessId, ...dateFilter },
                });
                cost = smsLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
            }
            else if (channel === 'WHATSAPP') {
                // WhatsApp Business API: PKR 2.80-13.20 per message
                cost = sent * 8; // average
            }
            else {
                cost = 0; // Telegram is free
            }
            stats[channel] = { total, sent, delivered, failed, pending, cost };
        }
        return stats;
    }
    async getBestTimeToSend(businessId) {
        // Analyze message engagement by hour and day
        const messages = await database_1.prisma.channelMessage.findMany({
            where: { businessId, direction: 'INCOMING' },
            select: { createdAt: true },
        });
        const hourCounts = {};
        const dayCounts = {};
        for (const msg of messages) {
            const hour = msg.createdAt.getHours();
            const day = msg.createdAt.toLocaleDateString('en-US', { weekday: 'long' });
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        }
        const results = [];
        for (let h = 0; h < 24; h++) {
            for (const day of Object.keys(dayCounts)) {
                results.push({
                    hour: h,
                    day,
                    engagement: hourCounts[h] || 0,
                });
            }
        }
        return results.sort((a, b) => b.engagement - a.engagement).slice(0, 5);
    }
    async sendViaChannel(channel, businessId, customerId, message, options) {
        switch (channel) {
            case 'TELEGRAM':
                if (options?.buttons) {
                    const result = await telegram_service_1.telegramService.sendInlineKeyboard(businessId, customerId, message, options.buttons);
                    return { success: result.success, channel, messageId: result.messageId, error: result.error };
                }
                const tgResult = await telegram_service_1.telegramService.sendMessage(businessId, customerId, message, {
                    parse_mode: options?.parse_mode,
                });
                return { success: tgResult.success, channel, messageId: tgResult.messageId, error: tgResult.error };
            case 'SMS':
                const smsResult = await sms_service_1.smsService.sendSMS(customerId, message, businessId);
                return { success: smsResult.success, channel, messageId: smsResult.messageId, error: smsResult.error };
            case 'WHATSAPP':
                // WhatsApp via Evolution API - log only, actual sending handled by existing service
                await database_1.prisma.channelMessage.create({
                    data: {
                        businessId,
                        customerId,
                        channel: 'WHATSAPP',
                        direction: 'OUTGOING',
                        content: message,
                        status: 'PENDING',
                    },
                });
                return { success: true, channel, messageId: 'whatsapp-pending' };
            default:
                return { success: false, channel, error: 'Unknown channel' };
        }
    }
}
exports.ChannelRouterService = ChannelRouterService;
exports.channelRouter = new ChannelRouterService();
//# sourceMappingURL=channelRouter.service.js.map