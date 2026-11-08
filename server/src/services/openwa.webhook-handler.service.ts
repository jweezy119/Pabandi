import { webhookManager, OpenWAWebhookPayload } from './openwa.webhook-manager.service';
import { openwaService } from './whatsapp.service';
import { openwaAfterHoursService } from './openwa.after-hours.service';
import { openwaFaqBotService } from './openwa.faq-bot.service';
import { whatsAppIntentService } from './whatsapp-intent.service';
import { whatsAppSmartService } from './whatsapp.smart.service';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import * as admin from 'firebase-admin';
import { OfframpService } from './offramp.service';

// ---------------------------------------------------------------------------
// Message ACK tracking (delivery receipts)
// ---------------------------------------------------------------------------

interface AckRecord {
  messageId: string;
  ack: number;
  updatedAt: number;
}

const ackCache = new Map<string, AckRecord>();
const ACK_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ACK levels from WhatsApp:
// 0 = pending, 1 = sent (single check), 2 = delivered (double check), 3 = read (blue check)
const ACK_LABELS: Record<number, string> = {
  0: 'pending',
  1: 'sent',
  2: 'delivered',
  3: 'read',
};

// ---------------------------------------------------------------------------
// Setup all webhook handlers
// ---------------------------------------------------------------------------

export function registerWebhookHandlers(): void {
  // Incoming customer messages (not from us)
  webhookManager.onEvent('message.received', handleIncomingMessage);

  // Delivery status tracking
  webhookManager.onEvent('message.ack', handleMessageAck);

  // Message send failures
  webhookManager.onEvent('message.failed', handleMessageFailed);

  // Session status monitoring
  webhookManager.onEvent('session.status', handleSessionStatus);
  webhookManager.onEvent('session.disconnected', handleSessionDisconnected);

  // Reactions
  webhookManager.onEvent('message.reaction', handleReaction);

  logger.info('[WebhookHandlers] All webhook event handlers registered');
}

// ---------------------------------------------------------------------------
// Human Takeover / Manual Chat Pause Store
// ---------------------------------------------------------------------------

const pausedChats = new Map<string, number>(); // phone -> expiresAt timestamp

export function pauseChat(phone: string, durationMinutes = 45): void {
  const clean = extractPhone(phone);
  if (!clean) return;
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  pausedChats.set(clean, expiresAt);
  logger.info(`[WebhookHandler] Bot paused for chat ${clean} until ${new Date(expiresAt).toLocaleTimeString()}`);
}

export function isChatPaused(phone: string): boolean {
  const clean = extractPhone(phone);
  if (!clean) return false;
  const expiresAt = pausedChats.get(clean);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    pausedChats.delete(clean);
    return false;
  }
  return true;
}

export function unpauseChat(phone: string): void {
  const clean = extractPhone(phone);
  if (clean) pausedChats.delete(clean);
}

// ---------------------------------------------------------------------------
// Handler: Incoming messages
// ---------------------------------------------------------------------------

