"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncomingWhatsApp = exports.verifyWebhook = void 0;
const ai_service_1 = require("../services/ai.service");
const whatsapp_smart_service_1 = require("../services/whatsapp.smart.service");
const whatsapp_conversation_service_1 = require("../services/whatsapp.conversation.service");
const database_1 = require("../utils/database");
const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || 'pabandi_wa_secret_2026';
/**
 * Webhook Verification for Meta WhatsApp API (GET request)
 */
const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[WhatsApp] Webhook verified successfully');
            res.status(200).send(challenge);
        }
        else {
            res.sendStatus(403);
        }
    }
    else {
        res.sendStatus(400);
    }
};
exports.verifyWebhook = verifyWebhook;
/**
 * Webhook to receive incoming messages from Meta WhatsApp API (POST request)
 */
const handleIncomingWhatsApp = async (req, res) => {
    try {
        const body = req.body;
        // Check if it's a WhatsApp status update or message
        if (body.object) {
            if (body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]) {
                const message = body.entry[0].changes[0].value.messages[0];
                const contacts = body.entry[0].changes[0].value.contacts;
                const metadata = body.entry[0].changes[0].value.metadata;
                // Meta formats phone number without '+' sign, e.g., "923001234567"
                let customerPhone = message.from;
                let businessPhone = metadata?.display_phone_number || '';
                // Ensure standard formatting if we stored it with '+' in DB
                if (!customerPhone.startsWith('+')) {
                    customerPhone = '+' + customerPhone;
                }
                if (businessPhone && !businessPhone.startsWith('+')) {
                    businessPhone = '+' + businessPhone;
                }
                const msgBody = message.text?.body;
                const profileName = contacts && contacts[0] ? contacts[0].profile.name : 'Unknown';
                if (!msgBody) {
                    // It might be a reaction, image, etc. We only handle text for now.
                    res.sendStatus(200);
                    return;
                }
                console.log(`[WhatsApp] Received message from ${customerPhone} to ${businessPhone} (${profileName}): ${msgBody}`);
                // Try to find the user in our database based on their phone number
                const user = await database_1.prisma.user.findFirst({
                    where: { phone: customerPhone }
                });
                // Smart booking first, fallback to existing AI flow so cancel/after-hours/faq still run.
                const matchedBusiness = await (0, ai_service_1.findBusinessByPublicPhone)(businessPhone);
                let smartReply = null;
                if (matchedBusiness) {
                    try {
                        smartReply = await whatsapp_smart_service_1.whatsAppSmartService.processMessage(customerPhone, businessPhone, msgBody);
                    }
                    catch (smartErr) {
                        console.error('[WhatsApp Smart]', smartErr);
                    }
                }
                const smartText = smartReply?.text || null;
                if (smartText) {
                    if (matchedBusiness) {
                        await (0, whatsapp_conversation_service_1.saveConversationSignal)(customerPhone, matchedBusiness.id, msgBody, smartText);
                    }
                }
                else {
                    (0, ai_service_1.processWhatsAppMessage)(customerPhone, businessPhone, msgBody, user).catch(error => {
                        console.error('[WhatsApp] Error processing message:', error);
                    });
                }
            }
            // Send 200 OK to acknowledge receipt
            res.sendStatus(200);
        }
        else {
            res.sendStatus(404);
        }
    }
    catch (error) {
        console.error('[WhatsApp] Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
exports.handleIncomingWhatsApp = handleIncomingWhatsApp;
//# sourceMappingURL=whatsapp.controller.js.map