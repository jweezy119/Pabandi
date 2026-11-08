import { selectPlugins, buildPluginSummary } from './openwa.plugins.service';
import { sendWhatsAppMessage, findBusinessByPublicPhone } from './ai.service';
import { hospitalityService } from './hospitalityService';
import { aiNlpService } from './ai.nlp.service';
import { openwaTemplateService } from './openwa.template.service';
import { saveConversationSignal } from './whatsapp.conversation.service';
import { prisma } from '../utils/database';

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
    
    let sessionId: string | undefined;
    if (businessPhone) {
      await saveConversationSignal(customerPhone, businessPhone, '', text);
      const business = await findBusinessByPublicPhone(businessPhone);
      sessionId = business?.settings?.whatsappInstanceId || undefined;
    }
    
    await sendWhatsAppMessage(customerPhone, payload, { sessionId });
    return payload;
  }

  async runSmartAction(intent: string, context?: { customerPhone?: string; businessPhone?: string; message?: string }) {
    const customerPhone = String(context?.customerPhone || 'unknown');
    const businessPhone = String(context?.businessPhone || '');
    const message = String(context?.message || intent);
    return this.processMessage(customerPhone, businessPhone, message);
  }

  async processMessage(
    customerPhone: string,
    businessPhone: string,
    message: string
  ): Promise<SmartReply | null> {
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
    const summary = this.pluginSummary(['menu', 'support', 'automation', 'booking'], { businessName: '' });
    await openwaTemplateService.sendTemplate(customerPhone, 'interactive_menu', { businessName: 'Pabandi Business' });

    return { text: 'Sent interactive menu template', matchedIntent: 'menu', pluginSummary: summary };
  }

  private async handleNewConversation(
    customerPhone: string,
    businessPhone: string,
    lower: string,
    raw: string
  ): Promise<SmartReply | null> {
    let intent = this.matchIntent(lower);
    this.appendConversation(customerPhone, 'user', raw);

    if (!intent) {
      // Step 5: Route unmatched inbound messages to Qwen for AI-first intent routing
      const aiClassified = await aiNlpService.classifyIntentAndLanguage(raw);
      
      if (aiClassified.intent === 'general' || aiClassified.intent === 'support' || aiClassified.confidence < 0.5) {
        // Use Qwen to generate a conversational, context-aware fallback response
        const fallbackText = await aiNlpService.generateCopy(
          'A customer sent an unclear message. Ask them how we can help with Escrow, payments, or bookings in a friendly, conversational way.', 
          { customerMessage: raw }
        );
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
    _lower: string,
    raw: string
  ): Promise<SmartReply> {
    const lower = _lower.toLowerCase().trim();

    // ── Handle Change Time / Reschedule Button ──
    if (session.step === 'confirm' && (lower === 'btn_reschedule' || lower.includes('change') || lower.includes('reschedule') || lower.includes('other time'))) {
      session.step = 'date';
      session.data.date = undefined;
      session.data.time = undefined;
      this.touchSession(customerPhone, session.businessPhone, session);
      const reply = await this.reply(
        customerPhone,
        'No problem! What date and time would work best for you? (e.g., Tomorrow at 4:00 PM)',
        undefined,
        session.businessPhone
      );
      return { text: reply, matchedIntent: 'book', action: 'reschedule_prompt' };
    }

    // ── Handle Human Handoff Button ──
    if (lower === 'btn_human' || lower.includes('talk to staff') || lower.includes('talk to receptionist') || lower.includes('human')) {
      this.clearSession(customerPhone, session.businessPhone);
      const reply = await this.reply(
        customerPhone,
        '👤 I have notified the receptionist. A team member will step in and message you directly right here shortly.',
        undefined,
        session.businessPhone
      );
      return { text: reply, matchedIntent: 'support', action: 'human_handoff' };
    }

    // ── Handle Confirmation Step: Secure booking with dynamic commitment deposit ──
    if (session.step === 'confirm' && (lower === 'btn_confirm' || lower === 'confirm' || lower.includes('confirm') || lower.includes('yes') || lower.includes('ok') || lower.includes('book') || lower.includes('pay'))) {
      const businessId = String(session.data.businessId || '');
      const business = businessId ? await prisma.business.findFirst({
        where: { OR: [{ id: businessId }, { phone: session.businessPhone }] }
      }) : await prisma.business.findFirst({ where: { phone: session.businessPhone } });

      const businessName = business?.name || 'the venue';
      const depositVal = business?.depositAmount || 15;
      const depositCurrency = business?.currency || 'USD';

      // Resolve a valid customer User record for foreign-key integrity in Prisma
      let customerUser = await prisma.user.findFirst({ where: { phone: customerPhone } });
      if (!customerUser) {
        const guestEmail = `guest_${customerPhone.replace(/[^\d]/g, '') || Date.now()}@pabandi.guest`;
        customerUser = await prisma.user.create({
          data: {
            email: guestEmail,
            phone: customerPhone,
            firstName: 'WhatsApp',
            lastName: 'Guest',
            passwordHash: 'whatsapp_guest_unauthenticated',
            role: 'CUSTOMER',
            isPhoneVerified: true,
          }
        }).catch(async () => {
          return prisma.user.findFirst();
        });
      }

      const resDate = session.data.date ? new Date(String(session.data.date)) : new Date();
      const resTime = String(session.data.time || '12:00');
      const guests = Number(session.data.partySize || 1);

      if (business?.requireDeposit || depositVal > 0) {
        // Create PENDING reservation awaiting deposit lock
        let pendingRes: any = null;
        if (business && customerUser) {
          pendingRes = await prisma.reservation.create({
            data: {
              businessId: business.id,
              customerId: customerUser.id,
              reservationDate: isNaN(resDate.getTime()) ? new Date() : resDate,
              reservationTime: resTime,
              numberOfGuests: guests,
              customerName: customerUser.firstName ? `${customerUser.firstName} ${customerUser.lastName || ''}`.trim() : 'Guest',
              customerPhone,
              customerEmail: customerUser.email,
              status: 'PENDING',
              depositRequired: true,
              depositAmount: depositVal,
              depositPaid: false,
              depositStatus: 'REQUIRED',
            }
          }).catch((err) => {
            console.warn('[WhatsApp Booking] Reservation create warning:', err.message);
            return null;
          });
        }

        const checkoutUrl = `${process.env.CLIENT_URL || 'https://pabandi.com'}/book/${business?.id || businessId || 'default'}?res=${pendingRes?.id || ''}&ref=wa_${Date.now().toString(36)}`;
        session.step = 'awaiting_deposit';
        session.data.checkoutUrl = checkoutUrl;
        session.data.reservationId = pendingRes?.id;
        this.touchSession(customerPhone, session.businessPhone, session);

        await openwaTemplateService.sendTemplate(customerPhone, 'deposit_commitment_request', {
          customerName: customerUser?.firstName || 'Valued Guest',
          businessName,
          reservationDate: String(session.data.date || 'Today'),
          reservationTime: resTime,
          depositAmount: `${depositCurrency} ${depositVal}`,
          checkoutUrl,
        });

        const reply = await this.reply(
          customerPhone,
          `To lock in your booking at ${businessName}, please complete your refundable commitment deposit of ${depositCurrency} ${depositVal}: ${checkoutUrl}`,
          undefined,
          session.businessPhone
        );
        return {
          text: reply,
          matchedIntent: 'book',
          action: 'awaiting_deposit',
        };
      } else {
        // Zero-deposit booking (auto-confirmed)
        if (business && customerUser) {
          await prisma.reservation.create({
            data: {
              businessId: business.id,
              customerId: customerUser.id,
              reservationDate: isNaN(resDate.getTime()) ? new Date() : resDate,
              reservationTime: resTime,
              numberOfGuests: guests,
              customerName: customerUser.firstName ? `${customerUser.firstName} ${customerUser.lastName || ''}`.trim() : 'Guest',
              customerPhone,
              customerEmail: customerUser.email,
              status: 'CONFIRMED',
              depositRequired: false,
              depositPaid: true,
              depositStatus: 'NOT_REQUIRED',
            }
          }).catch((err) => {
            console.warn('[WhatsApp Booking] Reservation create warning:', err.message);
          });
        }

        session.step = 'completed';
        this.clearSession(customerPhone, session.businessPhone);
        await openwaTemplateService.sendTemplate(customerPhone, 'booking_confirmation', {
          customerName: customerUser?.firstName || 'Valued Guest',
          businessName,
          reservationDate: String(session.data.date || 'Today'),
          reservationTime: resTime,
          guestCount: String(guests),
        });
        const reply = await this.reply(
          customerPhone,
          `✅ Booking confirmed at ${businessName} for ${session.data.date} at ${session.data.time}! We look forward to seeing you.`,
          undefined,
          session.businessPhone
        );
        return {
          text: reply,
          matchedIntent: 'book',
          action: 'confirmed',
        };
      }
    }

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
      `📅 *Appointment Summary*`,
      `${timeStr ? 'Time: ' + timeStr : ''}`,
      `Guests / Party: ${partySize}`,
      `Service / Spot: ${availability.matchedTable?.name || 'Standard Slot'}`,
      '',
      'Please select an option below:',
    ].filter(Boolean).join('\n');

    // Strategy 2: Dispatch interactive quick-reply buttons
    try {
      const { openwaService } = await import('./openwa.service');
      await openwaService.sendButtons(customerPhone, bookingText, [
        { id: 'btn_confirm', text: '✅ Confirm & Lock Slot' },
        { id: 'btn_reschedule', text: '🔄 Change Time' },
        { id: 'btn_human', text: '👤 Talk to Staff' },
      ], {
        title: 'Pabandi Smart Booking',
        footer: 'Tap a button to proceed',
      });
      return { text: bookingText, matchedIntent: 'book', action: 'await_confirmation_buttons' };
    } catch {
      const fallbackReply = await this.reply(customerPhone, `${bookingText}\n\nReply "confirm" to secure with deposit, or send new details.`, undefined, session.businessPhone);
      return { text: fallbackReply, matchedIntent: 'book', action: 'await_confirmation' };
    }
  }

  private async handleCancelFlow(customerPhone: string, session: SmartSession, _lower: string, _raw: string): Promise<SmartReply> {
    const reply = await this.reply(customerPhone, 'Cancellation noted. Share booking ID or date and I will process eligible refunds.', undefined, session.businessPhone);
    this.clearSession(customerPhone, session.businessPhone);
    return { text: reply, matchedIntent: 'cancel', action: 'cancel_intake' };
  }

  private async handleStatusFlow(customerPhone: string, session: SmartSession, _lower: string, _raw: string): Promise<SmartReply> {
    const reply = await this.reply(customerPhone, 'Please share booking ID or date/time and I will check status and payment.', undefined, session.businessPhone);
    this.clearSession(customerPhone, session.businessPhone);
    return { text: reply, matchedIntent: 'status', action: 'status_intake' };
  }

  private async handleHandoff(customerPhone: string, businessPhone: string, _session: SmartSession | undefined): Promise<SmartReply> {
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
