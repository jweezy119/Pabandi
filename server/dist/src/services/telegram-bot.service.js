"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTelegramBot = exports.telegramBot = void 0;
const grammy_1 = require("grammy");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const offramp_service_1 = require("./offramp.service");
const botToken = process.env.TELEGRAM_BOT_TOKEN;
exports.telegramBot = botToken ? new grammy_1.Bot(botToken) : null;
if (exports.telegramBot) {
    // Command: /link <walletAddress>
    exports.telegramBot.command('link', async (ctx) => {
        const walletAddress = ctx.match.trim();
        if (!walletAddress) {
            return ctx.reply('Please provide your wallet address. Usage: /link <wallet_address>');
        }
        try {
            const lp = await database_1.prisma.liquidityProvider.findUnique({
                where: { walletAddress },
            });
            if (!lp) {
                return ctx.reply('Liquidity Provider not found for this wallet address.');
            }
            const channelAddress = String(ctx.from?.id);
            // Upsert the telegram channel
            const existing = await database_1.prisma.lpChannel.findFirst({
                where: { lpId: lp.id, type: 'TELEGRAM' }
            });
            if (existing) {
                await database_1.prisma.lpChannel.update({
                    where: { id: existing.id },
                    data: { address: channelAddress, verified: true }
                });
            }
            else {
                await database_1.prisma.lpChannel.create({
                    data: {
                        lpId: lp.id,
                        type: 'TELEGRAM',
                        address: channelAddress,
                        verified: true,
                    }
                });
            }
            ctx.reply(`✅ Success! Your Telegram has been linked to LP account ${lp.displayName || lp.walletAddress}. You will now receive trade intents here.`);
        }
        catch (e) {
            logger_1.logger.error('[TelegramBot] Link error:', e);
            ctx.reply('❌ An error occurred while linking your account.');
        }
    });
    // Callback Query Handler for inline buttons (ACCEPT, SKIP, PAUSE)
    exports.telegramBot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        const channelAddress = String(ctx.from?.id);
        const channel = await database_1.prisma.lpChannel.findFirst({
            where: { address: channelAddress, type: 'TELEGRAM', verified: true },
        });
        if (!channel) {
            return ctx.answerCallbackQuery({ text: 'Unauthorized. Please /link your account first.', show_alert: true });
        }
        const lp = await database_1.prisma.liquidityProvider.findUnique({ where: { id: channel.lpId } });
        if (!lp)
            return ctx.answerCallbackQuery('LP account not found');
        if (data.startsWith('ACCEPT_')) {
            const intentId = data.split('_')[1];
            try {
                const offrampService = new offramp_service_1.OfframpService();
                await offrampService.matchLp(intentId, lp.walletAddress);
                await ctx.editMessageText(`✅ You claimed intent ${intentId}!\n\nPlease complete the transfer within the SLA time limit.`);
            }
            catch (e) {
                if (e.message.includes('already matched')) {
                    await ctx.answerCallbackQuery({ text: '🤝 Too slow, another LP claimed this.', show_alert: true });
                    await ctx.editMessageText('~~' + (ctx.callbackQuery.message?.text || 'Intent') + '~~\n\n*CLAIMED BY ANOTHER LP*');
                }
                else {
                    await ctx.answerCallbackQuery({ text: `❌ Error: ${e.message}`, show_alert: true });
                }
            }
        }
        else if (data === 'SKIP') {
            await ctx.editMessageText('⏭ Skipped intent.');
        }
        else if (data === 'PAUSE') {
            await database_1.prisma.lpChannel.update({
                where: { id: channel.id },
                data: { quietHours: 'PAUSED' }
            });
            await ctx.editMessageText('⏸ Your terminal is now paused. You will not receive new intents.');
        }
        else {
            await ctx.answerCallbackQuery();
        }
    });
    exports.telegramBot.catch((err) => {
        logger_1.logger.error(`[TelegramBot] Error:`, err);
    });
}
const startTelegramBot = () => {
    if (exports.telegramBot) {
        exports.telegramBot.start();
        logger_1.logger.info('[TelegramBot] Bot started');
    }
    else {
        logger_1.logger.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set, skipping bot start');
    }
};
exports.startTelegramBot = startTelegramBot;
//# sourceMappingURL=telegram-bot.service.js.map