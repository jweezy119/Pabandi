import { prisma } from '../utils/database';
import axios from 'axios';
import { cryptoService } from './cryptoService';
import { openwaAfterHoursService } from './openwa.after-hours.service';
import { openwaFaqBotService } from './openwa.faq-bot.service';
import { openwaChatFlowService } from './openwa.chat-flow.service';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const META_WA_ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN || '';
const META_WA_PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID || '';
const OPENWA_BASE_URL = (process.env.OPENWA_API_URL || 'http://localhost:2785/api').replace(/\/$/, '');
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || '';

const toChatId = (rawPhone: string) => `${String(rawPhone).replace(/[^\d]/g, '')}@c.us`;

export const sendWhatsAppMessage = async (toPhone: string, message: string) => {
  try {
    if (OPENWA_API_KEY && toPhone) {
      const sessionId = process.env.OPENWA_SESSION_ID || process.env.OPENWA_SESSION || 'default';
      const chatId = toChatId(toPhone);
      const url = `${OPENWA_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages/send-text`;

      const payload = {
        to: chatId,
        text: message,
      };

      await axios.post(
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(OPENWA_API_KEY ? { 'X-API-Key': OPENWA_API_KEY } : {}),
          },
          timeout: 10_000,
        }
      );

      console.log(`[WhatsApp] Sent message to ${toPhone}`);
      return;
    }
  } catch (openwaErr: any) {
    console.warn(`[OpenWA] send failed for ${toPhone}: ${openwaErr?.message || openwaErr}`);
  }

  try {
    if (META_WA_ACCESS_TOKEN && META_WA_PHONE_NUMBER_ID && toPhone) {
      const url = `https://graph.facebook.com/v19.0/${META_WA_PHONE_NUMBER_ID}/messages`;
      const formattedPhone = String(toPhone).replace('+', '');

      const data = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      };

      await axios.post(
        url,
        data,
        {
          headers: {
            Authorization: `Bearer ${META_WA_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`[WhatsApp] Sent message to ${toPhone}`);
      return;
    }
  } catch (cloudErr: any) {
    console.error(`[WhatsApp] Error sending message to ${toPhone}:`, cloudErr?.response?.data || cloudErr?.message || cloudErr);
  }

  console.warn(`[WhatsApp MOCK] To: ${toPhone} | Message: ${message}`);
};

async function findBusinessByPublicPhone(phoneNumber: string) {
  const clean = String(phoneNumber).replace(/[^\d]/g, '');
  if (!clean) return null;

  return prisma.business.findFirst({
    where: { phone: { contains: clean } },
    include: { settings: true },
  });
}

export const processWhatsAppMessage = async (phoneNumber: string, message: string, user: any | null) => {
  console.log(`[AI] Processing message from ${phoneNumber}: ${message}`);

  const lowerMsg = message.trim().toLowerCase();

  if (user) {
    if (lowerMsg === 'cancel') {
      await handleWhatsAppCancellation(phoneNumber, user);
      return;
    }
  }

  try {
    const business = await findBusinessByPublicPhone(phoneNumber);
    if (business) {
      const rawSettings = (business as any)?.settings;
      const settings =
        rawSettings && typeof rawSettings === 'object'
          ? { afterHoursJson: (rawSettings as any)?.afterHoursJson || null }
          : { afterHoursJson: null };

      const afterHours = openwaAfterHoursService.isAfterHoursNow({
        id: business.id,
        timezone: business.timezone,
        settings,
      });
      if (afterHours) {
        const away = openwaAfterHoursService.getAwayMessage(business);
        await sendWhatsAppMessage(phoneNumber, away);
        return;
      }

      const faqReply = openwaFaqBotService.evaluateMessage(message, Array.isArray((rawSettings as any)?.faqRules) ? (rawSettings as any).faqRules : undefined);
      if (faqReply) {
        await sendWhatsAppMessage(phoneNumber, faqReply);
        return;
      }
    }
  } catch (pluginErr) {
    console.error('[Plugin] Pre-AI plugin handling failed:', pluginErr);
  }

  if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
    console.warn('[AI] DashScope API Key missing, returning default auto-reply.');
    await sendWhatsAppMessage(phoneNumber, 'Welcome to Pabandi! We are currently upgrading our AI systems. Please check back later or use our website to manage your bookings.');
    return;
  }

  try {
    let context = 'You are the Pabandi AI Assistant. Pabandi is a reliability and trust layer launching first in Pakistan, built for informal commerce worldwide.\n';

    if (user) {
      context += `The person you are talking to is ${user.firstName} ${user.lastName}, a registered ${user.role} on Pabandi.\n`;
      if (user.role === 'BUSINESS_OWNER') {
        context += `As an enterprise owner, they might ask about their reservations or want to manage their profile.\n`;
      } else {
        context += `As a customer, they might want to book a table, check reservations, or ask about No-Show deposits.\n`;
      }
    } else {
      context += `The person you are talking to is an unregistered user. Briefly mention they can sign up on pabandi.com for rewards.\n`;
    }

    context += `
Keep your answers brief, conversational, and helpful. You must respond in English.
If the user asks to book a table, acknowledge their request and tell them you are checking availability (simulate for now).
Do not generate markdown or long lists.
`;

    const payload = {
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: message }
        ]
      },
      parameters: {
        result_format: 'message'
      }
    };

    const response = await axios.post(
      'https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      payload,
      {
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let aiResponse = "I'm sorry, I couldn't process your request.";
    if (response.data && response.data.output && response.data.output.choices && response.data.output.choices.length > 0) {
      aiResponse = response.data.output.choices[0].message.content.trim();
    }

    await sendWhatsAppMessage(phoneNumber, aiResponse);
  } catch (error: any) {
    console.error('[AI] Error generating AI response from DashScope:', error.response?.data || error.message);
    await sendWhatsAppMessage(phoneNumber, 'Sorry, I am having trouble understanding right now. Please try again or use the app.');
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
      orderBy: { createdAt: 'desc' }
    });

    if (!reservation) {
      await sendWhatsAppMessage(phoneNumber, "You don't have any upcoming reservations to cancel right now.");
      return;
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' }
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
          where: { reservationId: reservation.id, status: 'COMPLETED' }
        });
        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'REFUNDED' }
          });
        }
      }

      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { depositPaid: false }
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
