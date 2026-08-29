"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelDispatcher = exports.ChannelDispatcher = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const ai_service_1 = require("./ai.service");
const offramp_service_1 = require("./offramp.service");
const telegram_bot_service_1 = require("./telegram-bot.service");
const grammy_1 = require("grammy");
const axios_1 = __importDefault(require("axios"));
const openwa_webhook_handler_service_1 = require("./openwa.webhook-handler.service");
class ChannelDispatcher {
    async dispatchNewIntent(intent) {
        // 1. Find all verified channels for active LPs with enough available collateral
        const availableLps = await database_1.prisma.liquidityProvider.findMany({
            where: {
                isActive: true,
            }
        });
        // Filter LPs by available collateral
        const qualifiedLps = availableLps.filter(lp => (lp.collateralUsdc - lp.lockedCollateralUsdc) >= intent.amountUsdc);
        if (qualifiedLps.length === 0) {
            logger_1.logger.warn(`[Dispatcher] No qualified LPs found for intent ${intent.id} (amount: ${intent.amountUsdc})`);
            return;
        }
        const lpIds = qualifiedLps.map(lp => lp.id);
        const channels = await database_1.prisma.lpChannel.findMany({
            where: {
                lpId: { in: lpIds },
                verified: true,
                quietHours: { not: 'PAUSED' }
            },
            orderBy: { priority: 'desc' }
        });
        if (channels.length === 0) {
            logger_1.logger.warn(`[Dispatcher] No verified, active channels found for qualified LPs for intent ${intent.id}`);
            return;
        }
        // TODO: Respect quietHours (time based) and priority tiers (First look for Pro LPs)
        // For now, broadcast to all qualified channels immediately
        const message = `🚨 *New Trade Request* 🚨\n\n` +
            `Send: *${intent.quotePkr} PKR*\n` +
            `To: ${intent.destinationType} (${intent.destinationRef})\n` +
            `Reward: $${intent.amountUsdc} USDC`;
        for (const channel of channels) {
            if (channel.type === 'WHATSAPP') {
                try {
                    const messageId = await (0, ai_service_1.sendWhatsAppMessage)(channel.address, `${message}\n\nReply *ACCEPT ${intent.id}* to claim.`);
                    logger_1.logger.info(`[Dispatcher] Broadcasted intent ${intent.id} to LP via WHATSAPP`);
                    if (messageId) {
                        // Schedule read-receipt check (LP auto-re-broadcast)
                        setTimeout(() => {
                            const ack = (0, openwa_webhook_handler_service_1.getMessageAck)(messageId);
                            // If not read (ACK < 3) after 30s, ping again or move to next LP tier
                            if (!ack || ack.ack < 3) {
                                logger_1.logger.warn(`[Dispatcher] LP ${channel.address} has not read intent ${intent.id} after 30s. Triggering re-broadcast reminder.`);
                                (0, ai_service_1.sendWhatsAppMessage)(channel.address, `⚠️ Reminder: High-priority trade request ${intent.id} is still waiting for you!`);
                            }
                        }, 30000);
                    }
                }
                catch (e) {
                    logger_1.logger.error(`[Dispatcher] Failed to send WhatsApp to ${channel.address}:`, e);
                }
            }
            else if (channel.type === 'TELEGRAM' && telegram_bot_service_1.telegramBot) {
                try {
                    const keyboard = new grammy_1.InlineKeyboard()
                        .text('✅ Claim Trade', `ACCEPT_${intent.id}`)
                        .text('⏭ Skip', 'SKIP').row()
                        .text('⏸ Pause Alerts', 'PAUSE');
                    await telegram_bot_service_1.telegramBot.api.sendMessage(channel.address, message, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                    logger_1.logger.info(`[Dispatcher] Broadcasted intent ${intent.id} to LP via TELEGRAM`);
                }
                catch (e) {
                    logger_1.logger.error(`[Dispatcher] Failed to send Telegram to ${channel.address}:`, e);
                }
            }
            else if (channel.type === 'API' && channel.address.startsWith('http')) {
                try {
                    await axios_1.default.post(channel.address, {
                        event: 'intent.created',
                        intentId: intent.id,
                        quotePkr: intent.quotePkr,
                        destinationType: intent.destinationType,
                        destinationRef: intent.destinationRef,
                        amountUsdc: intent.amountUsdc,
                        claimCommand: `ACCEPT ${intent.id}`
                    }, { timeout: 3000 });
                    logger_1.logger.info(`[Dispatcher] Broadcasted intent ${intent.id} to LP via API Webhook`);
                }
                catch (e) {
                    logger_1.logger.error(`[Dispatcher] Failed to send API Webhook to ${channel.address}:`, e.message);
                }
            }
            // SMS will be wired here next
        }
    }
    init() {
        setTimeout(() => {
            offramp_service_1.offrampEvents.on('intent_updated', async (intent) => {
                try {
                    const user = await database_1.prisma.user.findUnique({
                        where: { walletAddress: intent.customerWallet }
                    });
                    if (!user || !user.phone)
                        return;
                    let message = '';
                    switch (intent.status) {
                        case 'MATCHED':
                            if (intent.lpWallet) {
                                const lp = await database_1.prisma.liquidityProvider.findUnique({ where: { walletAddress: intent.lpWallet } });
                                const lpName = lp?.displayName || 'A verified merchant';
                                const rating = lp?.trustScore ? (lp.trustScore / 10).toFixed(1) : '4.9';
                                message = `🤝 Your trade was claimed by ${lpName} (${rating}★)!\n\nThey are sending ${intent.quotePkr} PKR to your account now.`;
                            }
                            break;
                        case 'PROOF_SUBMITTED':
                            message = `⏳ The merchant submitted proof of payment. Our AI is verifying the receipt...`;
                            break;
                        case 'SETTLED':
                            message = `✅ Trade Settled! ${intent.quotePkr} PKR has been confirmed. Your USDC was released.`;
                            break;
                        case 'REFUNDED':
                            message = `↩️ The trade expired before it could be fulfilled. Your USDC has been refunded.`;
                            break;
                    }
                    if (message) {
                        await (0, ai_service_1.sendWhatsAppMessage)(user.phone, message);
                        logger_1.logger.info(`[Dispatcher] Sent status push to customer ${user.phone}: ${intent.status}`);
                    }
                }
                catch (e) {
                    logger_1.logger.error(`[Dispatcher] Failed to process status push for intent ${intent.id}:`, e);
                }
            });
        }, 0);
    }
}
exports.ChannelDispatcher = ChannelDispatcher;
exports.channelDispatcher = new ChannelDispatcher();
exports.channelDispatcher.init();
//# sourceMappingURL=channel-dispatcher.service.js.map