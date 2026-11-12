import { Bot, InlineKeyboard, Keyboard, webhookCallback } from 'grammy';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { OfframpService } from './offramp.service';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
export const telegramBot = botToken ? new Bot(botToken) : null;

if (telegramBot) {
  // Command: /start [payload] — handles greetings, deep links, and phone verification
  telegramBot.command('start', async (ctx) => {
    const payload = ctx.match.trim();
    const telegramId = String(ctx.from?.id);
    const username = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || 'there');

    // Case 1: Phone verification deep link (/start phone_<userId> or /start verify_<userId>)
    if (payload.startsWith('phone_') || payload.startsWith('verify_')) {
      const userId = payload.replace(/^(phone_|verify_)/, '');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return ctx.reply('⚠️ Pabandi account not found. Please initiate phone verification from your Pabandi dashboard.');
      }

      // Link telegramId to user
      if (!user.telegramId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { telegramId },
        });
      }

      const phoneKeyboard = new Keyboard()
        .requestContact('📱 Share Verified Phone Number')
        .resized()
        .oneTime();

      return ctx.reply(
        `👋 *Hello ${username}!*\n\n` +
        `To complete your **Double Verification** and claim your **+50 Trust Score Boost**, please tap the button below to share your verified mobile number with Pabandi:`,
        {
          parse_mode: 'Markdown',
          reply_markup: phoneKeyboard,
        }
      );
    }

    // Default /start greeting
    const keyboard = new Keyboard()
      .requestContact('📱 Verify Phone (+50 Trust Boost)')
      .resized()
      .oneTime();

    return ctx.reply(
      `🤖 *Welcome to PabAgent (@PabanBot)!*\n\n` +
      `The trust and escrow coordinator for the agent economy.\n\n` +
      `• Tap *📱 Verify Phone* below to complete double verification\n` +
      `• Use /trust to check your trust passport\n` +
      `• Use /help for all commands`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  });

  // Handler for contact sharing (Phone Double Verification)
  telegramBot.on(':contact', async (ctx) => {
    const contact = ctx.message?.contact;
    if (!contact) return;

    const telegramUserId = ctx.from?.id;
    // Security check: verify contact belongs to the user who sent it
    if (contact.user_id && contact.user_id !== telegramUserId) {
      return ctx.reply('❌ Security Warning: The shared contact does not match your Telegram account.');
    }

    const rawPhone = contact.phone_number;
    const cleanPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

    try {
      // Find user by telegramId
      let user = await prisma.user.findFirst({
        where: { telegramId: String(telegramUserId) },
      });

      // If not linked by telegramId, search by phone
      if (!user) {
        user = await prisma.user.findFirst({
          where: { phone: cleanPhone },
        });
      }

      if (!user) {
        // Create user with verified phone
        const { findOrCreateUser } = await import('./identity.service');
        user = await findOrCreateUser({
          provider: 'telegram',
          providerId: String(telegramUserId),
          metadata: {
            first_name: contact.first_name,
            last_name: contact.last_name,
            username: ctx.from?.username,
            phone: cleanPhone,
          },
        });
      }

      const currentScore = user.trustScore && user.trustScore >= 700 ? user.trustScore : 700;
      const newScore = Math.min(850, currentScore + 50);

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: cleanPhone,
          isPhoneVerified: true,
          telegramId: String(telegramUserId),
          trustScore: newScore,
        },
      });

      logger.info(`[TelegramBot] Phone verified for user ${updatedUser.id}: ${cleanPhone} (+50 Boost)`);

      return ctx.reply(
        `✅ *Phone Verified Successfully!*\n\n` +
        `📱 *Verified Number:* \`${cleanPhone}\`\n` +
        `🛡️ *Trust Score:* ${updatedUser.trustScore} / 1000 (+50 Boost Applied)\n` +
        `🔒 *Double Verification:* Active\n\n` +
        `You can now return to Pabandi. Your profile and trust passport have been updated in real-time.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e: any) {
      logger.error('[TelegramBot] Phone verification error:', e);
      return ctx.reply(`❌ Verification failed: ${e.message || 'Please try again later'}`);
    }
  });

  // Command: /trust — Check Trust Passport standing
  telegramBot.command('trust', async (ctx) => {
    const telegramUserId = String(ctx.from?.id);
    const user = await prisma.user.findFirst({ where: { telegramId: telegramUserId } });

    if (!user) {
      return ctx.reply('⚠️ No linked Pabandi account found. Sign in at https://pabandi.com or send /start to link your account.');
    }

    const verifiedBadge = user.isPhoneVerified ? '✅ Verified (2FA)' : '⚠️ Unverified';
    return ctx.reply(
      `🛡️ *Pabandi Trust Passport*\n\n` +
      `👤 *User:* ${user.firstName} ${user.lastName}\n` +
      `⭐ *Trust Score:* ${user.trustScore || 700} / 1000\n` +
      `📱 *Phone Standing:* ${verifiedBadge}\n` +
      `💼 *Role:* ${user.profileType || user.role}\n` +
      `⚖️ *Dispute Rate:* ${user.disputeRate || 0}%\n\n` +
      `View full passport: https://pabandi.com/trust/passports`,
      { parse_mode: 'Markdown' }
    );
  });

  // Command: /help
  telegramBot.command('help', async (ctx) => {
    return ctx.reply(
      `🤖 *PabAgent Commands:*\n\n` +
      `/start — Welcome menu & phone verification\n` +
      `/trust — View your Trust Passport standing\n` +
      `/link <wallet> — Link a Liquidity Provider wallet\n` +
      `\nPabandi Trust OS: https://pabandi.com`,
      { parse_mode: 'Markdown' }
    );
  });
  // Command: /link <walletAddress>
  telegramBot.command('link', async (ctx) => {
    const walletAddress = ctx.match.trim();
    if (!walletAddress) {
      return ctx.reply('Please provide your wallet address. Usage: /link <wallet_address>');
    }

    try {
      const lp = await prisma.liquidityProvider.findUnique({
        where: { walletAddress },
      });

      if (!lp) {
        return ctx.reply('Liquidity Provider not found for this wallet address.');
      }

      const channelAddress = String(ctx.from?.id);

      // Upsert the telegram channel
      const existing = await prisma.lpChannel.findFirst({
        where: { lpId: lp.id, type: 'TELEGRAM' }
      });

      if (existing) {
        await prisma.lpChannel.update({
          where: { id: existing.id },
          data: { address: channelAddress, verified: true }
        });
      } else {
        await prisma.lpChannel.create({
          data: {
            lpId: lp.id,
            type: 'TELEGRAM',
            address: channelAddress,
            verified: true,
          }
        });
      }

      ctx.reply(`✅ Success! Your Telegram has been linked to LP account ${lp.displayName || lp.walletAddress}. You will now receive trade intents here.`);
    } catch (e) {
      logger.error('[TelegramBot] Link error:', e);
      ctx.reply('❌ An error occurred while linking your account.');
    }
  });

  // Callback Query Handler for inline buttons (ACCEPT, SKIP, PAUSE)
  telegramBot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const channelAddress = String(ctx.from?.id);

    const channel = await prisma.lpChannel.findFirst({
      where: { address: channelAddress, type: 'TELEGRAM', verified: true },
    });

    if (!channel) {
      return ctx.answerCallbackQuery({ text: 'Unauthorized. Please /link your account first.', show_alert: true });
    }

    const lp = await prisma.liquidityProvider.findUnique({ where: { id: channel.lpId } });
    if (!lp) return ctx.answerCallbackQuery('LP account not found');

    if (data.startsWith('ACCEPT_')) {
      const intentId = data.split('_')[1];
      try {
        const offrampService = new OfframpService();
        await offrampService.matchLp(intentId, lp.walletAddress);
        await ctx.editMessageText(`✅ You claimed intent ${intentId}!\n\nPlease complete the transfer within the SLA time limit.`);
      } catch (e: any) {
        if (e.message.includes('already matched')) {
          await ctx.answerCallbackQuery({ text: '🤝 Too slow, another LP claimed this.', show_alert: true });
          await ctx.editMessageText('~~' + (ctx.callbackQuery.message?.text || 'Intent') + '~~\n\n*CLAIMED BY ANOTHER LP*');
        } else {
          await ctx.answerCallbackQuery({ text: `❌ Error: ${e.message}`, show_alert: true });
        }
      }
    } else if (data === 'SKIP') {
      await ctx.editMessageText('⏭ Skipped intent.');
    } else if (data === 'PAUSE') {
      await prisma.lpChannel.update({
        where: { id: channel.id },
        data: { quietHours: 'PAUSED' }
      });
      await ctx.editMessageText('⏸ Your terminal is now paused. You will not receive new intents.');
    } else {
      await ctx.answerCallbackQuery();
    }
  });

  telegramBot.catch((err) => {
    logger.error(`[TelegramBot] Error:`, err);
  });
}

export const startTelegramBot = () => {
  if (telegramBot) {
    telegramBot.start();
    logger.info('[TelegramBot] Bot started');
  } else {
    logger.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set, skipping bot start');
  }
};

export const telegramWebhookHandler = telegramBot ? webhookCallback(telegramBot, 'express') : null;
