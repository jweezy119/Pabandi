import { openwaService } from './whatsapp.service';
import { OpenWAMessageSendResult } from './openwa.service';
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

  noshow_recovery_outreach: {
    name: 'noshow_recovery_outreach',
    category: 'marketing',
    body: [
      '🔥 *Tired of customers booking and never showing up?*',
      '',
      'Hi {{ownerName}}, salons, clinics, and restaurants in your area lose up to 30% of their daily revenue to ghost appointments.',
      '',
      '*Pabandi Zero-Risk No-Show Protection:*',
      '✅ 100% Free to use — Zero monthly subscription fees',
      '✅ When clients book on WhatsApp, our bot automatically collects a commitment deposit (e.g., {{depositAmount}})',
      '✅ If they show up: You keep 100% of your service fee',
      '✅ If they ghost: Pabandi captures the deposit and transfers 80% directly to your bank account',
      '',
      '👉 Activate Free No-Show Shield for *{{businessName}}*:',
      '{{claimUrl}}',
    ].join('\n'),
    variables: [
      { key: 'ownerName', label: 'Owner Name', required: true, example: 'Ayesha' },
      { key: 'businessName', label: 'Business Name', required: true, example: 'Glamour Salon' },
      { key: 'depositAmount', label: 'Deposit Amount', required: true, example: 'Rs. 500' },
      { key: 'claimUrl', label: 'Claim URL', required: true },
    ],
    footer: 'Pabandi Revenue Recovery Engine',
  },

  deposit_commitment_request: {
    name: 'deposit_commitment_request',
    category: 'booking',
    body: [
      '🔒 *Secure Your Appointment at {{businessName}}*',
      '',
      'Hi {{customerName}}, your requested slot is held for 15 minutes:',
      '📅 {{reservationDate}} at {{reservationTime}}',
      '🏢 {{businessName}}',
      '',
      'To prevent double-booking and secure your slot, please complete the refundable commitment deposit of *{{depositAmount}}*:',
      '👉 Pay Deposit: {{checkoutUrl}}',
      '',
      '✅ *Note:* Your deposit is applied directly to your final bill or fully refunded if you reschedule with 2 hours advance notice.',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true, example: 'Tariq' },
      { key: 'businessName', label: 'Business Name', required: true, example: 'Lahore Dental Care' },
      { key: 'reservationDate', label: 'Date', required: true, example: 'Tomorrow' },
      { key: 'reservationTime', label: 'Time', required: true, example: '4:00 PM' },
      { key: 'depositAmount', label: 'Deposit Amount', required: true, example: 'Rs. 1,000' },
      { key: 'checkoutUrl', label: 'Checkout URL', required: true },
    ],
    footer: 'Secured by Pabandi Escrow',
  },

  forfeited_deposit_settlement: {
    name: 'forfeited_deposit_settlement',
    category: 'notification',
    body: [
      '💰 *No-Show Deposit Recovered!*',
      '',
      'Hello {{businessName}},',
      'A customer failed to check in for their {{reservationTime}} appointment on {{reservationDate}}.',
      '',
      '*Under your Pabandi Protection Guarantee:*',
      '• Total Deposit Captured: *{{depositAmount}}*',
      '• Platform Recovery Fee (20%): *{{platformFeeAmount}}*',
      '• Direct Payout to You (80%): *{{payoutAmount}}*',
      '',
      'Reference ID: #{{escrowId}}',
      'The payout has been recorded in your settlement balance.',
    ].join('\n'),
    variables: [
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'reservationDate', label: 'Date', required: true },
      { key: 'reservationTime', label: 'Time', required: true },
      { key: 'depositAmount', label: 'Total Deposit', required: true },
      { key: 'platformFeeAmount', label: 'Platform Fee (20%)', required: true },
      { key: 'payoutAmount', label: 'Merchant Payout (80%)', required: true },
      { key: 'escrowId', label: 'Escrow Reference ID', required: true },
    ],
    footer: 'Pabandi Revenue Recovery Engine',
  },

  cod_commitment_request: {
    name: 'cod_commitment_request',
    category: 'notification',
    body: [
      '📦 *Confirm your Order #{{orderId}} from {{storeName}}*',
      '',
      'Hi {{customerName}}, thank you for your order of *{{orderTotal}}*!',
      '',
      'To prevent fake orders and lock in your priority courier dispatch, please pay a nominal delivery advance of *{{depositAmount}}* (automatically deducted from your doorstep COD total):',
      '👉 Pay Advance: {{checkoutUrl}}',
      '',
      '✅ *Doorstep Balance:* You will only pay *{{remainingBalance}}* to the courier upon delivery.',
    ].join('\n'),
    variables: [
      { key: 'orderId', label: 'Order ID', required: true, example: '10492' },
      { key: 'storeName', label: 'Store Name', required: true, example: 'Urban Wear' },
      { key: 'customerName', label: 'Customer Name', required: true, example: 'Ali' },
      { key: 'orderTotal', label: 'Order Total', required: true, example: 'Rs. 4,500' },
      { key: 'depositAmount', label: 'Advance Deposit', required: true, example: 'Rs. 300' },
      { key: 'checkoutUrl', label: 'Checkout URL', required: true },
      { key: 'remainingBalance', label: 'Remaining Balance', required: true, example: 'Rs. 4,200' },
    ],
    footer: 'Pabandi COD Risk Shield',
  },

  cod_verified_confirmation: {
    name: 'cod_verified_confirmation',
    category: 'notification',
    body: [
      '✅ *COD Order #{{orderId}} Verified & Dispatched!*',
      '',
      'Hi {{customerName}}, your delivery advance of *{{depositAmount}}* has been received.',
      '',
      '🏢 *{{storeName}}* is packing your parcel.',
      '📦 *Amount to pay rider:* *{{remainingBalance}}*',
      '',
      'Tracking reference: #{{trackingReference}}',
    ].join('\n'),
    variables: [
      { key: 'orderId', label: 'Order ID', required: true },
      { key: 'storeName', label: 'Store Name', required: true },
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'depositAmount', label: 'Advance Paid', required: true },
      { key: 'remainingBalance', label: 'Doorstep Balance', required: true },
      { key: 'trackingReference', label: 'Tracking Ref', required: true },
    ],
    footer: 'Pabandi COD Risk Shield',
  },

  post_service_review: {
    name: 'post_service_review',
    category: 'support',
    body: [
      '📋 *Service Completion Summary — {{businessName}}*',
      '',
      'Hi {{customerName}}, your appointment at *{{businessName}}* has been marked completed.',
      '',
      'Please share your service rating or feedback:',
      '{{googleReviewUrl}}',
      '',
      'To schedule your next appointment, reply *book* or visit the link above.',
    ].join('\n'),
    variables: [
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'googleReviewUrl', label: 'Review URL', required: true },
    ],
    footer: 'Pabandi Service Records',
  },

  waitlist_slot_available: {
    name: 'waitlist_slot_available',
    category: 'notification',
    body: [
      '🕐 *Appointment Slot Update — {{businessName}}*',
      '',
      'Hi {{customerName}}, a previously reserved time slot on *{{reservationDate}}* at *{{reservationTime}}* is now open.',
      '',
      'Slot Reference: #{{slotRef}}',
      'View slot details: {{bookingUrl}}',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'reservationDate', label: 'Reservation Date', required: true },
      { key: 'reservationTime', label: 'Reservation Time', required: true },
      { key: 'slotRef', label: 'Slot Reference', required: true },
      { key: 'bookingUrl', label: 'Booking URL', required: true },
    ],
    footer: 'Pabandi Waitlist Notification',
  },

  solana_pay_receipt: {
    name: 'solana_pay_receipt',
    category: 'booking',
    body: [
      '🧾 *Payment Receipt — {{businessName}}*',
      '',
      'Hi {{customerName}}, your payment has been confirmed on-chain.',
      '',
      'Order Number: #{{bookingId}}',
      'Service: {{serviceName}}',
      'Amount Paid: *{{amount}}*',
      'Transaction Ref: `{{txSignature}}`',
      'Booking Credential (cNFT): `{{cnftAssetId}}`',
    ].join('\n'),
    variables: [
      { key: 'customerName', label: 'Customer Name', required: true },
      { key: 'businessName', label: 'Business Name', required: true },
      { key: 'bookingId', label: 'Booking ID', required: true },
      { key: 'serviceName', label: 'Service Name', required: true },
      { key: 'amount', label: 'Amount', required: true },
      { key: 'txSignature', label: 'Transaction Signature', required: true },
      { key: 'cnftAssetId', label: 'cNFT Asset ID', required: false },
    ],
    footer: 'Pabandi Settlement Receipt',
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
