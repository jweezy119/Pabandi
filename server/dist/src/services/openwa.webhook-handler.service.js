"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWebhookHandlers = registerWebhookHandlers;
exports.getMessageAck = getMessageAck;
const openwa_webhook_manager_service_1 = require("./openwa.webhook-manager.service");
const whatsapp_service_1 = require("./whatsapp.service");
const openwa_after_hours_service_1 = require("./openwa.after-hours.service");
const openwa_faq_bot_service_1 = require("./openwa.faq-bot.service");
const whatsapp_intent_service_1 = require("./whatsapp-intent.service");
const whatsapp_smart_service_1 = require("./whatsapp.smart.service");
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const admin = __importStar(require("firebase-admin"));
const offramp_service_1 = require("./offramp.service");
const ackCache = new Map();
const ACK_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// ACK levels from WhatsApp:
// 0 = pending, 1 = sent (single check), 2 = delivered (double check), 3 = read (blue check)
const ACK_LABELS = {
    0: 'pending',
    1: 'sent',
    2: 'delivered',
    3: 'read',
};
// ---------------------------------------------------------------------------
// Setup all webhook handlers
// ---------------------------------------------------------------------------
function registerWebhookHandlers() {
    // Incoming customer messages (not from us)
    openwa_webhook_manager_service_1.webhookManager.onEvent('message.received', handleIncomingMessage);
    // Delivery status tracking
    openwa_webhook_manager_service_1.webhookManager.onEvent('message.ack', handleMessageAck);
    // Message send failures
    openwa_webhook_manager_service_1.webhookManager.onEvent('message.failed', handleMessageFailed);
    // Session status monitoring
    openwa_webhook_manager_service_1.webhookManager.onEvent('session.status', handleSessionStatus);
    openwa_webhook_manager_service_1.webhookManager.onEvent('session.disconnected', handleSessionDisconnected);
    // Reactions
    openwa_webhook_manager_service_1.webhookManager.onEvent('message.reaction', handleReaction);
    logger_1.logger.info('[WebhookHandlers] All webhook event handlers registered');
}
// ---------------------------------------------------------------------------
// Handler: Incoming messages
// ---------------------------------------------------------------------------
async function handleIncomingMessage(payload) {
    const { data, sessionId } = payload;
    // Skip messages sent by us
    if (data.fromMe)
        return;
    // Skip group messages (for now — can be enabled per-business)
    if (data.isGroup)
        return;
    const senderPhone = extractPhone(data.from || data.chatId || '');
    const messageBody = data.body || '';
    const messageId = data.id || '';
    if (!senderPhone || (!messageBody && !data.hasMedia))
        return;
    logger_1.logger.info(`[WebhookHandler] Incoming message from ${senderPhone}: "${messageBody.substring(0, 80)}" ${data.hasMedia ? '[MEDIA ATTACHED]' : ''}`);
    // -------------------------------------------------------------------
    // 0. AI Vision Rail (Step 5 feature)
    // -------------------------------------------------------------------
    if (data.hasMedia) {
        logger_1.logger.info(`[WebhookHandler] Routing inbound media to AI Vision rail for ${senderPhone}`);
        try {
            // Stub for Qwen Vision processing
            await whatsapp_service_1.openwaService.sendText(senderPhone, 'I see you sent an image/media. Let me review that for you (Qwen Vision active).', { sessionId });
            // Here we would extract data.mediaUrl or use Evolution API to download the media buffer
            // and send it to ai.nlp.service's vision endpoints. For now, we ack the receipt intelligently.
            return;
        }
        catch (e) {
            logger_1.logger.error(`[WebhookHandler] Vision rail error: ${e}`);
        }
    }
    // -------------------------------------------------------------------
    // 1. Handle Opt-outs for CRM campaigns
    // -------------------------------------------------------------------
    if (['stop', 'unsubscribe', 'opt-out', 'opt out', 'cancel'].includes(messageBody.toLowerCase().trim())) {
        try {
            if (!admin.apps.length)
                admin.initializeApp();
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
                await whatsapp_service_1.openwaService.sendText(senderPhone, "You've been unsubscribed. Reply START if you change your mind.", { sessionId });
                logger_1.logger.info(`[WebhookHandler] Lead ${leadDoc.id} (${senderPhone}) opted out.`);
                return;
            }
        }
        catch (e) {
            logger_1.logger.warn(`[WebhookHandler] Opt-out handling failed: ${e?.message}`);
        }
    }
    // -------------------------------------------------------------------
    // 1.5. LP Terminal Commands (ACCEPT, SKIP, PAUSE)
    // -------------------------------------------------------------------
    const parts = messageBody.trim().split(' ');
    const command = parts[0]?.toUpperCase();
    if (['ACCEPT', 'SKIP', 'PAUSE'].includes(command)) {
        const channel = await database_1.prisma.lpChannel.findFirst({
            where: { address: senderPhone, verified: true },
        });
        if (channel) {
            const lp = await database_1.prisma.liquidityProvider.findUnique({ where: { id: channel.lpId } });
            if (lp) {
                try {
                    if (command === 'ACCEPT') {
                        const intentId = parts[1];
                        if (!intentId)
                            throw new Error('Missing intent ID. Use ACCEPT <ID>');
                        const offrampService = new offramp_service_1.OfframpService();
                        await offrampService.matchLp(intentId, lp.walletAddress);
                        await whatsapp_service_1.openwaService.sendText(senderPhone, `✅ Successfully claimed intent ${intentId}! Please fulfill within SLA.`, { sessionId });
                    }
                    else if (command === 'PAUSE') {
                        await database_1.prisma.lpChannel.update({
                            where: { id: channel.id },
                            data: { quietHours: 'PAUSED' }
                        });
                        await whatsapp_service_1.openwaService.sendText(senderPhone, '⏸ You are now paused. You will not receive new intents.', { sessionId });
                    }
                    else if (command === 'SKIP') {
                        await whatsapp_service_1.openwaService.sendText(senderPhone, '⏭ Skipped. Passing to the next LP.', { sessionId });
                    }
                }
                catch (e) {
                    if (e.message.includes('already matched')) {
                        await whatsapp_service_1.openwaService.sendText(senderPhone, '🤝 Too slow, next one\'s yours.', { sessionId });
                    }
                    else {
                        await whatsapp_service_1.openwaService.sendText(senderPhone, `❌ Error: ${e.message}`, { sessionId });
                    }
                }
                return; // Early return so LP commands aren't processed as customer bots
            }
        }
    }
    // -------------------------------------------------------------------
    // 2. Check if sender is a known customer → resolve business context
    // -------------------------------------------------------------------
    let business = null;
    try {
        // Look up the most recent reservation for this phone to determine which business
        const reservation = await database_1.prisma.reservation.findFirst({
            where: { customerPhone: senderPhone },
            orderBy: { createdAt: 'desc' },
            include: { business: { include: { settings: true } } },
        });
        business = reservation?.business || null;
    }
    catch (error) {
        logger_1.logger.warn(`[WebhookHandler] Could not resolve business for ${senderPhone}: ${error?.message}`);
    }
    // -------------------------------------------------------------------
    // 2. After-hours check
    // -------------------------------------------------------------------
    if (business) {
        try {
            const isAfterHours = openwa_after_hours_service_1.openwaAfterHoursService.isAfterHoursNow({
                id: business.id,
                timezone: business.timezone,
                settings: business.settings || null,
            });
            if (isAfterHours) {
                const awayMsg = openwa_after_hours_service_1.openwaAfterHoursService.getAwayMessage({
                    id: business.id,
                    timezone: business.timezone,
                    settings: business.settings || null,
                });
                await whatsapp_service_1.openwaService.sendText(senderPhone, awayMsg, { sessionId });
                logger_1.logger.info(`[WebhookHandler] After-hours reply sent to ${senderPhone}`);
                return;
            }
        }
        catch (error) {
            logger_1.logger.warn(`[WebhookHandler] After-hours check failed: ${error?.message}`);
        }
    }
    // -------------------------------------------------------------------
    // 3. FAQ Bot auto-reply
    // -------------------------------------------------------------------
    try {
        const faqReply = openwa_faq_bot_service_1.openwaFaqBotService.evaluateMessage(messageBody, business?.settings?.faqRules || null);
        if (faqReply) {
            await whatsapp_service_1.openwaService.sendText(senderPhone, faqReply, { sessionId });
            logger_1.logger.info(`[WebhookHandler] FAQ auto-reply sent to ${senderPhone}`);
            return;
        }
    }
    catch (error) {
        logger_1.logger.warn(`[WebhookHandler] FAQ bot error: ${error?.message}`);
    }
    // -------------------------------------------------------------------
    // 4. Intent matching (stateless quick replies)
    // -------------------------------------------------------------------
    try {
        const intentMatch = whatsapp_intent_service_1.whatsAppIntentService.match(messageBody, {
            businessName: business?.name || '',
        });
        if (intentMatch) {
            const fullReply = [intentMatch.reply, intentMatch.pluginSummary].filter(Boolean).join('\n\n');
            await whatsapp_service_1.openwaService.sendText(senderPhone, fullReply, { sessionId });
            logger_1.logger.info(`[WebhookHandler] Intent "${intentMatch.matchedIntent}" reply sent to ${senderPhone}`);
            return;
        }
    }
    catch (error) {
        logger_1.logger.warn(`[WebhookHandler] Intent service error: ${error?.message}`);
    }
    // -------------------------------------------------------------------
    // 5. Smart service (stateful multi-turn flows)
    // -------------------------------------------------------------------
    try {
        const businessPhone = business?.settings?.whatsappNumber || '';
        const smartReply = await whatsapp_smart_service_1.whatsAppSmartService.processMessage(senderPhone, businessPhone, messageBody);
        if (smartReply) {
            // smartReply.text was already sent by the smart service via sendWhatsAppMessage
            logger_1.logger.info(`[WebhookHandler] Smart flow "${smartReply.matchedIntent}" handled for ${senderPhone}`);
            return;
        }
    }
    catch (error) {
        logger_1.logger.warn(`[WebhookHandler] Smart service error: ${error?.message}`);
    }
    // -------------------------------------------------------------------
    // 6. Fallback: acknowledge receipt with a reaction
    // -------------------------------------------------------------------
    if (messageId) {
        try {
            await whatsapp_service_1.openwaService.sendReaction(messageId, '👋', { chatId: data.chatId, sessionId });
        }
        catch {
            // Reaction is optional; swallow errors
        }
    }
}
// ---------------------------------------------------------------------------
// Handler: Message ACK (delivery receipts)
// ---------------------------------------------------------------------------
async function handleMessageAck(payload) {
    const { data } = payload;
    const messageId = data.id || '';
    const ack = typeof data.ack === 'number' ? data.ack : -1;
    if (!messageId || ack < 0)
        return;
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
    logger_1.logger.debug(`[WebhookHandler] ACK ${ACK_LABELS[ack] || ack} for message ${messageId}`);
}
// ---------------------------------------------------------------------------
// Handler: Message failed
// ---------------------------------------------------------------------------
async function handleMessageFailed(payload) {
    const { data, sessionId } = payload;
    logger_1.logger.error(`[WebhookHandler] Message send failed on session ${sessionId}: ${JSON.stringify(data).substring(0, 200)}`);
}
// ---------------------------------------------------------------------------
// Handler: Session status
// ---------------------------------------------------------------------------
async function handleSessionStatus(payload) {
    const { data, sessionId } = payload;
    const status = data.status || 'unknown';
    logger_1.logger.info(`[WebhookHandler] Session ${sessionId} status changed: ${status}`);
}
// ---------------------------------------------------------------------------
// Handler: Session disconnected
// ---------------------------------------------------------------------------
async function handleSessionDisconnected(payload) {
    const { sessionId } = payload;
    logger_1.logger.warn(`[WebhookHandler] Session ${sessionId} disconnected`);
}
// ---------------------------------------------------------------------------
// Handler: Reactions
// ---------------------------------------------------------------------------
async function handleReaction(payload) {
    const { data, sessionId } = payload;
    logger_1.logger.info(`[WebhookHandler] Reaction on session ${sessionId}: ${JSON.stringify(data).substring(0, 100)}`);
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Extract a clean phone number from a WhatsApp JID or phone string.
 * e.g. "1234567890@c.us" → "1234567890"
 */
function extractPhone(jidOrPhone) {
    if (!jidOrPhone)
        return '';
    return jidOrPhone.replace(/@[a-z.]+$/, '').replace(/[^\d]/g, '');
}
/**
 * Public helper to check if a message was delivered/read.
 */
function getMessageAck(messageId) {
    return ackCache.get(messageId) || null;
}
//# sourceMappingURL=openwa.webhook-handler.service.js.map