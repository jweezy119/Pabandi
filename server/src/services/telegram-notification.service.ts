import { InlineKeyboard } from 'grammy';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { telegramBot } from './telegram-bot.service';

export interface TelegramPushOptions {
  title: string;
  body: string;
  actionUrl?: string;
  actionText?: string;
}

export class TelegramNotificationService {
  private getBaseUrl(): string {
    return process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://pabandi.com';
  }

  /**
   * Resolve an absolute HTTPS webApp / direct URL for Telegram mini-app buttons.
   */
  private resolveActionUrl(pathOrUrl?: string): string {
    if (!pathOrUrl) return this.getBaseUrl();
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const base = this.getBaseUrl().replace(/\/$/, '');
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${base}${cleanPath}`;
  }

  /**
   * Build an inline keyboard with a Telegram Mini App button.
   */
  private buildInlineKeyboard(url: string, text: string = '🚀 Launch Mini App'): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    if (url.startsWith('https://')) {
      keyboard.webApp(text, url);
    } else {
      keyboard.url(text, url);
    }
    return keyboard;
  }

  /**
   * Send a direct push notification to a user via @PabanBot.
   * If the user hasn't linked a telegramId, this gracefully returns false.
   */
  async sendToUser(userId: string, options: TelegramPushOptions): Promise<boolean> {
    if (!telegramBot) {
      logger.debug('[TelegramPush] telegramBot not initialized; skipping push');
      return false;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true, firstName: true },
      });

      if (!user || !user.telegramId) {
        return false;
      }

      const fullUrl = this.resolveActionUrl(options.actionUrl);
      const keyboard = this.buildInlineKeyboard(fullUrl, options.actionText || '🚀 Open in Pabandi');

      const message = `${options.title}\n\n${options.body}`;

      await telegramBot.api.sendMessage(user.telegramId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      logger.info(`[TelegramPush] Delivered alert to user ${userId} (telegram: ${user.telegramId})`);
      return true;
    } catch (err: any) {
      logger.warn(`[TelegramPush] Failed to deliver alert to user ${userId}:`, err?.message || err);
      return false;
    }
  }

  /**
   * Send a push notification directly to a known Telegram Chat ID.
   */
  async sendToTelegramId(telegramId: string, options: TelegramPushOptions): Promise<boolean> {
    if (!telegramBot) return false;
    try {
      const fullUrl = this.resolveActionUrl(options.actionUrl);
      const keyboard = this.buildInlineKeyboard(fullUrl, options.actionText || '🚀 Open in Pabandi');
      const message = `${options.title}\n\n${options.body}`;

      await telegramBot.api.sendMessage(telegramId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return true;
    } catch (err: any) {
      logger.warn(`[TelegramPush] Failed to send to telegramId ${telegramId}:`, err?.message || err);
      return false;
    }
  }

  /**
   * Push notification: Escrow Funded for a Gig or Milestone.
   * Notifies the contractor/agent that milestone funds are safely locked in Universal Escrow.
   */
  async notifyEscrowFunded(params: {
    gigId: string;
    gigTitle: string;
    amountUsd: number;
    rail: string;
    payerId?: string;
    payeeId?: string;
    txHash?: string | null;
  }) {
    const { gigId, gigTitle, amountUsd, rail, payeeId, txHash } = params;

    const bodyLines = [
      `💼 *Project:* ${gigTitle}`,
      `💰 *Locked Escrow:* $${amountUsd.toFixed(2)} USDC`,
      `⚡ *Settlement Rail:* ${rail.toUpperCase()}`,
      txHash ? `🔗 *Transaction:* \`${txHash.slice(0, 10)}...${txHash.slice(-8)}\`` : null,
      '',
      `🛡️ Funds are held safely in Pabandi Universal Escrow. You may proceed with the deliverables with guaranteed payment upon completion.`,
    ].filter(Boolean) as string[];

    const payload: TelegramPushOptions = {
      title: '💰 *Universal Escrow Funded: Work Can Begin!*',
      body: bodyLines.join('\n'),
      actionUrl: `/gigs`,
      actionText: '🚀 View Project & Escrow',
    };