async function handleIncomingMessage(payload: OpenWAWebhookPayload): Promise<void> {
  const { data, sessionId } = payload;

  // 1. If message was sent by the business owner manually from their phone:
  // Gracefully step back so there are no embarrassing double/conflicting bot replies.
  if (data.fromMe) {
    const recipientPhone = extractPhone(data.to || data.chatId || '');
    if (recipientPhone) {
      pauseChat(recipientPhone, 45); // Pause bot for 45 minutes
      logger.info(`[WebhookHandler] Business owner typed manual message to ${recipientPhone}. Bot paused for 45m.`);
    }
    return;
  }

  // Skip group messages (for now — can be enabled per-business)
  if (data.isGroup) return;

  const senderPhone = extractPhone(data.from || data.chatId || '');
  const messageBody = data.body || '';
  const messageId = data.id || '';

  if (!senderPhone || (!messageBody && !data.hasMedia)) return;

  // 2. Check if this customer chat is currently paused (Human Co-Pilot active)
  if (isChatPaused(senderPhone)) {
    logger.info(`[WebhookHandler] Chat with ${senderPhone} is paused (human takeover active). Skipping bot.`);
    return;
  }

  // 3. Check if customer explicitly requested human handoff or receptionist button
  const lowerBody = messageBody.toLowerCase().trim();
  const isHumanHandoffRequest = [
    'talk to human',
    'human',
    'receptionist',
    'talk to staff',
    'speak to staff',
    'call receptionist',
    'btn_support',
    'talk_to_staff',
  ].includes(lowerBody) || lowerBody.startsWith('talk to') || lowerBody.includes('human handoff');

  if (isHumanHandoffRequest) {
    pauseChat(senderPhone, 60); // Pause bot for 60 minutes
    try {
      await openwaService.sendText(
        senderPhone,
        '👤 *Team Notified*\n\nAutomated replies have been paused. A staff member has been alerted and will reply to you directly right here on WhatsApp.',
        { sessionId }
      );
    } catch {
      // Ignore send errors
    }
    logger.info(`[WebhookHandler] Customer ${senderPhone} requested human handoff. Bot paused for 60m.`);
    return;
  }

  logger.info(`[WebhookHandler] Incoming message from ${senderPhone}: "${messageBody.substring(0, 80)}" ${data.hasMedia ? '[MEDIA ATTACHED]' : ''}`);
  
  // -------------------------------------------------------------------
  // 0. AI Vision Rail (Step 5 feature)
  // -------------------------------------------------------------------
  if (data.hasMedia) {
    logger.info(`[WebhookHandler] Routing inbound media to AI Vision rail for ${senderPhone}`);
    try {
      // Stub for Qwen Vision processing
      await openwaService.sendText(senderPhone, 'I see you sent an image/media. Let me review that for you (Qwen Vision active).', { sessionId });
      // Here we would extract data.mediaUrl or use Evolution API to download the media buffer
      // and send it to ai.nlp.service's vision endpoints. For now, we ack the receipt intelligently.
      return;
    } catch (e) {
      logger.error(`[WebhookHandler] Vision rail error: ${e}`);
    }
  }

  // -------------------------------------------------------------------
  // 0.5. Instant WhatsApp Business Onboarding (Inbound & Outbound responses)
  // -------------------------------------------------------------------
  try {
    const { whatsAppOnboardingService } = await import('./whatsapp.onboarding.service');
    if (whatsAppOnboardingService.isOnboardingIntent(messageBody)) {
      const parsedData = whatsAppOnboardingService.parseMessageToBusiness(messageBody, senderPhone);
      const result = await whatsAppOnboardingService.onboardBusiness(parsedData);

      const confirmText =
        `🎉 *Mubarak! ${result.business.name} is now LIVE on Pabandi!*\n\n` +
        `✅ *Services Configured (${result.servicesCount}):*\n` +
        parsedData.services.map((s) => `• ${s.name}: Rs. ${s.price}`).join('\n') +
        `\n\n📍 *City:* ${parsedData.city}\n` +
        `⏰ *Hours:* ${parsedData.hours}\n` +
        `🔒 *Raast ID:* ${parsedData.raastId} (Deposit: Rs. ${parsedData.depositAmount})\n\n` +
        `🌐 *Your Customer Profile:*\n${result.profileUrl}\n\n` +
        `📲 *Your Click-to-Chat Booking Link:*\n${result.customerLink}\n\n` +
        `🔑 *Device Pairing Code (Link Phone):* ${result.pairingCode}\n` +
        `To turn this WhatsApp into your automated 24/7 assistant:\n` +
        `Go to *Settings > Linked Devices > Link with phone number* & enter code *${result.pairingCode}*`;

      const buttons = [
        { id: `view_profile_${result.business.slug}`, text: '🌐 View My Profile' },
        { id: 'btn_marketing_standee', text: '🪧 Get Standee QR' },
        { id: 'btn_human', text: '👤 Talk to Team' },
      ];

      await openwaService.sendButtons(senderPhone, confirmText, buttons, {
        title: `Welcome to Pabandi • ${result.business.name}`,
        footer: 'Pabandi SME Trust Engine',
        sessionId,
      });

      logger.info(`[WebhookHandler] Business ${result.business.name} onboarded instantly via WhatsApp from ${senderPhone}`);
      return;
    }
  } catch (err: any) {
    logger.warn(`[WebhookHandler] Onboarding check/execution error: ${err?.message}`);
  }

  // -------------------------------------------------------------------
  // 0.8. Two-Way Booking State Machine (Confirm / Reschedule / Cancel / Rate)
  // Handles interactive button payloads from reminderCron.service.ts & post-visit loop:
  //   confirm_<id> | reschedule_<id> | cancel_<id> | rate_<id>_<1..5>
  // -------------------------------------------------------------------
  try {
    const trimmedCmd = messageBody.trim();
    const buttonMatch = trimmedCmd.match(/^(confirm|reschedule|cancel)_([a-zA-Z0-9_-]+)$/i);
    const rateMatch = trimmedCmd.match(/^rate_([a-zA-Z0-9_-]+)_([1-5])$/i);

    if (rateMatch) {
      const targetId = rateMatch[1];
      const stars = parseInt(rateMatch[2], 10);
      const reservation = await prisma.reservation.findUnique({
        where: { id: targetId },
        include: { business: true },
      });

      if (reservation) {
        const bizName = reservation.business?.name || 'our venue';
        const slugOrId = reservation.business?.slug || reservation.businessId;
        const rebookUrl = `https://pabandi.com/business/${slugOrId}/book?rebook=${reservation.id}`;

        if (stars >= 4) {
          const googleReviewUrl = reservation.business?.googlePlaceId
            ? `https://search.google.com/local/writereview?placeid=${reservation.business.googlePlaceId}`
            : `https://pabandi.com/business/${slugOrId}?tab=reviews`;

          await openwaService.sendText(
            senderPhone,
            `Thank you for rating your visit at *${bizName}* (${stars}/5).\n\n` +
              `Public review link: ${googleReviewUrl}\n\n` +
              `To schedule your next appointment slot: ${rebookUrl}`,
            { sessionId }
          );
        } else {
          await openwaService.sendText(
            senderPhone,
            `Thank you for your feedback (${stars}/5) regarding *${bizName}*. Your note has been logged with the management team. Reply directly to this message with any details you would like us to address.`,
            { sessionId }
          );
        }
        logger.info(`[WebhookHandler] Processed post-visit rating ${stars}/5 for reservation ${targetId}`);
        return;
      }
    }

    if (buttonMatch) {
      const action = buttonMatch[1].toLowerCase() as 'confirm' | 'reschedule' | 'cancel';
      const recordId = buttonMatch[2];

      // 1. Check Consumer Reservation first
      const reservation = await prisma.reservation.findUnique({
        where: { id: recordId },
        include: { business: true },
      });

      if (reservation) {
        const bizName = reservation.business?.name || 'Pabandi Partner';
        const slugOrId = reservation.business?.slug || reservation.businessId;
        const dateStr = new Date(reservation.reservationDate).toLocaleDateString();
        const timeStr = reservation.reservationTime;

        if (action === 'confirm') {
          await prisma.reservation.update({
            where: { id: reservation.id },
            data: { status: 'CONFIRMED' },
          });
          const { cnftService } = await import('./cnft.service');
          const cnft = await cnftService.verifyCredential(reservation.id);

          await openwaService.sendText(
            senderPhone,
            `✅ *Attendance Confirmed — ${bizName}*\n\n` +
              `Reservation Reference: #${reservation.id.slice(-6).toUpperCase()}\n` +
              `Date & Time: ${dateStr} at ${timeStr}\n` +
              (cnft.credential ? `Booking Credential (cNFT): ${cnft.credential.assetId}\n` : '') +
              `\nYour status has been updated to Confirmed.`,
            { sessionId }
          );
          logger.info(`[WebhookHandler] Reservation ${reservation.id} confirmed via WhatsApp button`);
          return;
        }

        if (action === 'reschedule') {
          const rescheduleUrl = `https://pabandi.com/business/${slugOrId}/book?reschedule=${reservation.id}`;
          await openwaService.sendText(
            senderPhone,
            `🔄 *Reschedule Appointment — ${bizName}*\n\n` +
              `Current Slot: ${dateStr} at ${timeStr}\n` +
              `Select a new time slot here: ${rescheduleUrl}`,
            { sessionId }
          );
          logger.info(`[WebhookHandler] Sent reschedule link for reservation ${reservation.id}`);
          return;
        }

        if (action === 'cancel') {
          await prisma.reservation.update({
            where: { id: reservation.id },
            data: { status: 'CANCELLED' },
          });
          const { cnftService } = await import('./cnft.service');
          await cnftService.updateCredentialStatus(reservation.id, 'CANCELLED');

          await openwaService.sendText(
            senderPhone,
            `❌ *Reservation Cancelled — ${bizName}*\n\n` +
              `Reference: #${reservation.id.slice(-6).toUpperCase()}\n` +
              `Slot: ${dateStr} at ${timeStr}\n\n` +
              `Your reservation has been cancelled.`,
            { sessionId }
          );

          // Notify up to 3 waitlisted/previous patrons with strictly utility slot availability message (no promotional copy)
          try {
            const waitlistPatrons = await prisma.reservation.findMany({
              where: {
                businessId: reservation.businessId,
                status: 'CANCELLED',
                customerPhone: { not: senderPhone },
              },
              orderBy: { createdAt: 'desc' },
              take: 3,
            });
            const { openwaTemplateService } = await import('./openwa.template.service');
            for (const patron of waitlistPatrons) {
              if (!patron.customerPhone) continue;
              const waitlistMsg = openwaTemplateService.render('waitlist_slot_available', {
                customerName: patron.customerName || 'Guest',
                businessName: bizName,
                reservationDate: dateStr,
                reservationTime: timeStr,
                slotRef: reservation.id.slice(-6).toUpperCase(),
                bookingUrl: `https://pabandi.com/business/${slugOrId}/book`,
              });
              await openwaService.sendText(patron.customerPhone, waitlistMsg, { sessionId }).catch(() => {});
            }
          } catch (wlErr: any) {
            logger.warn(`[WebhookHandler] Waitlist utility alert warning: ${wlErr?.message}`);
          }

          logger.info(`[WebhookHandler] Reservation ${reservation.id} cancelled via WhatsApp button`);
          return;
        }
      }

      // 2. Check CRM Job if not a Consumer Reservation
      const crmJob = await prisma.crmJob.findUnique({
        where: { id: recordId },
        include: {
          client: true,
          serviceBusiness: { include: { business: true } },
        },
      });

      if (crmJob) {
        const bizName = crmJob.serviceBusiness?.business?.name || 'Pabandi Partner';
        const slugOrId = crmJob.serviceBusiness?.business?.slug || crmJob.serviceBusiness?.businessId || '';
        const dateStr = new Date(crmJob.scheduledDate).toLocaleDateString();
        const timeStr = crmJob.scheduledTime || '';

        if (action === 'confirm') {
          await prisma.crmJob.update({
            where: { id: crmJob.id },
            data: { status: 'IN_PROGRESS' },
          });
          await openwaService.sendText(
            senderPhone,
            `✅ *Appointment Confirmed — ${bizName}*\n\n` +
              `Reference: #${crmJob.id.slice(-6).toUpperCase()}\n` +
              `Scheduled: ${dateStr} ${timeStr}\n\n` +
              `Your confirmation has been recorded.`,
            { sessionId }
          );
          logger.info(`[WebhookHandler] CRM Job ${crmJob.id} confirmed via WhatsApp button`);
          return;
        }

        if (action === 'reschedule') {
          const rescheduleUrl = slugOrId
            ? `https://pabandi.com/business/${slugOrId}/book?reschedule=${crmJob.id}`
            : `https://pabandi.com/booking`;
          await openwaService.sendText(
            senderPhone,
            `🔄 *Reschedule Appointment — ${bizName}*\n\n` +
              `Current Schedule: ${dateStr} ${timeStr}\n` +
              `Update your appointment time here: ${rescheduleUrl}`,
            { sessionId }
          );
          return;
        }

        if (action === 'cancel') {
          await prisma.crmJob.update({
            where: { id: crmJob.id },
            data: { status: 'CANCELLED' },
          });
          await openwaService.sendText(
            senderPhone,
            `❌ *Appointment Cancelled — ${bizName}*\n\n` +
              `Reference: #${crmJob.id.slice(-6).toUpperCase()}\n` +
              `Scheduled: ${dateStr} ${timeStr}\n\n` +
              `Your appointment has been cancelled.`,
            { sessionId }
          );
          logger.info(`[WebhookHandler] CRM Job ${crmJob.id} cancelled via WhatsApp button`);
          return;
        }
      }
    }
  } catch (btnErr: any) {
    logger.warn(`[WebhookHandler] Button state machine error: ${btnErr?.message}`);
  }

  // -------------------------------------------------------------------
  // 1. Handle Opt-outs for CRM campaigns (only explicit stop/unsubscribe keywords)
  // -------------------------------------------------------------------
  if (['stop', 'unsubscribe', 'opt-out', 'opt out'].includes(messageBody.toLowerCase().trim())) {
    try {
      if (!admin.apps.length) admin.initializeApp();
      const db = admin.firestore();
      
      const snapshot = await db.collection('waitlist')
        .where('phone', '>=', senderPhone)
        .where('phone', '<=', senderPhone + '\uf8ff')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const leadDoc = snapshot.docs[0];
        await leadDoc.ref.update({
          outreachStatus: 'NOT_INTERESTED',
          notes: 'Opted out via WhatsApp reply.',
          updatedAt: new Date().toISOString()
        });
        
        await openwaService.sendText(senderPhone, "You've been unsubscribed. Reply START if you change your mind.", { sessionId });
        logger.info(`[WebhookHandler] Lead ${leadDoc.id} (${senderPhone}) opted out.`);
        return;
      }
    } catch (e: any) {
      logger.warn(`[WebhookHandler] Opt-out handling failed: ${e?.message}`);
    }
  }

  // -------------------------------------------------------------------
  // 1.5. LP Terminal Commands (ACCEPT, SKIP, PAUSE)
  // -------------------------------------------------------------------
  const parts = messageBody.trim().split(' ');
  const command = parts[0]?.toUpperCase();

  if (['ACCEPT', 'SKIP', 'PAUSE'].includes(command)) {
    const channel = await prisma.lpChannel.findFirst({
      where: { address: senderPhone, verified: true },
    });

    if (channel) {
      const lp = await prisma.liquidityProvider.findUnique({ where: { id: channel.lpId } });
      if (lp) {
        try {
          if (command === 'ACCEPT') {
            const intentId = parts[1];
            if (!intentId) throw new Error('Missing intent ID. Use ACCEPT <ID>');
            
            const offrampService = new OfframpService();
            await offrampService.matchLp(intentId, lp.walletAddress);
            await openwaService.sendText(senderPhone, `✅ Successfully claimed intent ${intentId}! Please fulfill within SLA.`, { sessionId });
          } else if (command === 'PAUSE') {
            await prisma.lpChannel.update({
              where: { id: channel.id },
              data: { quietHours: 'PAUSED' }
            });
            await openwaService.sendText(senderPhone, '⏸ You are now paused. You will not receive new intents.', { sessionId });
          } else if (command === 'SKIP') {
            await openwaService.sendText(senderPhone, '⏭ Skipped. Passing to the next LP.', { sessionId });
          }
        } catch (e: any) {
          if (e.message.includes('already matched')) {
            await openwaService.sendText(senderPhone, '🤝 Too slow, next one\'s yours.', { sessionId });
          } else {
            await openwaService.sendText(senderPhone, `❌ Error: ${e.message}`, { sessionId });
          }
        }
        return; // Early return so LP commands aren't processed as customer bots
      }
    }
  }

  // -------------------------------------------------------------------
  // 1.8. Tri-Directional Concierge A2H / H2A Handshake Check
  // -------------------------------------------------------------------
  try {
    const { triDirectionalConciergeService } = await import('./triDirectionalConcierge.service');
    const h2aResult = await triDirectionalConciergeService.handleH2AMessage(senderPhone, messageBody);
    if (h2aResult.handled) {
      if (h2aResult.replyText) {
        await openwaService.sendText(senderPhone, h2aResult.replyText, { sessionId });
      }
      return;
    }
  } catch (err: any) {
    logger.debug(`[WebhookHandler] TriConcierge H2A check error: ${err?.message}`);
  }

  // -------------------------------------------------------------------
  // 2. Check if sender is a known customer → resolve business context
  // -------------------------------------------------------------------
  let business: any = null;
  try {
    // Look up the most recent reservation for this phone to determine which business
    const reservation = await prisma.reservation.findFirst({
      where: { customerPhone: senderPhone },
      orderBy: { createdAt: 'desc' },
      include: { business: { include: { settings: true } } },
    });
    business = reservation?.business || null;
  } catch (error: any) {
    logger.warn(`[WebhookHandler] Could not resolve business for ${senderPhone}: ${error?.message}`);
  }

  // -------------------------------------------------------------------
  // 2. After-hours check
  // -------------------------------------------------------------------
  if (business) {
    try {
      const isAfterHours = openwaAfterHoursService.isAfterHoursNow({
        id: business.id,
        timezone: business.timezone,
        settings: business.settings || null,
      });

      if (isAfterHours) {
        const awayMsg = openwaAfterHoursService.getAwayMessage({
          id: business.id,
          timezone: business.timezone,
          settings: business.settings || null,
        });
        await openwaService.sendText(senderPhone, awayMsg, { sessionId });
        logger.info(`[WebhookHandler] After-hours reply sent to ${senderPhone}`);
        return;
      }
    } catch (error: any) {
      logger.warn(`[WebhookHandler] After-hours check failed: ${error?.message}`);
    }
  }

  // -------------------------------------------------------------------
  // 3. FAQ Bot auto-reply
  // -------------------------------------------------------------------
  try {
    const faqReply = openwaFaqBotService.evaluateMessage(messageBody, business?.settings?.faqRules || null);
    if (faqReply) {
      await openwaService.sendText(senderPhone, faqReply, { sessionId });
      logger.info(`[WebhookHandler] FAQ auto-reply sent to ${senderPhone}`);
      return;
    }
  } catch (error: any) {
    logger.warn(`[WebhookHandler] FAQ bot error: ${error?.message}`);
  }

  // -------------------------------------------------------------------
  // 4. Intent matching (stateless quick replies)
  // -------------------------------------------------------------------
  try {
    const intentMatch = whatsAppIntentService.match(messageBody, {
      businessName: business?.name || '',
    });

    if (intentMatch) {
      const fullReply = [intentMatch.reply, intentMatch.pluginSummary].filter(Boolean).join('\n\n');
      await openwaService.sendText(senderPhone, fullReply, { sessionId });
      logger.info(`[WebhookHandler] Intent "${intentMatch.matchedIntent}" reply sent to ${senderPhone}`);
      return;
    }
  } catch (error: any) {
    logger.warn(`[WebhookHandler] Intent service error: ${error?.message}`);
  }

  // -------------------------------------------------------------------
  // 5. Smart service (stateful multi-turn flows)
  // -------------------------------------------------------------------
  try {
    const businessPhone = business?.settings?.whatsappNumber || '';
    const smartReply = await whatsAppSmartService.processMessage(senderPhone, businessPhone, messageBody);

    if (smartReply) {
      // smartReply.text was already sent by the smart service via sendWhatsAppMessage
      logger.info(`[WebhookHandler] Smart flow "${smartReply.matchedIntent}" handled for ${senderPhone}`);
      return;
    }
  } catch (error: any) {
    logger.warn(`[WebhookHandler] Smart service error: ${error?.message}`);
  }

  // -------------------------------------------------------------------
  // 6. Fallback: acknowledge receipt with a reaction
  // -------------------------------------------------------------------
  if (messageId) {
    try {
      await openwaService.sendReaction(messageId, '👋', { chatId: data.chatId, sessionId });
    } catch {
      // Reaction is optional; swallow errors
    }
  }
}

