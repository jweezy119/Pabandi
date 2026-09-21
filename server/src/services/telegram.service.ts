import { Bot, Context, InlineKeyboard, InputFile } from 'grammy';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

type BotCommand = { command: string; description: string };

interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_markup?: any;
}

interface ChannelMessageLog {
  businessId: string;
  customerId: string;
  channel: 'TELEGRAM';
  direction: 'INCOMING' | 'OUTGOING';
  content: string;
  externalId?: string;
}

export class TelegramService {
  private bots: Map<string, Bot> = new Map();
  private businessIdByToken: Map<string, string> = new Map();

  async initialize(botToken: string, businessId: string): Promise<{ success: boolean; username?: string; error?: string }> {
    try {
      // Stop existing bot for this business if any
      const existingBot = this.bots.get(businessId);
      if (existingBot) {
        await existingBot.stop();
        this.bots.delete(businessId);
      }

      const bot = new Bot(botToken);

      // Set up command handlers
      bot.command('start', (ctx) => this.handleCommand(ctx, businessId, '/start', []));
      bot.command('menu', (ctx) => this.handleCommand(ctx, businessId, '/menu', []));
      bot.command('book', (ctx) => this.handleCommand(ctx, businessId, '/book', []));
      bot.command('pay', (ctx) => this.handleCommand(ctx, businessId, '/pay', []));
      bot.command('status', (ctx) => this.handleCommand(ctx, businessId, '/status', []));
      bot.command('help', (ctx) => this.handleCommand(ctx, businessId, '/help', []));

      // Handle text messages
      bot.on('message:text', async (ctx) => {
        await this.logMessage({
          businessId,
          customerId: String(ctx.from?.id),
          channel: 'TELEGRAM',
          direction: 'INCOMING',
          content: ctx.message.text,
          externalId: String(ctx.message.message_id),
        });

        // If not a command, treat as chat flow
        if (!ctx.message.text.startsWith('/')) {
          await this.handleIncomingMessage(ctx, businessId, ctx.message.text);
        }
      });

      // Handle callback queries (inline keyboard buttons)
      bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        await ctx.answerCallbackQuery();
        await this.handleCallbackQuery(ctx, businessId, data);
      });

      bot.catch((err) => {
        logger.error(`[TelegramService] Bot error for business ${businessId}:`, err);
      });

      // Start bot with long-polling
      bot.start({
        onStart: (botInfo) => {
          logger.info(`[TelegramService] Bot @${botInfo.username} started for business ${businessId}`);
        },
      });

      this.bots.set(businessId, bot);
      this.businessIdByToken.set(botToken, businessId);

      // Set commands menu
      await this.setCommands(businessId, [
        { command: 'start', description: '🏠 Welcome & start' },
        { command: 'menu', description: '📋 View our menu' },
        { command: 'book', description: '📅 Book a table' },
        { command: 'pay', description: '💳 Make a payment' },
        { command: 'status', description: '📊 Check your status' },
        { command: 'help', description: '❓ Get help' },
      ]);

