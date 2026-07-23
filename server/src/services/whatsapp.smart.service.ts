import { selectPlugins, buildPluginSummary } from './openwa.plugins.service';
import { sendWhatsAppMessage } from './ai.service';

export interface SmartReply {
  text: string;
  matchedIntent?: string;
  pluginSummary?: string;
}

export interface SmartSession {
  phone: string;
  businessPhone: string;
  intent: string;
  step: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

export class WhatsAppSmartService {
  private sessions = new Map<string, SmartSession>();

  getSession(phone: string): SmartSession | undefined {
    return this.sessions.get(phone);
  }

  setSession(phone: string, session: SmartSession) {
    this.sessions.set(phone, session);
  }

  clearSession(phone: string) {
    this.sessions.delete(phone);
  }

  async reply(customerPhone: string, text: string, pluginSummary?: string) {
    const payload = [text, pluginSummary].filter(Boolean).join('\n\n');
    await sendWhatsAppMessage(customerPhone, payload);
    return payload;
  }

  async processMessage(customerPhone: string, businessPhone: string, message: string): Promise<SmartReply | null> {
    const lower = message.trim().toLowerCase();

    const session = this.getSession(customerPhone);
    if (!session || session.businessPhone !== businessPhone) {
      return this.handleNewConversation(customerPhone, businessPhone, lower, message);
    }

    if (['/menu', 'menu', 'help', 'start', 'options', 'main'].includes(lower)) {
      this.clearSession(customerPhone);
      return this.replyWithMenu(customerPhone);
    }

    return this.handleFlow(customerPhone, session, lower, message);
  }

  capabilities() {
    return {
      flows: ['menu', 'book', 'cancel', 'reschedule', 'update', 'status', 'pay', 'human', 'faq'],
      pluginAware: true,
      sessionMemory: true,
    };
  }

  private async replyWithMenu(customerPhone: string): Promise<SmartReply> {
    const summary = this.pluginSummary(['menu', 'support', 'automation', 'booking'], { businessName: '' });
    const text = [
      'Pabandi advanced self-service:',
      '1) Book appointment',
      '2) Cancel reservation',
      '3) Reschedule booking',
      '4) Update booking',
      '5) Booking status',
      '6) Pay / deposit',
      '7) Business hours',
      '8) FAQs',
      '9) Human help',
      '10) Exit to normal chat',
      '',
      'Reply with the number or keyword.',
    ].join('\n');

    const reply = await this.reply(customerPhone, text, summary);
    return { text: reply, matchedIntent: 'menu', pluginSummary: summary };
  }

  private async handleNewConversation(customerPhone: string, businessPhone: string, lower: string, raw: string): Promise<SmartReply | null> {
    const matchedIntent = this.matchIntent(lower);
    if (!matchedIntent) return null;

    const context = { businessName: '' };
    const summary = this.pluginSummary([matchedIntent, 'automation'], context);
    const replyText = matchedIntent === 'book'
      ? 'I can help with a booking. Please share preferred date, time, guests, and occasion.'
      : matchedIntent === 'cancel'
      ? 'To cancel, share the booking date or booking ID. Deposits are refunded when eligible.'
      : matchedIntent === 'reschedule'
      ? 'To reschedule, share your booking ID and new preferred date/time.'
      : matchedIntent === 'update'
      ? 'Send update request as: Time 18:30 or Guests 4.'
      : matchedIntent === 'status'
      ? 'Share booking ID or date/time and I will check status.'
      : matchedIntent === 'pay'
      ? 'Use checkout link from your confirmation, or share booking ID.'
      : matchedIntent === 'human'
      ? 'Handoff requested. Please share email and a 1-line note.'
      : matchedIntent === 'faq'
      ? 'Ask me about deposits, refunds, no-shows, parking, dietary notes.'
      : 'Opening advanced flow.';

    const session: SmartSession = {
      phone: customerPhone,
      businessPhone,
      intent: matchedIntent,
      step: 'awaiting_more',
      data: { raw, lower },
      updatedAt: Date.now(),
    };
    this.setSession(customerPhone, session);

    const reply = await this.reply(customerPhone, replyText, summary);
    return { text: reply, matchedIntent, pluginSummary: summary };
  }

  private async handleFlow(customerPhone: string, session: SmartSession, lower: string, raw: string): Promise<SmartReply | null> {
    if (session.intent === 'faq') {
      const summary = this.pluginSummary(['faq', 'support', 'automation']);
      const text = 'FAQ: deposits, refunds, no-shows, parking, dietary notes. Ask any specific question.';
      session.data = { ...session.data, raw };
      session.updatedAt = Date.now();
      this.setSession(customerPhone, session);
      const reply = await this.reply(customerPhone, text, summary);
      return { text: reply, matchedIntent: 'faq', pluginSummary: summary };
    }

    if (session.intent === 'human') {
      const summary = this.pluginSummary(['support', 'automation']);
      const text = 'Escalation saved. The team will follow up by email.';
      this.clearSession(customerPhone);
      const reply = await this.reply(customerPhone, text, summary);
      return { text: reply, matchedIntent: 'escalation', pluginSummary: summary };
    }

    const text = `Advanced flow for *${session.intent}* continues here. Current step: ${session.step}`;
    const summary = this.pluginSummary([session.intent, 'automation']);
    session.data = { ...session.data, raw };
    session.step = 'awaiting_more';
    session.updatedAt = Date.now();
    this.setSession(customerPhone, session);
    const reply = await this.reply(customerPhone, text, summary);
    return { text: reply, matchedIntent: session.intent, pluginSummary: summary };
  }

  private matchIntent(lower: string): string | null {
    if (/^(menu|help|start|options|\?|main)$/.test(lower)) return 'menu';
    if (/\b(book|reserve|appointment|table for|reservation for|want to book)\b/.test(lower)) return 'book';
    if (/\b(cancel|can't make it|cancel my booking|cancel reservation)\b/.test(lower)) return 'cancel';
    if (/\b(reschedule|change date|move booking|new date|another day|shift my booking)\b/.test(lower)) return 'reschedule';
    if (/\b(update|change time|change guests|time|guests)\b/.test(lower)) return 'update';
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
}

export const whatsAppSmartService = new WhatsAppSmartService();