// ---------------------------------------------------------------------------
// Handler: Message ACK (delivery receipts)
// ---------------------------------------------------------------------------

async function handleMessageAck(payload: OpenWAWebhookPayload): Promise<void> {
  const { data } = payload;
  const messageId = data.id || '';
  const ack = typeof data.ack === 'number' ? data.ack : -1;

  if (!messageId || ack < 0) return;

  ackCache.set(messageId, {
    messageId,
    ack,
    updatedAt: Date.now(),
  });

  // Prune stale entries
  if (ackCache.size > 5000) {
    const now = Date.now();
    for (const [key, record] of ackCache) {
      if (now - record.updatedAt > ACK_CACHE_TTL_MS) {
        ackCache.delete(key);
      }
    }
  }

  logger.debug(`[WebhookHandler] ACK ${ACK_LABELS[ack] || ack} for message ${messageId}`);
}

// ---------------------------------------------------------------------------
// Handler: Message failed
// ---------------------------------------------------------------------------

async function handleMessageFailed(payload: OpenWAWebhookPayload): Promise<void> {
  const { data, sessionId } = payload;
  logger.error(`[WebhookHandler] Message send failed on session ${sessionId}: ${JSON.stringify(data).substring(0, 200)}`);
}

// ---------------------------------------------------------------------------
// Handler: Session status
// ---------------------------------------------------------------------------