      return { success: true, username: bot.botInfo?.username };
    } catch (error: any) {
      logger.error('[TelegramService] Initialize error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMessage(businessId: string, chatId: string, message: string, options?: SendMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const bot = this.bots.get(businessId);
      if (!bot) {
        return { success: false, error: 'Bot not initialized for this business' };
      }

      const sent = await bot.api.sendMessage(chatId, message, {
        parse_mode: options?.parse_mode,
        disable_web_page_preview: options?.disable_web_page_preview,
        disable_notification: options?.disable_notification,
        reply_markup: options?.reply_markup,
      } as any);

      await this.logMessage({
        businessId,
        customerId: chatId,
        channel: 'TELEGRAM',
        direction: 'OUTGOING',
        content: message,
        externalId: String(sent.message_id),
      });

      return { success: true, messageId: String(sent.message_id) };
    } catch (error: any) {
      logger.error('[TelegramService] Send message error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendInlineKeyboard(businessId: string, chatId: string, message: string, buttons: { text: string; callback_data: string }[][]): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const bot = this.bots.get(businessId);
      if (!bot) {
        return { success: false, error: 'Bot not initialized for this business' };
      }

      const keyboard = new InlineKeyboard(
        buttons.map(row => row.map(btn => InlineKeyboard.text(btn.text, btn.callback_data)))
      );

      const sent = await bot.api.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      await this.logMessage({
        businessId,
        customerId: chatId,
        channel: 'TELEGRAM',
        direction: 'OUTGOING',
        content: message,
        externalId: String(sent.message_id),
      });

      return { success: true, messageId: String(sent.message_id) };
    } catch (error: any) {
      logger.error('[TelegramService] Send inline keyboard error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPhoto(businessId: string, chatId: string, photo: string | Buffer, caption?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const bot = this.bots.get(businessId);
      if (!bot) {
        return { success: false, error: 'Bot not initialized for this business' };
      }

      let photoInput: string | InputFile;
      if (Buffer.isBuffer(photo)) {
        photoInput = new InputFile(photo);
      } else {
        photoInput = photo;
      }

      const sent = await bot.api.sendPhoto(chatId, photoInput, {
        caption,
        parse_mode: caption ? 'HTML' : undefined,
      });

      await this.logMessage({
        businessId,
        customerId: chatId,
        channel: 'TELEGRAM',
        direction: 'OUTGOING',
        content: caption || '[Photo]',
        externalId: String(sent.message_id),
      });

      return { success: true, messageId: String(sent.message_id) };
    } catch (error: any) {
      logger.error('[TelegramService] Send photo error:', error);
      return { success: false, error: error.message };
    }
  }

  async setCommands(businessId: string, commands: BotCommand[]): Promise<boolean> {
    try {
      const bot = this.bots.get(businessId);
      if (!bot) return false;

      await bot.api.setMyCommands(commands);
      return true;
    } catch (error: any) {
      logger.error('[TelegramService] Set commands error:', error);
      return false;
    }
  }

  async processCommand(businessId: string, chatId: string, command: string, args: string[]): Promise<void> {
    const bot = this.bots.get(businessId);
    if (!bot) return;

    const mockCtx = {
      from: { id: parseInt(chatId, 10) || 0 },
      message: { message_id: Date.now(), text: `/${command} ${args.join(' ')}` },
      reply: async (text: string, opts?: any) => {
        await bot.api.sendMessage(chatId, text, opts || {});
        return { message_id: Date.now() };
      },
    } as unknown as Context;

    await this.handleCommand(mockCtx, businessId, command.startsWith('/') ? command : `/${command}`, args);
  }

  async handleUpdate(businessId: string, update: any): Promise<void> {
    const bot = this.bots.get(businessId);
    if (!bot) return;

    try {
      await bot.handleUpdate(update);
    } catch (error: any) {
      logger.error('[TelegramService] Handle update error:', error);
    }
  }

  async stopBot(businessId: string): Promise<void> {
    const bot = this.bots.get(businessId);
    if (bot) {
      await bot.stop();
      this.bots.delete(businessId);
      // Remove token mapping
      for (const [token, bid] of this.businessIdByToken.entries()) {
        if (bid === businessId) {
          this.businessIdByToken.delete(token);
        }
      }
      logger.info(`[TelegramService] Bot stopped for business ${businessId}`);
    }
  }

  async getBotInfo(businessId: string): Promise<{ isActive: boolean; username?: string }> {
    const bot = this.bots.get(businessId);
    if (!bot) return { isActive: false };
    return { isActive: true, username: bot.botInfo?.username };
  }

  isBotActive(businessId: string): boolean {
    return this.bots.has(businessId);
  }

  private async handleCommand(ctx: Context, businessId: string, command: string, args: string[]): Promise<void> {
    const chatId = String(ctx.from?.id);

    // Log incoming command
    await this.logMessage({
      businessId,
      customerId: chatId,
      channel: 'TELEGRAM',
      direction: 'INCOMING',
      content: `${command} ${args.join(' ')}`,
    });

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const businessName = business?.name || 'Pabandi';

    switch (command.toLowerCase()) {
      case '/start':
        await ctx.reply(
          `<b>Welcome to ${businessName}! 🎉</b>\n\n` +
          `آپ کا خوش آمدید! ہم آپ کی مدد کیسے کر سکتے ہیں؟\n\n` +
          `Use the buttons below or type a command:`,
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard()
            .text('📋 Menu', 'cmd_menu').text('📅 Book', 'cmd_book').row()
            .text('💳 Pay', 'cmd_pay').text('📊 Status', 'cmd_status').row()
            .text('❓ Help', 'cmd_help')
          }
        );
        break;

      case '/menu':
        await this.showMenu(ctx, businessId, businessName);
        break;

      case '/book':
        await ctx.reply(
          `<b>📅 Book a Table</b>\n\n` +
          `Please select your booking option:`,
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard()
            .text('🕐 Today', 'book_today').text('📆 Tomorrow', 'book_tomorrow').row()
            .text('👥 Large Group (6+)', 'book_group').row()
            .text('📞 Call Us', 'book_call')
          }
        );
        break;

      case '/pay':
        await ctx.reply(
          `<b>💳 Payment Options</b>\n\n` +
          `ادا کرنے کا طریقہ منتخب کریں:\n\n` +
          `• JazzCash\n• EasyPaisa\n• Card\n• Cash`,
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard()
            .text('📱 JazzCash', 'pay_jazzcash').text('📱 EasyPaisa', 'pay_easypaisa').row()
            .text('💳 Card', 'pay_card').text('💵 Cash', 'pay_cash')
          }
        );
        break;

      case '/status':
        await ctx.reply(
          `<b>📊 Your Status</b>\n\n` +
          `Checking your booking and payment status...`,
          { parse_mode: 'HTML' }
        );
        // Fetch latest reservation/payment status
        const reservations = await prisma.reservation.findMany({
          where: { customerId: chatId },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
        if (reservations.length > 0) {
          const r = reservations[0];
          await ctx.reply(
            `Last booking: <b>${r.status}</b>\n` +
            `Date: ${r.reservationDate.toISOString().split('T')[0]}\n` +
            `Guests: ${r.numberOfGuests}`,
            { parse_mode: 'HTML' }
          );
        }
        break;

      case '/help':
        await ctx.reply(
          `<b>❓ Help & Commands</b>\n\n` +
          `/start - Welcome\n` +
          `/menu - View our menu\n` +
          `/book - Book a table\n` +
          `/pay - Make payment\n` +
          `/status - Check status\n` +
          `/help - This help\n\n` +
          `📞 Need help? Contact support.`,
          { parse_mode: 'HTML' }
        );
        break;

      default:
        await ctx.reply('I did not understand that command. Type /help for available commands.');
    }
  }

  private async showMenu(ctx: Context, businessId: string, businessName: string): Promise<void> {
    const services = await prisma.businessService.findMany({
      where: { businessId, isActive: true },
      orderBy: { price: 'asc' },
    });

    if (services.length > 0) {
      let menuText = `<b>📋 ${businessName} Menu</b>\n\n`;
      services.forEach((s, i) => {
        menuText += `${i + 1}. <b>${s.name}</b>\n`;
        if (s.description) menuText += `   ${s.description}\n`;
        menuText += `   💰 PKR ${s.price} | ⏱ ${s.duration} min\n\n`;
      });
      await ctx.reply(menuText, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(
        `<b>📋 Menu</b>\n\n` +
        `Menu items coming soon! Please call for details.\n\n` +
        `مینو جلد آرہا ہے! تفصیلات کے لیے کال کریں۔`,
        { parse_mode: 'HTML' }
      );
    }
  }

  private async handleIncomingMessage(ctx: Context, businessId: string, text: string): Promise<void> {
    // Echo/respond to free text
    await ctx.reply(
      `Thank you for your message: "${text}"\n\n` +
      `Type /help for available commands or use the menu below.`,
      { reply_markup: new InlineKeyboard()
        .text('📋 Menu', 'cmd_menu').text('📅 Book', 'cmd_book').row()
        .text('❓ Help', 'cmd_help')
      }
    );
  }

  private async handleCallbackQuery(ctx: any, businessId: string, data: string): Promise<void> {
    const chatId = String(ctx.from?.id);

    if (data === 'cmd_menu') {
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      await this.showMenu(ctx, businessId, business?.name || 'Pabandi');
    } else if (data === 'cmd_book') {
      await ctx.reply('📅 To book a table, please share:\n1. Date & time\n2. Number of guests\n3. Contact number (+92...)');
    } else if (data === 'cmd_pay') {
      await ctx.reply('💳 Payment: You can pay via JazzCash, EasyPaisa, or card. Please share your amount.');
    } else if (data === 'cmd_status') {
      await ctx.reply('📊 Please share your booking reference or phone number to check status.');
    } else if (data === 'cmd_help') {
      await ctx.reply('/start - Welcome\n/menu - View menu\n/book - Book table\n/pay - Make payment\n/status - Check status\n/help - Help');
    } else if (data.startsWith('book_')) {
      await ctx.reply(`✅ Booking request received! Our team will confirm shortly.\n\nبکنگ کی درخواست مل گئی! ہم جلد تصدیق کریں گے۔`);
    } else if (data.startsWith('pay_')) {
      await ctx.reply(`💳 Payment method selected. Please share the amount to proceed.\n\nادائیگی کا طریقہ منتخب ہو گیا۔ رقم بھیجیں۔`);
    }
  }

  private async logMessage(data: ChannelMessageLog): Promise<void> {
    try {
      await prisma.channelMessage.create({ data });
    } catch (error: any) {
      logger.error('[TelegramService] Log message error:', error.message);
    }
  }
}

export const telegramService = new TelegramService();
