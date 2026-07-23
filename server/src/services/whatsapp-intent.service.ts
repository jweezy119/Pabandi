import { selectPlugins, buildPluginSummary } from './openwa.plugins.service';

export interface IntentReply {
  reply: string;
  pluginSummary?: string;
  matchedIntent?: string;
}

const CANCEL_PATTERNS = [
  /\b(cancel|can't make it|cancel my booking|cancel reservation|need to cancel)\b/i,
];
const RESCHEDULE_PATTERNS = [
  /\b(reschedule|change date|move booking|new date|another day|shift my booking)\b/i,
];
const STATUS_PATTERNS = [
  /\b(status|my booking|my reservation|upcoming|when is my|details)\b/i,
];
const BOOK_PATTERNS = [
  /\b(book|reserve|appointment|table for|reservation for|want to book|I'd like to book)\b/i,
];
const HOURS_PATTERNS = [
  /\b(hours|open|close|timing|what time|closing|opening)\b/i,
];
const CHECKOUT_PATTERNS = [
  /\b(checkout|pay|deposit|payment|pay now|link to pay|how to pay)\b/i,
];
const MENU_PATTERNS = [
  /^(menu|help|start|options?|\?)$/i,
];
const FAQ_PATTERNS = [
  /\b(faq|faqs|questions|refund|cancel policy|deposit|no-show|parking|dietary|allergies)\b/i,
];

const DEFAULT_REPLIES: Record<string, string> = {
  cancel:
    "To cancel, reply *Cancel*.\nIf you have a deposit, it will be refunded automatically after cancellation.",
  reschedule:
    "To reschedule, please share your new preferred date and time, for example: *Reschedule to 24 Dec at 7pm*.",
  status:
    "You can view your booking details in the Pabandi app or website. If you want, I can message your latest status here.",
  book:
    "I can help with a booking. Please share:\n- Preferred date\n- Time\n- Number of guests\n- Occasion (optional)",
  hours:
    "Business hours vary by location. Please share the venue name and I can check the current schedule.",
  checkout:
    "You can pay safely via Pabandi escrow. Use the checkout link from your booking confirmation or share the booking ID.",
  faq:
    "Common questions: deposits, refunds, no-shows, parking, and dietary notes. Ask me any of these and I will help.",
};

export class WhatsAppIntentService {
  match(message: string, context?: { businessName?: string; keywords?: string[] }): IntentReply | null {
    const lower = message.trim();

    if (MENU_PATTERNS.some(re => re.test(lower))) {
      const summary = this.pluginSummaryFor(['menu', 'support', 'automation', 'booking'], context);
      return {
        reply: [
          'Pabandi self-service menu:',
          '1) Book appointment',
          '2) Cancel reservation',
          '3) Reschedule booking',
          '4) View my bookings',
          '5) Business hours',
          '6) Checkout / deposit',
          '7) FAQs',
          '',
          'Reply with the number or keyword.',
        ].join('\n'),
        pluginSummary: summary,
        matchedIntent: 'menu',
      };
    }

    if (CANCEL_PATTERNS.some(re => re.test(lower))) {
      return { reply: DEFAULT_REPLIES.cancel, matchedIntent: 'cancel' };
    }

    if (RESCHEDULE_PATTERNS.some(re => re.test(lower))) {
      return { reply: DEFAULT_REPLIES.reschedule, matchedIntent: 'reschedule' };
    }

    if (STATUS_PATTERNS.some(re => re.test(lower))) {
      return { reply: DEFAULT_REPLIES.status, matchedIntent: 'status' };
    }

    if (BOOK_PATTERNS.some(re => re.test(lower))) {
      const summary = this.pluginSummaryFor(['booking', 'reservation', 'automation', 'checkout'], context);
      return { reply: DEFAULT_REPLIES.book, pluginSummary: summary, matchedIntent: 'book' };
    }

    if (HOURS_PATTERNS.some(re => re.test(lower))) {
      const summary = this.pluginSummaryFor(['schedule', 'hours', 'business'], context);
      return { reply: DEFAULT_REPLIES.hours, pluginSummary: summary, matchedIntent: 'hours' };
    }

    if (CHECKOUT_PATTERNS.some(re => re.test(lower))) {
      const summary = this.pluginSummaryFor(['checkout', 'payment', 'deposit', 'webhook'], context);
      return { reply: DEFAULT_REPLIES.checkout, pluginSummary: summary, matchedIntent: 'checkout' };
    }

    if (FAQ_PATTERNS.some(re => re.test(lower))) {
      const summary = this.pluginSummaryFor(['faq', 'support', 'automation'], context);
      return { reply: DEFAULT_REPLIES.faq, pluginSummary: summary, matchedIntent: 'faq' };
    }

    return null;
  }

  private pluginSummaryFor(defaultKeywords: string[], context?: { businessName?: string; keywords?: string[] }) {
    const keywords = [...new Set([...(context?.keywords || []), ...defaultKeywords])];
    const contextRecord: Record<string, string> = {};
    if (context?.businessName) contextRecord.businessName = context.businessName;
    const matched = selectPlugins(keywords, contextRecord, 3);
    return buildPluginSummary(matched);
  }
}

export const whatsAppIntentService = new WhatsAppIntentService();