async function handleSessionStatus(payload: OpenWAWebhookPayload): Promise<void> {
  const { data, sessionId } = payload;
  const status = (data as any).status || 'unknown';
  logger.info(`[WebhookHandler] Session ${sessionId} status changed: ${status}`);
}

// ---------------------------------------------------------------------------
// Handler: Session disconnected
// ---------------------------------------------------------------------------

async function handleSessionDisconnected(payload: OpenWAWebhookPayload): Promise<void> {
  const { sessionId } = payload;
  logger.warn(`[WebhookHandler] Session ${sessionId} disconnected`);
}

// ---------------------------------------------------------------------------
// Handler: Reactions
// ---------------------------------------------------------------------------

async function handleReaction(payload: OpenWAWebhookPayload): Promise<void> {
  const { data, sessionId } = payload;
  logger.info(`[WebhookHandler] Reaction on session ${sessionId}: ${JSON.stringify(data).substring(0, 100)}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a clean phone number from a WhatsApp JID or phone string.
 * e.g. "1234567890@c.us" → "1234567890"
 */
function extractPhone(jidOrPhone: string): string {
  if (!jidOrPhone) return '';
  return jidOrPhone.replace(/@[a-z.]+$/, '').replace(/[^\d]/g, '');
}

/**
 * Public helper to check if a message was delivered/read.
 */
export function getMessageAck(messageId: string): AckRecord | null {
  return ackCache.get(messageId) || null;
}