    if (payeeId) {
      await this.sendToUser(payeeId, payload);
    }
  }

  /**
   * Push notification: Escrow Released & Payout Settled.
   * Notifies contractor that payment has arrived and trust score has been boosted.
   */
  async notifyEscrowReleased(params: {
    gigId: string;
    gigTitle: string;
    amountUsd: number;
    payeeId?: string;
    payeeTrustScoreDelta?: number;
  }) {
    const { gigTitle, amountUsd, payeeId, payeeTrustScoreDelta = 25 } = params;

    const payload: TelegramPushOptions = {
      title: '🎉 *Payment Released & Trust Score Boosted!*',
      body: [
        `💼 *Project:* ${gigTitle}`,
        `💵 *Delivered Payout:* $${amountUsd.toFixed(2)} USDC`,
        `🛡️ *Trust Score Impact:* +${payeeTrustScoreDelta} points earned!`,
        '',
        `The client has verified delivery. Funds are settled and your on-chain Trust Passport has been upgraded.`,
      ].join('\n'),
      actionUrl: `/trust/passports`,
      actionText: '🛡️ View Trust Passport',
    };

    if (payeeId) {
      await this.sendToUser(payeeId, payload);
    }
  }

  /**
   * Push notification: New Gig Opportunity.
   * Broadcasts to active builders & agents with Telegram notifications enabled.
   */
  async notifyNewGig(params: {
    gigId: string;
    title: string;
    description: string;
    category: string;
    requiredSkills: string[];
    budgetUsd: number;
  }) {
    if (!telegramBot) return;

    try {
      // Find up to 50 active builders/agents with registered telegramId
      const targetUsers = await prisma.user.findMany({
        where: {
          telegramId: { not: null },
          profileType: { in: ['SOLO_BUILDER', 'SERVICE_BUSINESS'] },
        },
        select: { id: true, telegramId: true },
        take: 50,
      });

      if (targetUsers.length === 0) return;

      const skillsFormatted = params.requiredSkills?.length
        ? `🛠️ *Skills:* \`${params.requiredSkills.slice(0, 5).join(', ')}\`\n`
        : '';

      const summary = params.description.length > 180
        ? `${params.description.slice(0, 180)}...`
        : params.description;

      const payload: TelegramPushOptions = {
        title: '💼 *New Gig Opportunity Posted!*',
        body: [
          `*${params.title}*`,
          `💵 *Budget:* $${params.budgetUsd} USD | *Category:* ${params.category}`,
          skillsFormatted,
          `📝 ${summary}`,
          '',
          `Submit your autonomous bid now to secure escrow.`,
        ].filter(Boolean).join('\n'),
        actionUrl: `/gigs`,
        actionText: '⚡ Submit Bid in Mini App',
      };

      for (const u of targetUsers) {
        if (u.telegramId) {
          await this.sendToTelegramId(u.telegramId, payload);
        }
      }

      logger.info(`[TelegramPush] Broadcasted new gig alert for ${params.gigId} to ${targetUsers.length} users`);
    } catch (e: any) {
      logger.warn('[TelegramPush] Error broadcasting new gig notification:', e?.message || e);
    }
  }

  /**
   * Push notification: Bid Accepted.
   * Notifies the agent/contractor that their bid was accepted by the client.
   */
  async notifyBidAccepted(params: {
    gigId: string;
    gigTitle: string;
    agentId: string;
    quoteUsd: number;
    clientId?: string;
  }) {
    const { gigTitle, quoteUsd, agentId } = params;

    const payload: TelegramPushOptions = {
      title: '🤝 *Your Bid Was Accepted!*',
      body: [
        `💼 *Project:* ${gigTitle}`,
        `💰 *Agreed Quote:* $${quoteUsd} USD`,
        '',
        `The client accepted your proposal. The project escrow is currently being locked. Prepare your deliverables!`,
      ].join('\n'),
      actionUrl: `/gigs`,
      actionText: '🚀 View Gig Details',
    };

    await this.sendToUser(agentId, payload);
  }

  /**
   * Push notification: Sulha Dispute Evidence Submitted.
   * Alerts disputing counterparties or arbitrators that photographic/document evidence was uploaded.
   */
  async notifyDisputeEvidenceSubmitted(params: {
    workOrderId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    vcapHash: string;
    targetUserIds?: string[];
  }) {
    const { workOrderId, fileName, mimeType, sizeBytes, vcapHash, targetUserIds } = params;

    const payload: TelegramPushOptions = {
      title: '⚖️ *Sulha Dispute Evidence Uploaded*',
      body: [
        `📁 *Work Order:* \`#${workOrderId}\``,
        `📄 *File:* ${fileName} (${(sizeBytes / 1024).toFixed(1)} KB)`,
        `🏷️ *Type:* \`${mimeType}\``,
        `🔒 *VCAP Integrity Hash:*\n\`${vcapHash.slice(0, 16)}...\``,
        '',
        `New tamper-proof evidence has been added to the Sulha arbitration dossier for AI & human review.`,
      ].join('\n'),
      actionUrl: `/disputes`,
      actionText: '🔍 Review Dispute Dossier',
    };

    if (targetUserIds && targetUserIds.length > 0) {
      for (const uid of targetUserIds) {
        await this.sendToUser(uid, payload);
      }
    } else {
      // Find parties related to this work order/dispute if possible
      try {
        const dispute = await prisma.escrowDispute.findFirst({
          where: { escrowId: workOrderId },
        });
        if (dispute?.raisedByPassport) {
          await this.sendToUser(dispute.raisedByPassport, payload);
        }
      } catch (err) {
        // Non-blocking
      }
    }
  }

  /**
   * Broadcast a live LP off-ramp payout alert to the Operator on Telegram with [Mark as Sent].
   */
  async sendLivePayoutRequestToOperator(params: {
    claimId: string;
    pkrAmount: number;
    bankName: string;
    iban: string;
    freelancerName?: string;
    usdcAmount?: number;
  }): Promise<boolean> {
    const { claimId, pkrAmount, bankName, iban, freelancerName, usdcAmount } = params;
    const operatorChatId = process.env.TELEGRAM_OPERATOR_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;

    const message = [
      `🚨 *LIVE PAYOUT REQUEST*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `💵 *Send PKR:* \`Rs. ${pkrAmount.toLocaleString()}\``,
      `🏦 *Bank / Rail:* *${bankName}*`,
      `💳 *IBAN / Raast ID:* \`${iban}\``,
      freelancerName ? `👤 *Freelancer:* ${freelancerName}` : '',
      usdcAmount ? `💎 *Receive Escrow:* $${usdcAmount.toFixed(2)} USDC` : '',
      `🔖 *Claim ID:* \`${claimId}\``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Send funds via Raast / 1LINK from your bank app, then tap below to mark as sent.`,
    ].filter(Boolean).join('\n');

    logger.info(`[TelegramPush] Operator alert: ${message}`);

    if (!telegramBot) {
      logger.warn('[TelegramPush] telegramBot not initialized; logged operator payout request to console.');
      return false;
    }

    try {
      const inlineKeyboard = new InlineKeyboard()
        .text('✅ Mark as Sent', `lp_sent:${claimId}`)
        .url('📊 LP Desk', `${this.getBaseUrl()}/operator/lp`);

      if (operatorChatId) {
        await telegramBot.api.sendMessage(operatorChatId, message, {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard,
        });
        return true;
      } else {
        const operators = await prisma.user.findMany({
          where: { role: 'ADMIN', telegramId: { not: null } },
          select: { telegramId: true },
        });

        for (const op of operators) {
          if (op.telegramId) {
            await telegramBot.api.sendMessage(op.telegramId, message, {
              parse_mode: 'Markdown',
              reply_markup: inlineKeyboard,
            });
          }
        }
        return true;
      }
    } catch (err: any) {
      logger.warn(`[TelegramPush] Failed to send operator payout alert:`, err?.message || err);
      return false;
    }
  }
}

export const telegramNotificationService = new TelegramNotificationService();

