"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsAppSmartService = exports.WhatsAppSmartService = void 0;
const openwa_plugins_service_1 = require("./openwa.plugins.service");
const ai_service_1 = require("./ai.service");
const hospitalityService_1 = require("./hospitalityService");
const ai_nlp_service_1 = require("./ai.nlp.service");
const openwa_template_service_1 = require("./openwa.template.service");
const whatsapp_conversation_service_1 = require("./whatsapp.conversation.service");
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
class WhatsAppSmartService {
    constructor() {
        this.sessions = new Map();
        this.conversations = new Map();
    }
    sessionKey(phone, businessPhone) {
        return `${phone}::${businessPhone}`;
    }
    evictExpiredSessions() {
        const now = Date.now();
        for (const [key, record] of this.sessions) {
            if (record.expiresAt < now) {
                this.sessions.delete(key);
            }
        }
    }
    touchSession(phone, businessPhone, session) {
        this.evictExpiredSessions();
        this.sessions.set(this.sessionKey(phone, businessPhone), {
            session,
            expiresAt: Date.now() + SESSION_TTL_MS,
        });
        return session;
    }
    getSession(phone, businessPhone) {
        this.evictExpiredSessions();
        const record = this.sessions.get(this.sessionKey(phone, businessPhone));
        return record?.session;
    }
    setSession(phone, businessPhone, session) {
        this.touchSession(phone, businessPhone, session);
    }
    clearSession(phone, businessPhone) {
        this.sessions.delete(this.sessionKey(phone, businessPhone));
    }
    getConversation(phone) {
        return this.conversations.get(phone) || [];
    }
    appendConversation(phone, from, text) {
        const history = this.conversations.get(phone) || [];
        history.push({ from, text, at: Date.now() });
        const trimmed = history.slice(-50);
        this.conversations.set(phone, trimmed);
        return trimmed;
    }
    async reply(customerPhone, text, pluginSummary, businessPhone = '') {
        this.appendConversation(customerPhone, 'agent', text);
        const payload = [text, pluginSummary].filter(Boolean).join('\n\n');
        let sessionId;
        if (businessPhone) {
            await (0, whatsapp_conversation_service_1.saveConversationSignal)(customerPhone, businessPhone, '', text);
            const business = await (0, ai_service_1.findBusinessByPublicPhone)(businessPhone);
            sessionId = business?.settings?.whatsappInstanceId || undefined;
        }
        await (0, ai_service_1.sendWhatsAppMessage)(customerPhone, payload, { sessionId });
        return payload;
    }
    async runSmartAction(intent, context) {
        const customerPhone = String(context?.customerPhone || 'unknown');
        const businessPhone = String(context?.businessPhone || '');
        const message = String(context?.message || intent);
        return this.processMessage(customerPhone, businessPhone, message);
    }
    async processMessage(customerPhone, businessPhone, message) {
        const lower = message.trim().toLowerCase();
        const session = this.getSession(customerPhone, businessPhone);
        if (lower === '/menu' || lower === 'menu' || lower === 'help' || lower === 'start' || lower === 'options' || lower === 'main') {
            this.clearSession(customerPhone, businessPhone);
            return this.replyWithMenu(customerPhone);
        }
        if (lower === '/human' || lower === 'agent' || lower === 'talk to someone') {
            const reply = await this.handleHandoff(customerPhone, businessPhone, session);
            return reply;
        }
        if (!session || session.businessPhone !== businessPhone) {
            return this.handleNewConversation(customerPhone, businessPhone, lower, message);
        }
        return this.handleBookingFlow(customerPhone, session, lower, message);
    }
    capabilities() {
        return {
            flows: ['menu', 'book', 'cancel', 'reschedule', 'update', 'status', 'pay', 'handoff', 'faq', 'assistant'],
            pluginAware: true,
            sessionMemory: true,
            conversationalBooking: true,
            scopedSessions: true,
            sessionTtlMs: SESSION_TTL_MS,
            persistSmartSignals: true,
        };
    }
    async replyWithMenu(customerPhone) {
        const summary = this.pluginSummary(['menu', 'support', 'automation', 'booking'], { businessName: '' });
        await openwa_template_service_1.openwaTemplateService.sendTemplate(customerPhone, 'interactive_menu', { businessName: 'Pabandi Business' });
        return { text: 'Sent interactive menu template', matchedIntent: 'menu', pluginSummary: summary };
    }
    async handleNewConversation(customerPhone, businessPhone, lower, raw) {
        let intent = this.matchIntent(lower);
        this.appendConversation(customerPhone, 'user', raw);
        if (!intent) {
            // Step 5: Route unmatched inbound messages to Qwen for AI-first intent routing
            const aiClassified = await ai_nlp_service_1.aiNlpService.classifyIntentAndLanguage(raw);
            if (aiClassified.intent === 'general' || aiClassified.intent === 'support' || aiClassified.confidence < 0.5) {
                // Use Qwen to generate a conversational, context-aware fallback response
                const fallbackText = await ai_nlp_service_1.aiNlpService.generateCopy('A customer sent an unclear message. Ask them how we can help with Escrow, payments, or bookings in a friendly, conversational way.', { customerMessage: raw });
                const reply = await this.reply(customerPhone, fallbackText, undefined, businessPhone);
                return { text: reply, matchedIntent: 'general', action: 'assist' };
            }
            // If AI matched an intent, use that instead
            const aiIntent = aiClassified.intent || 'general';
            return { text: '', matchedIntent: aiIntent, action: 'route_ai' };
        }
        if (intent !== 'book') {
            const text = this.introForIntent(intent);
            const pluginSummary = this.pluginSummary([intent, 'support', 'automation']);
            const reply = await this.reply(customerPhone, text, pluginSummary, businessPhone);
            return { text: reply, matchedIntent: intent, pluginSummary, action: intent };
        }
        const outOfHours = this.isOutOfHours();
        const summary = this.pluginSummary(['booking', 'outreach', 'automation']);
        const startText = outOfHours
            ? 'Outside business hours. I can take a booking request and create a checkout link for when we open.'
            : 'I can book that for you. Please share preferred date, time, guests, and occasion.';
        const session = {
            phone: customerPhone,
            businessPhone,
            intent: 'book',
            step: 'date',
            data: { raw, lower, outOfHours: outOfHours ? true : undefined },
            updatedAt: Date.now(),
        };
        this.touchSession(customerPhone, businessPhone, session);
        const reply = await this.reply(customerPhone, startText, summary, businessPhone);
        return { text: reply, matchedIntent: 'book', pluginSummary: summary, action: 'collect_details' };
    }
    async handleBookingFlow(customerPhone, session, lower, raw) {
        this.appendConversation(customerPhone, 'user', raw);
        if (session.intent === 'book')
            return this.advanceBookingFlow(customerPhone, session, lower, raw);
        if (session.intent === 'cancel')
            return this.handleCancelFlow(customerPhone, session, lower, raw);
        if (session.intent === 'status')
            return this.handleStatusFlow(customerPhone, session, lower, raw);
        const text = 'I noted that. If you want to change date/time/guests, send the new details now.';
        const reply = await this.reply(customerPhone, text, undefined, session.businessPhone);
        return { text: reply, matchedIntent: session.intent, action: 'continue' };
    }
    async advanceBookingFlow(customerPhone, session, _lower, raw) {
        if (!session.data.entities || typeof session.data.entities !== 'object') {
            const entities = await ai_nlp_service_1.aiNlpService.extractBookingEntities(raw);
            session.data.entities = entities;
            this.touchSession(customerPhone, session.businessPhone, session);
        }
        const entities = session.data.entities;
        if (!entities.date && session.step === 'date') {
            session.step = 'date';
            session.data.userText = raw;
            this.touchSession(customerPhone, session.businessPhone, session);
            const reply = await this.reply(customerPhone, 'Which date? Example: 2026-07-25', undefined, session.businessPhone);
            return { text: reply, matchedIntent: 'book', action: 'collect_date' };
        }
        if (!entities.time && session.step === 'date') {
            session.step = 'time';
            this.touchSession(customerPhone, session.businessPhone, session);
            const reply = await this.reply(customerPhone, 'Got it. What time? Example: 19:00', undefined, session.businessPhone);
            return { text: reply, matchedIntent: 'book', action: 'collect_time' };
        }
        if (!entities.partySize && session.step !== 'confirm') {
            session.step = 'partySize';
            this.touchSession(customerPhone, session.businessPhone, session);
            const reply = await this.reply(customerPhone, 'How many guests?', undefined, session.businessPhone);
            return { text: reply, matchedIntent: 'book', action: 'collect_party_size' };
        }
        const dateStr = String(entities.date || session.data.date || '');
        const timeStr = String(entities.time || session.data.time || '');
        const partySize = Number(entities.partySize || session.data.partySize || 2);
        if (!dateStr && !timeStr && !partySize) {
            session.step = 'date';
            this.touchSession(customerPhone, session.businessPhone, session);
            const reply = await this.reply(customerPhone, 'Please share a date, time, and number of guests.', undefined, session.businessPhone);
            return { text: reply, matchedIntent: 'book', action: 'collect_details' };
        }
        const businessId = String(session.data.businessId || session.businessPhone || '');
        if (!businessId) {
            session.step = 'source';
            this.touchSession(customerPhone, session.businessPhone, session);
            const reply = await this.reply(customerPhone, 'Which venue is this for? Share the venue name or branch.', undefined, session.businessPhone);
            return { text: reply, matchedIntent: 'book', action: 'collect_business' };
        }
        session.data.date = dateStr;
        session.data.time = timeStr;
        session.data.partySize = partySize;
        this.touchSession(customerPhone, session.businessPhone, session);
        let availability = { available: true, matchedTable: { name: 'Recommended table' }, slots: [] };
        if (dateStr) {
            availability = await hospitalityService_1.hospitalityService.checkAvailability(businessId, dateStr, Number.isFinite(partySize) ? partySize : 2);
        }
        session.data.availability = availability;
        if (!availability.available) {
            const suggestion = availability.slots?.[0] ? ` Nearest slot: ${availability.slots[0]}. Available?` : '';
            const reply = await this.reply(customerPhone, `That slot is unavailable.${suggestion} Or try another date/time.`, undefined, session.businessPhone);
            session.step = 'date';
            this.touchSession(customerPhone, session.businessPhone, session);
            return { text: reply, matchedIntent: 'book', action: 'offer_alternative' };
        }
        session.step = 'confirm';
        session.data.status = 'ready';
        this.touchSession(customerPhone, session.businessPhone, session);
        const bookingText = [
            `${timeStr ? 'Time: ' + timeStr : ''}`,
            `Guests: ${partySize}`,
            `Table: ${availability.matchedTable?.name || 'Recommended table'}`,
            '',
            'Reply "confirm" to secure with deposit, or send new details.',
        ].filter(Boolean).join('\n');
        const reply = await this.reply(customerPhone, bookingText, undefined, session.businessPhone);
        return { text: reply, matchedIntent: 'book', action: 'await_confirmation' };
    }
    async handleCancelFlow(customerPhone, session, _lower, _raw) {
        const reply = await this.reply(customerPhone, 'Cancellation noted. Share booking ID or date and I will process eligible refunds.', undefined, session.businessPhone);
        this.clearSession(customerPhone, session.businessPhone);
        return { text: reply, matchedIntent: 'cancel', action: 'cancel_intake' };
    }
    async handleStatusFlow(customerPhone, session, _lower, _raw) {
        const reply = await this.reply(customerPhone, 'Please share booking ID or date/time and I will check status and payment.', undefined, session.businessPhone);
        this.clearSession(customerPhone, session.businessPhone);
        return { text: reply, matchedIntent: 'status', action: 'status_intake' };
    }
    async handleHandoff(customerPhone, businessPhone, _session) {
        this.clearSession(customerPhone, businessPhone);
        const reply = await this.reply(customerPhone, 'Handoff requested. A team member will follow up shortly.', undefined, businessPhone);
        return { text: reply, matchedIntent: 'human', action: 'handoff' };
    }
    introForIntent(intent) {
        switch (intent) {
            case 'cancel':
                return 'To cancel, share the booking date or booking ID. Deposits are refunded when eligible.';
            case 'reschedule':
                return 'To reschedule, share your booking ID and new preferred date/time.';
            case 'status':
                return 'Share booking ID or date/time and I will check status.';
            case 'pay':
                return 'Use the checkout link from your confirmation, or share booking ID.';
            case 'human':
                return 'Handoff requested. Please share your email and a 1-line note.';
            case 'faq':
                return 'Ask about deposits, refunds, no-shows, parking, or dietary notes.';
            default:
                return 'Opening advanced flow.';
        }
    }
    matchIntent(lower) {
        if (/^(menu|help|start|options|\?|main)$/.test(lower))
            return 'menu';
        if (/\b(book|reserve|appointment|table for|reservation for|want to book|need a table)\b/.test(lower))
            return 'book';
        if (/\b(cancel|can't make it|cancel my booking|cancel reservation)\b/.test(lower))
            return 'cancel';
        if (/\b(reschedule|change date|move booking|new date|another day|shift)\b/.test(lower))
            return 'reschedule';
        if (/\b(status|my booking|my reservation|upcoming|when is my)\b/.test(lower))
            return 'status';
        if (/\b(checkout|pay|deposit|payment|pay now|link to pay|how to pay)\b/.test(lower))
            return 'pay';
        if (/\b(hours?|open|clos(e|ing)|timing|what time)\b/.test(lower))
            return 'hours';
        if (/\b(help|human|agent|talk to someone|escalate|operator)\b/.test(lower))
            return 'human';
        if (/\b(faq|faqs|questions|refund|cancel policy|deposit|no-show|parking|dietary|allergies)\b/.test(lower))
            return 'faq';
        return null;
    }
    pluginSummary(keywords, context) {
        try {
            const keywordSet = [...new Set(keywords)];
            const contextRecord = { businessName: context?.businessName || '' };
            const mapped = (0, openwa_plugins_service_1.selectPlugins)(keywordSet, contextRecord, 3);
            return (0, openwa_plugins_service_1.buildPluginSummary)(mapped) || '';
        }
        catch {
            return '';
        }
    }
    isOutOfHours() {
        const now = new Date();
        const hour = now.getUTCHours();
        return hour < 8 || hour >= 22;
    }
}
exports.WhatsAppSmartService = WhatsAppSmartService;
exports.whatsAppSmartService = new WhatsAppSmartService();
//# sourceMappingURL=whatsapp.smart.service.js.map