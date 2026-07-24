import { selectPlugins, buildPluginSummary } from './openwa.plugins.service';
import { sendWhatsAppMessage } from './ai.service';
import { hospitalityService } from './hospitalityService';
import { aiNlpService } from './ai.nlp.service';
import { saveConversationSignal } from './whatsapp.conversation.service';

export interface SmartReply {
  text: string;
  matchedIntent?: string;
  pluginSummary?: string;
  action?: string;
  traceId?: string;
}

export interface SmartSession {
  phone: string;
  businessPhone: string;
  intent: string;
  step: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

const BOOKING_FIELDS = ['date', 'time', 'partySize', 'occasion', 'contact'] as const;
type BookingField = typeof BOOKING_FIELDS[number];

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

export class WhatsAppSmartService {
  private sessions = new Map<string, { session: SmartSession; expiresAt: number }>();
  private conversations = new Map<string, Array<{ from: 'user' | 'agent'; text: string; at: number }>>();

  private sessionKey(phone: string, businessPhone: string) {
    return `${phone}::${businessPhone}`;
  }

  private evictExpiredSessions() {
    const now = Date.now();
    for (const [key, record] of this.sessions) {
      if (record.expiresAt < now) {
        this.sessions.delete(key);
      }
    }
  }

  private touchSession(phone: string, businessPhone: string, session: SmartSession) {
    this.evictExpiredSessions();
    this.sessions.set(this.sessionKey(phone, businessPhone), {
      session,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return session;
  }

  getSession(phone: string, businessPhone: string): SmartSession | undefined {
    this.evictExpiredSessions();
    const record = this.sessions.get(this.sessionKey(phone, businessPhone));
    return record?.session;
  }

  setSession(phone: string, businessPhone: string, session: SmartSession) {
    this.touchSession(phone, businessPhone, session);
  }

  clearSession(phone: string, businessPhone: string) {
    this.sessions.delete(this.sessionKey(phone, businessPhone));
  }

  getConversation(phone: string) {
    return this.conversations.get(phone) || [];
  }

  appendConversation(phone: string, from: 'user' | 'agent', text: string) {
    const history = this.conversations.get(phone) || [];
    history.push({ from, text, at: Date.now() });
    const trimmed = history.slice(-50);
    this.conversations.set(phone, trimmed);
    return trimmed;
  }

  async reply(customerPhone: string, text: string, pluginSummary?: string, businessPhone = '') {
    this.appendConversation(customerPhone, 'agent', text);
    const payload = [text, pluginSummary].filter(Boolean).join('\n\n');
    await sendWhatsAppMessage(customerPhone, payload);
    if (businessPhone) {
      await saveConversationSignal(customerPhone, businessPhone, '', text);
    }
    return payload;
  }

  async runSmartAction(intent: string, context?: { customerPhone?: string; businessPhone?: string; message?: string }) {
    const customerPhone = String(context?.customerPhone || 'unknown');
    const businessPhone = String(context?.businessPhone || '');
    const message = String(context?.message || intent);
    return this.processMessage(customerPhone, businessPhone, message);
  }

  async processMessage(customerPhone: string, businessPhone: string, message: string): Promise<SmartReply | null> {
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

  private async replyWithMenu(customerPhone: string): Promise<SmartReply> {
    const text = [
      'Pabandi AI receptionist:',
      '1) Book appointment',
      '2) Cancel reservation',
      '3) Reschedule booking',
      '4) Booking status',
      '5) Pay / deposit',
      '6) Ask anything',
      '7) Human help',
      '',
      'Reply 1-7 or a phrase like "table for 4 tonight".',
    ].join('\n');
    const reply = await this.reply(customerPhone, text);
    return { text: reply, matchedIntent: 'menu', action: 'menu' };
  }

  private async handleNewConversation(
    customerPhone: string,
    businessPhone: string,
    lower: string,
    raw: string
  ): Promise<SmartReply | null> {
    const intent = this.matchIntent(lower);
    this.appendConversation(customerPhone, 'user', raw);

    if (!intent) {
      const fallback = [
        'I can help with bookings, cancellations, status, or payments.',
        'Quick links:',
        '- Book: share date, time, guests',
        '- Cancel: share booking ID or date',
        '- Status: share date/time',
        '- Pay: share booking ID',
        '- Human: type "human"',
      ].join('\n');
      const reply = await this.reply(customerPhone, fallback, undefined, businessPhone);
      return { text: reply, matchedIntent: 'general', action: 'assist' };
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

    const session: SmartSession = {
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

  private async handleBookingFlow(
    customerPhone: string,
    session: SmartSession,
    lower: string,
    raw: string
  ): Promise<SmartReply> {
    this.appendConversation(customerPhone, 'user', raw);
    if (session.intent === 'book') return this.advanceBookingFlow(customerPhone, session, lower, raw);
    if (session.intent === 'cancel') return this.handleCancelFlow(customerPhone, session, lower, raw);
    if (session.intent === 'status') return this.handleStatusFlow(customerPhone, session, lower, raw);

    const text = 'I noted that. If you want to change date/time/guests, send the new details now.';
    const reply = await this.reply(customerPhone, text, undefined, session.businessPhone);
    return { text: reply, matchedIntent: session.intent, action: 'continue' };
  }

  private async advanceBookingFlow(
    customerPhone: string,
    session: SmartSession,
    lower: string,
    raw: string
  ): Promise<SmartReply> {
    if (!session.data.entities || typeof session.data.entities !== 'object') {
      const entities = await aiNlpService.extractBookingEntities(raw);
      session.data.entities = entities;
      this.touchSession(customerPhone, session.businessPhone, session);
    }

    const entities = session.data.entities as Record<string, any>;

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

    let availability: any = { available: true, matchedTable: { name: 'Recommended table' }, slots: [] };
    if (dateStr) {
      availability = await hospitalityService.checkAvailability(businessId, dateStr, Number.isFinite(partySize) ? partySize : 2);
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

  private async handleConfirmCheckout(customerPhone: string, session: SmartSession): Promise<SmartReply> {
    const summary = String(session.data.summary || `${session.data.date || ''} ${session.data.time || ''}`).trim();
    const customerPhoneVal = customerPhone.replace(/\D/g, '').slice(-10);

    try {
      const checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout`;

      const interactive = [
        'Your booking details:',
        `${summary}`,
        `Party: ${session.data.partySize || 2}`,
        ' ',
        'To secure this booking, pay the deposit with the payment link we send next.',
      ].join('\n\n');

      const reply = await this.reply(customerPhone, interactive, undefined, session.businessPhone);
      const linkText = `Secure your booking:\n${checkoutUrl}`;
      const linkReply = await this.reply(customerPhone, linkText, undefined, session.businessPhone);

      session.step = 'completed';
      this.touchSession(customerPhone, session.businessPhone, session);

      if (session.data.outOfHours) {
        session.data.willNotify = true;
        this.touchSession(customerPhone, session.businessPhone, session);
        const nudge = 'Because this was outside business hours, our team will confirm manually when we open.';
        const nudgeReply = await this.reply(customerPhone, nudge, undefined, session.businessPhone);
        return { text: [reply, linkReply, nudgeReply].join('\n\n'), matchedIntent: 'book', action: 'escrow_created' };
      }

      return { text: [reply, linkReply].join('\n\n'), matchedIntent: 'book', action: 'escrow_created' };
    } catch (error: any) {
      const errText = `Booking request saved. Our team will confirm shortly.\nError: ${error?.message || 'checkout unavailable'}`;
      const reply = await this.reply(customerPhone, errText, undefined, session.businessPhone);
      session.step = 'awaiting_human';
      this.touchSession(customerPhone, session.businessPhone, session);
      return { text: reply, matchedIntent: 'book', action: 'human_required' };
    }
  }

  private async handleCancelFlow(customerPhone: string, session: SmartSession, lower: string, raw: string): Promise<SmartReply> {
    const reply = await this.reply(customerPhone, 'Cancellation noted. Share booking ID or date and I will process eligible refunds.', undefined, session.businessPhone);
    this.clearSession(customerPhone, session.businessPhone);
    return { text: reply, matchedIntent: 'cancel', action: 'cancel_intake' };
  }

  private async handleStatusFlow(customerPhone: string, session: SmartSession, lower: string, raw: string): Promise<SmartReply> {
    const reply = await this.reply(customerPhone, 'Please share booking ID or date/time and I will check status and payment.', undefined, session.businessPhone);
    this.clearSession(customerPhone, session.businessPhone);
    return { text: reply, matchedIntent: 'status', action: 'status_intake' };
  }

  private async handleHandoff(customerPhone: string, businessPhone: string, session: SmartSession | undefined): Promise<SmartReply> {
    this.clearSession(customerPhone, businessPhone);
    const reply = await this.reply(customerPhone, 'Handoff requested. A team member will follow up shortly.', undefined, businessPhone);
    return { text: reply, matchedIntent: 'human', action: 'handoff' };
  }

  private introForIntent(intent: string): string {
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

  private matchIntent(lower: string): string | null {
    if (/^(menu|help|start|options|\?|main)$/.test(lower)) return 'menu';
    if (/\b(book|reserve|appointment|table for|reservation for|want to book|need a table)\b/.test(lower)) return 'book';
    if (/\b(cancel|can't make it|cancel my booking|cancel reservation)\b/.test(lower)) return 'cancel';
    if (/\b(reschedule|change date|move booking|new date|another day|shift)\b/.test(lower)) return 'reschedule';
    if (/\b(status|my booking|my reservation|upcoming|when is my)\b/.test(lower)) return 'status';
    if (/\b(checkout|pay|deposit|payment|pay now|link to pay|how to pay)\b/.test(lower)) return 'pay';
    if (/\b(hours?|open|clos(e|ing)|timing|what time)\b/.test(lower)) return 'hours';
    if (/\b(help|human|agent|talk to someone|escalate|operator)\b/.test(lower)) return 'human';
    if (/\b(faq|faqs|questions|refund|cancel policy|deposit|no-show|parking|dietary|allergies)\b/.test(lower)) return 'faq';
    return null;
  }

  private pluginSummary(keywords: string[], context?: { businessName?: string }) {
    try {
      const keywordSet = [...new Set(keywords)];
      const contextRecord = { businessName: context?.businessName || '' };
      const mapped = selectPlugins(keywordSet, contextRecord, 3);
      return buildPluginSummary(mapped) || '';
    } catch {
      return '';
    }
  }

  private isOutOfHours(): boolean {
    const now = new Date();
    const hour = now.getUTCHours();
    return hour < 8 || hour >= 22;
  }
}

export const whatsAppSmartService = new WhatsAppSmartService();
