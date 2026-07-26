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
// Handler: Incoming messages
// ---------------------------------------------------------------------------

async function handleIncomingMessage(payload: OpenWAWebhookPayload): Promise<void> {
  const { data, sessionId } = payload;

  // Skip messages sent by us
  if (data.fromMe) return;

  // Skip group messages (for now — can be enabled per-business)
  if (data.isGroup) return;

  const senderPhone = extractPhone(data.from || data.chatId || '');
  const messageBody = data.body || '';
  const messageId = data.id || '';

  if (!senderPhone || (!messageBody && !data.hasMedia)) return;

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
  // 1. Handle Opt-outs for CRM campaigns
  // -------------------------------------------------------------------
  if (['stop', 'unsubscribe', 'opt-out', 'opt out', 'cancel'].includes(messageBody.toLowerCase().trim())) {
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
