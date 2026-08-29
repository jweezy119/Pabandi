"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWhatsAppMessage = exports.findBusinessByPublicPhone = exports.sendWhatsAppMessage = exports.openwaMcpClient = void 0;
const database_1 = require("../utils/database");
const cryptoService_1 = require("./cryptoService");
const openwa_after_hours_service_1 = require("./openwa.after-hours.service");
const openwa_faq_bot_service_1 = require("./openwa.faq-bot.service");
const openwa_mcp_client_service_1 = require("./openwa.mcp-client.service");
exports.openwaMcpClient = (0, openwa_mcp_client_service_1.createOpenWAMCPClient)(process.env.OPENWA_SESSION_ID || 'pabandi');
const whatsapp_service_1 = require("./whatsapp.service");
const sendWhatsAppMessage = async (toPhone, message, options) => {
    if (!process.env.OPENWA_API_KEY && !process.env.EVOLUTION_API_KEY) {
        console.warn(`[WhatsApp MOCK] To: ${toPhone} | Message: ${message}`);
        return;
    }
    try {
        const formattedPhone = toPhone.replace('+', '').replace(/\D/g, '') + '@c.us';
        // Simulate typing before sending AI message (AI-Smart feature)
        if (whatsapp_service_1.openwaService.sendPresence) {
            await whatsapp_service_1.openwaService.sendPresence(formattedPhone, 'composing', options).catch(() => { });
            // Dynamically wait based on message length (simulating human typing speed)
            const delayMs = Math.min(3000, Math.max(800, message.length * 20));
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        const result = await whatsapp_service_1.openwaService.sendText(formattedPhone, message, options);
        console.log(`[WhatsApp] Sent message via Provider to ${toPhone} (ID: ${result.messageId}, Session: ${options?.sessionId || 'default'})`);
        return result.messageId;
    }
    catch (error) {
        console.error(`[WhatsApp] Error sending message to ${toPhone} via Provider:`, error.response?.data || error.message);
        return null;
    }
};
exports.sendWhatsAppMessage = sendWhatsAppMessage;
const findBusinessByPublicPhone = async (phoneNumber) => {
    const clean = String(phoneNumber).replace(/[^\d]/g, '');
    if (!clean)
        return null;
    return database_1.prisma.business.findFirst({
        where: { phone: { contains: clean } },
        include: { settings: true },
    });
};
exports.findBusinessByPublicPhone = findBusinessByPublicPhone;
const ai_nlp_service_1 = require("./ai.nlp.service");
const openwa_drop_bot_service_1 = require("./openwa.drop-bot.service");
const processWhatsAppMessage = async (customerPhone, businessPhone, message, user) => {
    console.log(`[AI] Processing message from ${customerPhone} to ${businessPhone}: ${message}`);
    const lowerMsg = message.trim().toLowerCase();
    if (openwa_drop_bot_service_1.openwaDropBotService.isDropEngineCommand(message)) {
        try {
            const business = await (0, exports.findBusinessByPublicPhone)(businessPhone);
            if (business) {
                const reply = await openwa_drop_bot_service_1.openwaDropBotService.handleDropEngineCommand(business.id, customerPhone, message);
                await (0, exports.sendWhatsAppMessage)(customerPhone, reply);
                return;
            }
        }
        catch (e) {
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
        const business = await (0, exports.findBusinessByPublicPhone)(businessPhone);
        let businessSlug = 'unknown';
        let businessName = 'Pabandi Merchant';
        if (business) {
            businessSlug = business.slug || business.id;
            businessName = business.name;
            const rawSettings = business?.settings;
            const settings = rawSettings && typeof rawSettings === 'object'
                ? { afterHoursJson: rawSettings.afterHoursJson || null }
                : { afterHoursJson: null };
            const afterHours = openwa_after_hours_service_1.openwaAfterHoursService.isAfterHoursNow({
                id: business.id,
                timezone: business.timezone,
                settings,
            });
            if (afterHours) {
                const away = openwa_after_hours_service_1.openwaAfterHoursService.getAwayMessage(business);
                await (0, exports.sendWhatsAppMessage)(customerPhone, away);
                return;
            }
            const faqReply = openwa_faq_bot_service_1.openwaFaqBotService.evaluateMessage(message, Array.isArray(rawSettings?.faqRules) ? rawSettings.faqRules : undefined);
            if (faqReply) {
                await (0, exports.sendWhatsAppMessage)(customerPhone, faqReply);
                return;
            }
        }
        const classification = await ai_nlp_service_1.aiNlpService.classifyIntentAndLanguage(message);
        console.log(`[AI NLP] Classification result:`, classification);
        if (classification.intent === 'book_table' || classification.intent === 'booking' || classification.intent === 'sales') {
            const template = "Great! Let's lock in your reservation. Please securely deposit $5 into the Web3 Escrow to confirm: https://pabandi.com/s/{{businessSlug}}?mode=instant";
            const response = await ai_nlp_service_1.aiNlpService.generateCopy(template, { businessSlug });
            await (0, exports.sendWhatsAppMessage)(customerPhone, response);
            return;
        }
        else if (classification.intent === 'cancellation') {
            if (user) {
                await handleWhatsAppCancellation(customerPhone, user);
            }
            else {
                await (0, exports.sendWhatsAppMessage)(customerPhone, 'To cancel, share your booking ID or phone number used while booking.');
            }
            return;
        }
        else if (classification.intent === 'check_menu') {
            const template = "Here is our digital menu: https://pabandi.com/menu/{{businessSlug}}. Let me know if you want to place an order!";
            const response = await ai_nlp_service_1.aiNlpService.generateCopy(template, { businessSlug });
            await (0, exports.sendWhatsAppMessage)(customerPhone, response);
            return;
        }
        else if (classification.intent === 'ask_question' || classification.intent === 'support') {
            const template = "I'm the AI assistant for {{businessName}}. I can help with deposits, refunds, menus, timings, or human handoff. What do you need?";
            const response = await ai_nlp_service_1.aiNlpService.generateCopy(template, { businessName });
            await (0, exports.sendWhatsAppMessage)(customerPhone, response);
            return;
        }
        else {
            const template = "I'm the AI assistant for {{businessName}}. I can help you book a table, check our catalog, or answer general questions. How can I help you today?";
            const response = await ai_nlp_service_1.aiNlpService.generateCopy(template, { businessName });
            await (0, exports.sendWhatsAppMessage)(customerPhone, response);
            return;
        }
        const fallback = `I'm the AI assistant for *{{businessName}}*.\n\nYou can:\n- *Book* a table\n- *Cancel* or *Reschedule*\n- *Check Status*\n- Ask a question\n\nPlease share details like date, time, and guests!`;
        const fallbackResponse = await ai_nlp_service_1.aiNlpService.generateCopy(fallback, { businessName, businessSlug });
        await (0, exports.sendWhatsAppMessage)(customerPhone, fallbackResponse);
    }
    catch (pluginErr) {
        console.error('[Plugin] Pre-AI plugin handling failed:', pluginErr);
    }
};
exports.processWhatsAppMessage = processWhatsAppMessage;
async function handleWhatsAppCancellation(phoneNumber, user) {
    try {
        const reservation = await database_1.prisma.reservation.findFirst({
            where: {
                customerId: user.id,
                status: { in: ['PENDING', 'CONFIRMED'] },
            },
            include: { business: true },
            orderBy: { createdAt: 'desc' },
        });
        if (!reservation) {
            await (0, exports.sendWhatsAppMessage)(phoneNumber, "You don't have any upcoming reservations to cancel right now.");
            return;
        }
        await database_1.prisma.reservation.update({
            where: { id: reservation.id },
            data: { status: 'CANCELLED' },
        });
        if (reservation.depositPaid) {
            if (reservation.cryptoDepositTxHash && !reservation.cryptoDepositTxHash.startsWith('pending_')) {
                try {
                    await cryptoService_1.cryptoService.refundEscrowToCustomer(reservation.id);
                }
                catch (e) {
                    console.error('[WhatsApp Cancel] Failed to trigger crypto refund', e);
                }
            }
            else {
                const payment = await database_1.prisma.payment.findFirst({
                    where: { reservationId: reservation.id, status: 'COMPLETED' },
                });
                if (payment) {
                    await database_1.prisma.payment.update({
                        where: { id: payment.id },
                        data: { status: 'REFUNDED' },
                    });
                }
            }
            await database_1.prisma.reservation.update({
                where: { id: reservation.id },
                data: { depositPaid: false },
            });
            await (0, exports.sendWhatsAppMessage)(phoneNumber, `Your reservation at ${reservation.business.name} on ${reservation.reservationDate} has been cancelled.`);
            return;
        }
        await (0, exports.sendWhatsAppMessage)(phoneNumber, `Your reservation at ${reservation.business.name} on ${reservation.reservationDate} has been cancelled.`);
    }
    catch (error) {
        console.error('[WhatsApp Cancel Error]:', error);
        await (0, exports.sendWhatsAppMessage)(phoneNumber, 'Sorry, we encountered an error while trying to cancel your reservation. Please try again or use the app.');
    }
}
//# sourceMappingURL=ai.service.js.map