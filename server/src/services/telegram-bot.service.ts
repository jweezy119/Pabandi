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

    // Default /start greeting with Telegram Mini App Launch Button
    const webAppUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://pabandi.com';
    const inlineKeyboard = new InlineKeyboard()
      .webApp('🚀 Launch Pabandi App', webAppUrl)
      .row()
      .webApp('💼 Browse Gig Board', `${webAppUrl}/gigs`);

    const phoneKeyboard = new Keyboard()
      .requestContact('📱 Verify Phone (+50 Trust Boost)')
      .resized()
      .oneTime();

    await ctx.reply(
      `📱 *Double Verification Ready:* Tap below to share your verified phone number:`,
      { reply_markup: phoneKeyboard }
    );

    return ctx.reply(
      `🤖 *Welcome to PabAgent (@PabanBot)!*\n\n` +
      `The trust and escrow coordinator for the agent economy.\n\n` +
      `• Tap *🚀 Launch Pabandi App* to open the Mini App with zero-click sign-in\n` +
      `• Tap *📱 Verify Phone* to complete double verification (+50 Boost)\n` +
      `• Use /trust to check your trust passport\n` +
      `• Use /app to open the app anytime`,
      {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard,
      }
    );
  });

  // Command: /app — Launch Telegram Mini App
  telegramBot.command('app', async (ctx) => {
    const webAppUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://pabandi.com';
    const inlineKeyboard = new InlineKeyboard()
      .webApp('🚀 Launch Pabandi App', webAppUrl)
      .row()
      .webApp('💼 Browse Gig Board', `${webAppUrl}/gigs`);

    return ctx.reply(
      `🚀 *Pabandi Mini App*\n\n` +
      `Tap below to launch Pabandi full-screen inside Telegram with zero-click authentication:`,
      {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard,
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

  // Command: /notifications — Check and manage push alert status
  telegramBot.command('notifications', async (ctx) => {
    const telegramUserId = String(ctx.from?.id);
    const user = await prisma.user.findFirst({ where: { telegramId: telegramUserId } });

    const webAppUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://pabandi.com';
    const inlineKeyboard = new InlineKeyboard()
      .webApp('🚀 Launch Pabandi App', webAppUrl)
      .row()
      .webApp('💼 Browse Gig Board', `${webAppUrl}/gigs`);

    if (!user) {
      return ctx.reply(
        `🔔 *Real-Time Push Alerts: Not Linked*\n\n` +
        `Your Telegram account is not yet linked to a Pabandi profile.\n` +
        `To start receiving instant phone alerts for escrows, gigs, and dispute evidence:\n\n` +
        `1. Sign in to Pabandi (or tap *Launch Pabandi App* below)\n` +
        `2. Go to Onboarding or Profile and tap *Verify Telegram*\n` +
        `3. Claim your +50 Trust Score Boost!`,
        {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard,
        }
      );
    }

    const doubleVerified = user.isPhoneVerified ? '✅ Active (2FA)' : '⚠️ Pending contact share';

    return ctx.reply(
      `🔔 *Pabandi Real-Time Alerts: ACTIVE*\n\n` +
      `👤 *Account:* ${user.firstName} ${user.lastName}\n` +
      `🛡️ *Role:* ${user.profileType || user.role}\n` +
      `📱 *Double Verification:* ${doubleVerified}\n\n` +
      `*Live Alert Subscriptions:*\n` +
      `• 💰 *Escrow Funded:* Instant notification when client deposits funds\n` +
      `• 💵 *Escrow Released:* Payout settlement & Trust Score boosts (+25 pts)\n` +
      `• 💼 *Gig Opportunities:* Matching agent/builder opportunities\n` +
      `• 🤝 *Bid Status:* Instant notice when your bids are accepted\n` +
      `• ⚖️ *Sulha Disputes:* Immediate alerts on tamper-proof evidence submissions\n\n` +
      `All alerts deliver 1-tap interactive Mini App buttons directly to your device.`,
      {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard,
      }
    );
  });

  // Command: /help
  telegramBot.command('help', async (ctx) => {
    return ctx.reply(
      `🤖 *PabAgent Commands:*\n\n` +
      `/start — Welcome menu & phone verification\n` +
      `/app — Launch full-screen Telegram Mini App\n` +
      `/trust — View your Trust Passport standing\n` +
      `/notifications — Real-time push alert settings\n` +
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

  // Callback Query Handler for inline buttons (ACCEPT, SKIP, PAUSE, RELEASE, DISPUTE)
  telegramBot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const channelAddress = String(ctx.from?.id);

    // 1. Contractor Push Confirmation Actions: RELEASE and DISPUTE
    if (data.startsWith('RELEASE_')) {
      const intentId = data.replace('RELEASE_', '');
      try {
        const { offrampService } = await import('./offramp.service');
        await offrampService.acceptProof(intentId, 'CONTRACTOR_CONFIRMATION');
        await ctx.editMessageText(
          `✅ *Payment Confirmed & Funds Released!*\n\n` +
          `You confirmed receiving the payment in your bank. Escrowed USDC has been released to the provider.`,
          { parse_mode: 'Markdown' }
        );
        return ctx.answerCallbackQuery({ text: 'Escrow released successfully!' });
      } catch (e: any) {
        return ctx.answerCallbackQuery({ text: `❌ ${e.message}`, show_alert: true });
      }
    }

    if (data.startsWith('DISPUTE_')) {
      const intentId = data.replace('DISPUTE_', '');
      try {
        const { offrampService } = await import('./offramp.service');
        await offrampService.disputeIntent(intentId, 'Contractor reported payment not received');
        await ctx.editMessageText(
          `🚨 *Dispute Opened*\n\n` +
          `Escrow funds have been frozen. A Pabandi Coordinator will manually inspect the bank transfer receipt and reach out to you.`,
          { parse_mode: 'Markdown' }
        );
        return ctx.answerCallbackQuery({ text: 'Dispute recorded. Escrow frozen.', show_alert: true });
      } catch (e: any) {
        return ctx.answerCallbackQuery({ text: `❌ ${e.message}`, show_alert: true });
      }
    }

    // Operator Action: Mark as Sent (Live Production Loop)
    if (data.startsWith('SENT_') || data.startsWith('LP_SENT_')) {
      const intentId = data.replace(/^(SENT_|LP_SENT_)/, '');
      try {
        await prisma.offrampIntent.updateMany({
          where: { id: intentId },
          data: { status: 'SENT_BY_LP' },
        });
        await ctx.editMessageText(
          `✅ *Payment Marked as Sent by Operator!*\n\n` +
          `Claim: \`${intentId}\`\n\n` +
          `Please upload the bank receipt screenshot on the Operator Dashboard to verify RRN and release escrow.`,
          { parse_mode: 'Markdown' }
        );
        return ctx.answerCallbackQuery({ text: '✅ Marked as Sent! Please upload receipt on dashboard.' });
      } catch (e: any) {
        return ctx.answerCallbackQuery({ text: `❌ Error: ${e.message}`, show_alert: true });
      }
    }

    // 2. Liquidity Provider Actions: ACCEPT, SKIP, PAUSE
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
        const { offrampService } = await import('./offramp.service');
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

export const setupTelegramMenuButton = async (url?: string) => {
  if (!telegramBot) return { success: false, error: 'Telegram bot not initialized' };
  const webAppUrl = url || process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://pabandi.com';
  try {
    await telegramBot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🚀 Open Pabandi',
        web_app: { url: webAppUrl },
      },
    });
    logger.info(`[TelegramBot] Menu button configured with ${webAppUrl}`);
    return { success: true, url: webAppUrl };
  } catch (e: any) {
    logger.warn(`[TelegramBot] Failed to set menu button: ${e.message}`);
    return { success: false, error: e.message };
  }
};

/**
 * Triggers live payout telegram dispatch to Operator with [✅ Mark as Sent] button.
 * Format: 🚨 LIVE PAYOUT REQUEST: Send Rs. [Amount] to [Bank Name] / [IBAN]. Claim: [Contract ID]
 */
export async function sendLivePayoutRequestToOperator(params: {
  amountPkr: number;
  destination: string;
  claimId: string;
  amountUsdc: number;
  freelancerName?: string;
}): Promise<string> {
  const formattedPkr = params.amountPkr.toLocaleString();
  const text = `🚨 LIVE PAYOUT REQUEST: Send Rs. ${formattedPkr} to ${params.destination}. Claim: ${params.claimId}`;

  const inlineKeyboard = new InlineKeyboard()
    .text('✅ Mark as Sent', `SENT_${params.claimId}`)
    .row()
    .url('🔍 Open LP Dashboard', `${process.env.FRONTEND_URL || 'https://pabandi.com'}/operator/lp`);

  const targetChatId =
    process.env.OPERATOR_TELEGRAM_CHAT_ID ||
    process.env.COORDINATOR_TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_LP_CHAT_ID;

  if (telegramBot && targetChatId) {
    try {
      await telegramBot.api.sendMessage(targetChatId, text, {
        reply_markup: inlineKeyboard,
      });
      logger.info(`[PabanBot] Sent live payout request to operator (${targetChatId}): ${params.claimId}`);
    } catch (err: any) {
      logger.error('[PabanBot] Error sending live payout request:', err);
    }
  } else {
    console.log('\n====================================================================');
    console.log('[@PabanBot LIVE OPERATOR DISPATCH]');
    console.log(text);
    console.log(`[Inline Button]: [✅ Mark as Sent] -> SENT_${params.claimId}`);
    console.log('====================================================================\n');
  }

  return text;
}
