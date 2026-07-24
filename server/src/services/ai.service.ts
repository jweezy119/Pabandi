import { prisma } from '../utils/database';
import axios from 'axios';
import { cryptoService } from './cryptoService';
import { openwaAfterHoursService } from './openwa.after-hours.service';
import { openwaFaqBotService } from './openwa.faq-bot.service';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const OPENWA_API_URL = process.env.OPENWA_API_URL || 'http://localhost:2785/api';
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || '';
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || 'pabandi';

export const sendWhatsAppMessage = async (toPhone: string, message: string) => {
  if (!OPENWA_API_KEY) {
    console.warn(`[WhatsApp MOCK] To: ${toPhone} | Message: ${message}`);
    return;
  }

  try {
    const url = `${OPENWA_API_URL}/sessions/${OPENWA_SESSION_ID}/messages/send-text`;
    const formattedPhone = toPhone.replace('+', '').replace(/\D/g, '') + '@c.us';
    const data = { chatId: formattedPhone, text: message };

    await axios.post(url, data, {
      headers: {
        'X-API-Key': OPENWA_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[WhatsApp] Sent message via OpenWA to ${toPhone}`);
  } catch (error: any) {
    console.error(`[WhatsApp] Error sending message to ${toPhone} via OpenWA:`, error.response?.data || error.message);
  }

  console.warn(`[WhatsApp MOCK] To: ${toPhone} | Message: ${message}`);
};

export const findBusinessByPublicPhone = async (phoneNumber: string) => {
  const clean = String(phoneNumber).replace(/[^\d]/g, '');
  if (!clean) return null;

  return prisma.business.findFirst({
    where: { phone: { contains: clean } },
    include: { settings: true },
  });
};

import { aiNlpService } from './ai.nlp.service';
import { openwaDropBotService } from './openwa.drop-bot.service';

export const processWhatsAppMessage = async (customerPhone: string, businessPhone: string, message: string, user: any | null) => {
  console.log(`[AI] Processing message from ${customerPhone} to ${businessPhone}: ${message}`);

  const lowerMsg = message.trim().toLowerCase();

  if (openwaDropBotService.isDropCommand(message)) {
    try {
      const business = await findBusinessByPublicPhone(businessPhone);
      if (business) {
        const reply = await openwaDropBotService.handleDropCommand(business.id, message);
        await sendWhatsAppMessage(customerPhone, reply);
        return;
      }
    } catch (e) {
      console.error('[Drop Bot Error]', e);
    }
  }

  if (user) {
    if (lowerMsg === 'cancel') {
      await handleWhatsAppCancellation(customerPhone, user);
      return;
    }
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
    console.log(`[AI NLP] Classification result:`, classification);

    if (classification.intent === 'booking' || classification.intent === 'sales') {
      const template = "Great! Let's lock in your reservation/order. Share date, time, guests, and I'll check availability and create a secure booking link for {{businessName}}.";
      const response = await aiNlpService.generateCopy(template, { businessName, businessSlug });
      await sendWhatsAppMessage(customerPhone, response);
      return;
    } else if (classification.intent === 'cancellation') {
      if (user) {
        await handleWhatsAppCancellation(customerPhone, user);
      } else {
        await sendWhatsAppMessage(customerPhone, 'To cancel, share your booking ID or phone number used while booking.');
      }
      return;
    } else if (classification.intent === 'support') {
      await sendWhatsAppMessage(customerPhone, 'I can help with deposits, refunds, menus, timings, or human handoff. What do you need?');
      return;
    }

    const fallback = "I'm the AI assistant for {{businessName}}. You can book, cancel, reschedule, check status, or ask a question. Share details like date/time/guests and I'll continue.";
    const fallbackResponse = await aiNlpService.generateCopy(fallback, { businessName, businessSlug });
    await sendWhatsAppMessage(customerPhone, fallbackResponse);

  } catch (pluginErr) {
    console.error('[Plugin] Pre-AI plugin handling failed:', pluginErr);
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
          console.error('[WhatsApp Cancel] Failed to trigger crypto refund', e);
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

      await sendWhatsAppMessage(phoneNumber, `✅ Your reservation at *${reservation.business.name}* on ${reservation.reservationDate} has been cancelled. Your deposit has been automatically refunded to you!`);
      return;
    }

    await sendWhatsAppMessage(phoneNumber, `✅ Your reservation at *${reservation.business.name}* on ${reservation.reservationDate} has been cancelled successfully.`);
  } catch (error) {
    console.error('[WhatsApp Cancel Error]:', error);
    await sendWhatsAppMessage(phoneNumber, "Sorry, we encountered an error while trying to cancel your reservation. Please try again or use the app.");
  }
}
