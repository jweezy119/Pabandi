import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { openwaService } from './whatsapp.service';
import { openwaAfterHoursService } from './openwa.after-hours.service';
import { openwaFaqBotService } from './openwa.faq-bot.service';
import { openwaDropBotService } from './openwa.drop-bot.service';
import { cryptoService } from './cryptoService';
import { aiNlpService } from './ai.nlp.service';

export const sendWhatsAppMessage = async (toPhone: string, message: string, options?: { sessionId?: string }) => {
  if (!process.env.OPENWA_API_KEY && !process.env.EVOLUTION_API_KEY) {
    logger.debug(`[WhatsApp MOCK] To: ${toPhone}`);
    return;
  }

  try {
    const formattedPhone = toPhone.replace('+', '').replace(/\D/g, '') + '@c.us';

    if (openwaService.sendPresence) {
      await openwaService.sendPresence(formattedPhone, 'composing', options).catch(() => {});
      const delayMs = Math.min(3000, Math.max(800, message.length * 20));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const result = await openwaService.sendText(formattedPhone, message, options);
    logger.info(`[WhatsApp] Sent message via Provider to ${toPhone} (ID: ${result.messageId})`);
    return result.messageId;
  } catch (error: any) {
    logger.error(`[WhatsApp] Error sending message to ${toPhone}:`, error.response?.data || error.message);
    return null;
  }
};

export const findBusinessByPublicPhone = async (phoneNumber: string) => {
  const clean = String(phoneNumber).replace(/[^\d]/g, '');
  if (!clean) return null;

  return prisma.business.findFirst({
    where: { phone: { contains: clean } },
    include: { settings: true },
  });
};

export const processWhatsAppMessage = async (
  customerPhone: string,
  businessPhone: string,
  message: string,
  user: any | null
) => {
  logger.info(`[AI] Processing message from ${customerPhone} to ${businessPhone}`);

  const lowerMsg = message.trim().toLowerCase();

  if (openwaDropBotService.isDropEngineCommand(message)) {
    try {
      const business = await findBusinessByPublicPhone(businessPhone);
      if (business) {
        const reply = await openwaDropBotService.handleDropEngineCommand(business.id, customerPhone, message);
        await sendWhatsAppMessage(customerPhone, reply);
        return;
      }
    } catch (e) {
      logger.error('[Drop Bot Error]', e);
    }
  }

  if (user && lowerMsg === 'cancel') {
    await handleWhatsAppCancellation(customerPhone, user);
    return;
  }

  try {
    const business = await findBusinessByPublicPhone(businessPhone);
    let businessSlug = 'unknown';
    let businessName = 'Pabandi Merchant';

    if (business) {
      businessSlug = business.slug || business.id;
      businessName = business.name;

      const rawSettings = (business as any)?.settings;
      const settings =
        rawSettings && typeof rawSettings === 'object'
          ? { afterHoursJson: rawSettings.afterHoursJson || null }
          : { afterHoursJson: null };

      const afterHours = openwaAfterHoursService.isAfterHoursNow({
        id: business.id,
        timezone: business.timezone,
        settings,
      });
      if (afterHours) {
        const away = openwaAfterHoursService.getAwayMessage(business);
        await sendWhatsAppMessage(customerPhone, away);
        return;
      }

      const faqReply = openwaFaqBotService.evaluateMessage(
        message,
        Array.isArray(rawSettings?.faqRules) ? rawSettings.faqRules : undefined
      );
      if (faqReply) {
        await sendWhatsAppMessage(customerPhone, faqReply);
        return;
      }
    }

    const classification = await aiNlpService.classifyIntentAndLanguage(message);
    logger.debug('[AI NLP] Classification result', classification);

    if (classification.intent === 'book_table' || classification.intent === 'booking' || classification.intent === 'sales') {
      const template = "Great! Let's lock in your reservation. Please securely deposit $5 into the Web3 Escrow to confirm: https://pabandi.com/s/{{businessSlug}}?mode=instant";
      const response = await aiNlpService.generateCopy(template, { businessSlug });
      await sendWhatsAppMessage(customerPhone, response);
      return;
    } else if (classification.intent === 'cancellation') {
      if (user) {
        await handleWhatsAppCancellation(customerPhone, user);
      } else {
        await sendWhatsAppMessage(customerPhone, 'To cancel, share your booking ID or phone number used while booking.');
      }
      return;
    } else if (classification.intent === 'check_menu') {
      const template = "Here is our digital menu: https://pabandi.com/menu/{{businessSlug}}. Let me know if you want to place an order!";
      const response = await aiNlpService.generateCopy(template, { businessSlug });
      await sendWhatsAppMessage(customerPhone, response);
      return;
    } else if (classification.intent === 'ask_question' || classification.intent === 'support') {
      const template = "I'm the AI assistant for {{businessName}}. I can help with deposits, refunds, menus, timings, or human handoff. What do you need?";
      const response = await aiNlpService.generateCopy(template, { businessName });
      await sendWhatsAppMessage(customerPhone, response);
      return;
    } else {
      const template = "I'm the AI assistant for {{businessName}}. I can help you book a table, check our catalog, or answer general questions. How can I help you today?";
      const response = await aiNlpService.generateCopy(template, { businessName });
      await sendWhatsAppMessage(customerPhone, response);
      return;
    }

    const fallback = `I'm the AI assistant for *{{businessName}}*.\n\nYou can:\n- *Book* a table\n- *Cancel* or *Reschedule*\n- *Check Status*\n- Ask a question\n\nPlease share details like date, time, and guests!`;
    const fallbackResponse = await aiNlpService.generateCopy(fallback, { businessName, businessSlug });
    await sendWhatsAppMessage(customerPhone, fallbackResponse);
  } catch (pluginErr) {
    logger.error('[Plugin] Pre-AI plugin handling failed:', pluginErr);
  }
};

async function handleWhatsAppCancellation(phoneNumber: string, user: any) {
  try {
    const reservation = await prisma.reservation.findFirst({
      where: {
        customerId: user.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { business: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!reservation) {
      await sendWhatsAppMessage(phoneNumber, "You don't have any upcoming reservations to cancel right now.");
      return;
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' },
    });

    if (reservation.depositPaid) {
      if (reservation.cryptoDepositTxHash && !reservation.cryptoDepositTxHash.startsWith('pending_')) {
        try {
          await cryptoService.refundEscrowToCustomer(reservation.id);
        } catch (e) {
          logger.error('[WhatsApp Cancel] Failed to trigger crypto refund', e);
        }
      } else {
        const payment = await prisma.payment.findFirst({
          where: { reservationId: reservation.id, status: 'COMPLETED' },
        });
        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'REFUNDED' },
          });
        }
      }

      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { depositPaid: false },
      });

      await sendWhatsAppMessage(phoneNumber, `Your reservation at ${reservation.business.name} on ${reservation.reservationDate} has been cancelled.`);
      return;
    }

    await sendWhatsAppMessage(phoneNumber, `Your reservation at ${reservation.business.name} on ${reservation.reservationDate} has been cancelled.`);
  } catch (error) {
    logger.error('[WhatsApp Cancel Error]:', error);
    await sendWhatsAppMessage(phoneNumber, 'Sorry, we encountered an error while trying to cancel your reservation. Please try again or use the app.');
  }
}
