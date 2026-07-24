import { openwaService, OpenWAMessageSendResult } from './openwa.service';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  key: string;
  label: string;
  required: boolean;
  example?: string;
}

export interface PabandiTemplate {
  name: string;
  category: 'booking' | 'reminder' | 'notification' | 'marketing' | 'support';
  body: string;
  variables: TemplateVariable[];
  footer?: string;
}

/**
 * Pre-built templates for common Pabandi messaging scenarios.
 * Variables use {{variableName}} syntax, resolved at send time.
 */
const TEMPLATES: Record<string, PabandiTemplate> = {
  booking_confirmation: {
    name: 'booking_confirmation',
    category: 'booking',
    body: [
      '✅ *Booking Confirmed!*',
      '',
      'Hi {{customerName}}, your reservation is confirmed:',
      '',
      '🏢 *{{businessName}}*',
      '📅 {{reservationDate}}',
      '🕐 {{reservationTime}}',
      '👥 {{guestCount}} guests',
      '',
      'Need to change anything? Type *reschedule* or *cancel*.',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true, example: 'Ahmed' },
      { key: 'businessName', label: 'Business Name', required: true, example: 'Karachi Kitchen' },
      { key: 'reservationDate', label: 'Date', required: true, example: 'July 25, 2026' },
      { key: 'reservationTime', label: 'Time', required: true, example: '7:30 PM' },
      { key: 'guestCount', label: 'Guest Count', required: false, example: '4' },
    ],
    footer: 'Powered by Pabandi',
  },

  booking_reminder: {
    name: 'booking_reminder',
    category: 'reminder',
    body: [
      '⏰ *Reminder: Your reservation is coming up!*',
      '',
      'Hi {{customerName}}, just a friendly reminder:',
      '',
      '🏢 *{{businessName}}*',
      '📅 {{reservationDate}} at {{reservationTime}}',
      '',
      'Can\'t make it? Type *cancel* or *reschedule*.',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'reservationDate', label: 'Date', required: true },
      { key: 'reservationTime', label: 'Time', required: true },
    ],
  },

  new_booking_alert: {
    name: 'new_booking_alert',
    category: 'notification',
    body: [
      '🔔 *New Booking Alert*',
      '',
      'You have a new reservation at *{{businessName}}*!',
      '',
      '👤 {{customerName}}',
      '📅 {{reservationDate}} at {{reservationTime}}',
      '👥 {{guestCount}} guests',
      '📞 {{customerPhone}}',
      '',
      '👉 View & Manage: {{dashboardUrl}}',
    ].join('\n'),
    variables: [
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'reservationDate', label: 'Date', required: true },
      { key: 'reservationTime', label: 'Time', required: true },
      { key: 'guestCount', label: 'Guest Count', required: true },
      { key: 'customerPhone', label: 'Customer Phone', required: true },
      { key: 'dashboardUrl', label: 'Dashboard URL', required: false },
    ],
  },

  review_request: {
    name: 'review_request',
    category: 'marketing',
    body: [
      'Hi {{customerName}}! 🙏',
      '',
      'Thank you for visiting *{{businessName}}*. We hope you had a great experience!',
      '',
      'Would you mind leaving a quick review? Your feedback helps us improve!',
      '',
      '⭐ Rate your experience: {{reviewUrl}}',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'reviewUrl', label: 'Review URL', required: false },
    ],
  },

  deposit_receipt: {
    name: 'deposit_receipt',
    category: 'booking',
    body: [
      '💰 *Deposit Received*',
      '',
      'Hi {{customerName}}, your deposit of *{{amount}}* for your reservation at *{{businessName}}* has been received and is held in Pabandi escrow.',
      '',
      '📅 {{reservationDate}} at {{reservationTime}}',
      '',
      'Your deposit will be automatically applied to your bill or refunded if you cancel within the allowed window.',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'amount', label: 'Amount', required: true, example: '$25.00' },
      { key: 'reservationDate', label: 'Date', required: true },
      { key: 'reservationTime', label: 'Time', required: true },
    ],
  },

  cancellation_confirmed: {
    name: 'cancellation_confirmed',
    category: 'booking',
    body: [
      '❌ *Reservation Cancelled*',
      '',
      'Hi {{customerName}}, your reservation at *{{businessName}}* on {{reservationDate}} has been cancelled.',
      '',
      '{{refundNote}}',
      '',
      'We hope to see you again soon! Type *book* to make a new reservation.',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'reservationDate', label: 'Date', required: true },
      { key: 'refundNote', label: 'Refund Note', required: false, example: 'Your deposit of $25 will be refunded within 3-5 business days.' },
    ],
  },

  outreach_claim: {
    name: 'outreach_claim',
    category: 'marketing',
    body: [
      'Hi! 👋',
      '',
      'We noticed *{{businessName}}* doesn\'t have a Pabandi profile yet.',
      '',
      'Pabandi helps businesses like yours:',
      '• Accept bookings via WhatsApp',
      '• Secure deposits with escrow',
      '• Build customer trust scores',
      '• Automate reminders & follow-ups',
      '',
      '🚀 Claim your free profile: {{claimUrl}}',
    ].join('\n'),
    variables: [
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'claimUrl', label: 'Claim URL', required: true },
    ],
  },

  live_selling_product: {
    name: 'live_selling_product',
    category: 'marketing',
    body: [
      '🔴 *LIVE NOW* — {{businessName}}',
      '',
      '{{productName}}',
      '💰 *{{price}}*',
      '',
      '{{productDescription}}',
      '',
      'Reply *BUY {{productId}}* to order!',
    ].join('\n'),
    variables: [
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'productName', label: 'Product Name', required: true },
      { key: 'price', label: 'Price', required: true },
      { key: 'productDescription', label: 'Description', required: false },
      { key: 'productId', label: 'Product ID', required: true },
    ],
  },
  
  product_checkout: {
    name: 'product_checkout',
    category: 'booking',
    body: [
      '🛒 *Checkout Ready*',
      '',
      'You are about to purchase *{{productName}}* from *{{businessName}}*.',
      '',
      'Total: *{{price}}*',
      '',
      'To secure this item instantly via Web3 Escrow, please click the link below:',
      '{{checkoutUrl}}',
      '',
      'Or reply *cancel* to abort.'
    ].join('\n'),
    variables: [
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'productName', label: 'Product Name', required: true },
      { key: 'price', label: 'Price', required: true },
      { key: 'checkoutUrl', label: 'Checkout URL', required: true },
    ],
  },
  
  interactive_menu: {
    name: 'interactive_menu',
    category: 'support',
    body: [
      'Welcome to *{{businessName}}*!',
      '',
      'How can we help you today?',
      '',
      '1️⃣ Book Table',
      '2️⃣ View Menu',
      '3️⃣ Ask Question',
      '',
      'Please reply with the number or keyword.'
    ].join('\n'),
    variables: [
      { key: 'businessName', label: 'Business Name', required: true, example: 'Karachi Kitchen' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class OpenWATemplateService {
  /**
   * List all available template definitions.
   */
  listTemplates(): PabandiTemplate[] {
    return Object.values(TEMPLATES);
  }

  /**
   * Get a single template by name.
   */
  getTemplate(name: string): PabandiTemplate | null {
    return TEMPLATES[name] || null;
  }

  /**
   * Render a template with the given variables. Returns the final message string.
   */
  render(templateName: string, variables: Record<string, string>): string {
    const template = TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    // Check required variables
    for (const v of template.variables) {
      if (v.required && !variables[v.key]) {
        throw new Error(`Missing required variable "${v.key}" for template "${templateName}"`);
      }
    }

    // Replace {{variable}} placeholders
    let rendered = template.body;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }

    // Clean up any unreplaced optional variables
    rendered = rendered.replace(/\{\{[a-zA-Z]+\}\}/g, '');

    // Remove empty lines that result from missing optional variables
    rendered = rendered.replace(/\n{3,}/g, '\n\n');

    if (template.footer) {
      rendered = `${rendered.trimEnd()}\n\n_${template.footer}_`;
    }

    return rendered;
  }

  /**
   * Render and send a template message to a phone number.
   */
  async sendTemplate(
    toPhone: string,
    templateName: string,
    variables: Record<string, string>,
    options?: { sessionId?: string }
  ): Promise<OpenWAMessageSendResult> {
    const rendered = this.render(templateName, variables);

    try {
      // First try OpenWA's native template endpoint (if templates are registered there)
      return await openwaService.sendTemplate(
        `${String(toPhone).replace(/[^\d]/g, '')}@c.us`,
        templateName,
        variables,
        options
      );
    } catch {
      // Fallback: send as plain text (OpenWA template may not be registered)
      logger.debug(`[TemplateService] Native template "${templateName}" not available, sending as text`);
      return await openwaService.sendText(toPhone, rendered, options);
    }
  }
}

export const openwaTemplateService = new OpenWATemplateService();
