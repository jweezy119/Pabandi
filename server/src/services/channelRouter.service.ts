import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { telegramService } from './telegram.service';
import { smsService } from './sms.service';

type Channel = 'WHATSAPP' | 'TELEGRAM' | 'SMS';

interface RouteResult {
  success: boolean;
  channel: Channel;
  messageId?: string;
  error?: string;
}

interface ChannelStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  cost: number;
}

export class ChannelRouterService {
  private channelPriority: Channel[] = ['WHATSAPP', 'TELEGRAM', 'SMS'];

  async getPreferredChannel(userId: string): Promise<Channel> {
    // Check user preference from DB
    const preference = await prisma.userChannelPreference.findUnique({
      where: { userId },
    });
    if (preference) return preference.channel as Channel;

    // Default: WhatsApp (most popular in Pakistan)
    return 'WHATSAPP';
  }

  async setPreferredChannel(userId: string, channel: Channel): Promise<void> {
    await prisma.userChannelPreference.upsert({
      where: { userId },
      update: { channel },
      create: { userId, channel },
    });
  }

  async routeMessage(
    businessId: string,
    customerId: string,
    message: string,
    channels?: Channel[],
    options?: { parse_mode?: string; buttons?: any[][] }
  ): Promise<RouteResult> {
    const preferredChannel = await this.getPreferredChannel(customerId);
    const channelsToTry = channels || [preferredChannel, ...this.channelPriority.filter(c => c !== preferredChannel)];

    for (const channel of channelsToTry) {
      const result = await this.sendViaChannel(channel, businessId, customerId, message, options);
      if (result.success) {
        return result;
      }
      logger.warn(`[ChannelRouter] ${channel} failed for ${customerId}, trying next...`);
    }

    return { success: false, channel: 'SMS', error: 'All channels failed' };
  }

  async fallback(
    businessId: string,
    customerId: string,
    message: string,
    fromChannel: Channel,
    toChannel: Channel,
    options?: { parse_mode?: string; buttons?: any[][] }
  ): Promise<RouteResult> {
    logger.info(`[ChannelRouter] Fallback from ${fromChannel} to ${toChannel} for ${customerId}`);
    return this.sendViaChannel(toChannel, businessId, customerId, message, options);
  }

  async trackDelivery(messageId: string, channel: Channel): Promise<{ status: string; deliveredAt?: Date }> {
    const message = await prisma.channelMessage.findFirst({
      where: { externalId: messageId },
    });
    if (!message) return { status: 'UNKNOWN' };

    return {
      status: message.status,
      deliveredAt: message.deliveredAt || undefined,
    };
  }

  async getUnifiedInbox(businessId: string, options?: {
    channel?: Channel;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const { channel, status, limit = 50, offset = 0 } = options || {};

    return prisma.channelMessage.findMany({
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

  async getChannelStats(businessId: string, startDate?: Date, endDate?: Date): Promise<Record<Channel, ChannelStats>> {
    const dateFilter = startDate && endDate ? {
      createdAt: { gte: startDate, lte: endDate },
    } : {};

    const channels: Channel[] = ['WHATSAPP', 'TELEGRAM', 'SMS'];
    const stats: Record<string, ChannelStats> = {};

    for (const channel of channels) {
      const total = await prisma.channelMessage.count({
        where: { businessId, channel, ...dateFilter },
      });
      const sent = await prisma.channelMessage.count({
        where: { businessId, channel, status: 'SENT', ...dateFilter },
      });
      const delivered = await prisma.channelMessage.count({
        where: { businessId, channel, status: 'DELIVERED', ...dateFilter },
      });
      const failed = await prisma.channelMessage.count({
        where: { businessId, channel, status: 'FAILED', ...dateFilter },
      });
      const pending = await prisma.channelMessage.count({
        where: { businessId, channel, status: 'PENDING', ...dateFilter },
      });

      // Cost calculation (PKR)
      let cost = 0;
      if (channel === 'SMS') {
        const smsLogs = await prisma.sMSLog.findMany({
          where: { businessId, ...dateFilter },
        });
        cost = smsLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
      } else if (channel === 'WHATSAPP') {
        // WhatsApp Business API: PKR 2.80-13.20 per message
        cost = sent * 8; // average
      } else {
        cost = 0; // Telegram is free
      }

      stats[channel] = { total, sent, delivered, failed, pending, cost };
    }

    return stats;
  }

  async getBestTimeToSend(businessId: string): Promise<{ hour: number; day: string; engagement: number }[]> {
    // Analyze message engagement by hour and day
    const messages = await prisma.channelMessage.findMany({
      where: { businessId, direction: 'INCOMING' },
      select: { createdAt: true },
    });

    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};

    for (const msg of messages) {
      const hour = msg.createdAt.getHours();
      const day = msg.createdAt.toLocaleDateString('en-US', { weekday: 'long' });
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    const results: { hour: number; day: string; engagement: number }[] = [];
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

  private async sendViaChannel(
    channel: Channel,
    businessId: string,
    customerId: string,
    message: string,
    options?: { parse_mode?: string; buttons?: any[][] }
  ): Promise<RouteResult> {
    switch (channel) {
      case 'TELEGRAM':
        if (options?.buttons) {
          const result = await telegramService.sendInlineKeyboard(businessId, customerId, message, options.buttons);
          return { success: result.success, channel, messageId: result.messageId, error: result.error };
        }
        const tgResult = await telegramService.sendMessage(businessId, customerId, message, {
          parse_mode: options?.parse_mode as any,
        });
        return { success: tgResult.success, channel, messageId: tgResult.messageId, error: tgResult.error };

      case 'SMS':
        const smsResult = await smsService.sendSMS(customerId, message, businessId);
        return { success: smsResult.success, channel, messageId: smsResult.messageId, error: smsResult.error };

      case 'WHATSAPP':
        // WhatsApp via Evolution API - log only, actual sending handled by existing service
        await prisma.channelMessage.create({
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

export const channelRouter = new ChannelRouterService();
