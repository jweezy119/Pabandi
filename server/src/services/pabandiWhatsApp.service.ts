/**
 * Pabandi WhatsApp Service via Evolution API
 * ===========================================
 * Uses open-source Evolution API (Baileys) — NO Meta API key needed.
 * 
 * Evolution API features:
 * - Connect via QR code (WhatsApp Web protocol)
 * - Send/receive messages
 * - Group management
 * - Status/stories
 * - Webhook for incoming messages
 * 
 * Self-host Evolution API on Render/Docker OR use a managed instance.
 */

import { prisma } from '../utils/database';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE || 'pabandi';

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id?: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
  };
  messageTimestamp?: number;
  pushName?: string;
}

export class WhatsAppService {
  
  // ── INITIALIZE ────────────────────────────────────────

  async initialize() {
    try {
      // Create Evolution API instance
      const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName: INSTANCE_NAME,
          qrcode: true,
          integration: 'BAILEYS',
        }),
      });
      return await response.json();
    } catch (err: any) {
      console.error('[WhatsApp] Initialize error:', err.message);
      return null;
    }
  }

  async getQRCode(): Promise<{ qr?: string; connected?: boolean }> {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY },
      });
      return await response.json();
    } catch {
      return { connected: false };
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY },
      });
      const data = await response.json();
      return data.instance?.state === 'open';
    } catch {
      return false;
    }
  }

  // ── SEND MESSAGES ─────────────────────────────────────

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      // Format phone number (Pakistan: +92XXXXXXXXXX)
      const phone = to.startsWith('+') ? to.replace('+', '') : to;
      
      const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: phone,
          text: message,
        }),
      });
      
      const result = await response.json();
      return !!result.key;
    } catch (err: any) {
      console.error('[WhatsApp] Send error:', err.message);
      return false;
    }
  }

  async sendBookingConfirmation(to: string, booking: {
    businessName: string;
    date: string;
    time: string;
    guests?: number;
  }) {
    const message = `✅ Booking Confirmed!\n\n📍 ${booking.businessName}\n📅 ${booking.date}\n⏰ ${booking.time}${booking.guests ? `\n👥 ${booking.guests} guests` : ''}\n\nThank you for choosing Pabandi! 🎉`;
    return this.sendMessage(to, message);
  }

  async sendPaymentReminder(to: string, payment: {
    amount: number;
    dueDate: string;
    description: string;
  }) {
    const message = `🔔 Payment Reminder\n\n💰 Amount: PKR ${payment.amount.toLocaleString()}\n📅 Due: ${payment.dueDate}\n📝 ${payment.description}\n\nPay now via Raast to avoid late fees.`;
    return this.sendMessage(to, message);
  }

  async sendEscrowUpdate(to: string, escrow: {
    status: string;
    amount: number;
    description: string;
  }) {
    const statusEmoji: Record<string, string> = {
      PAID: '💳',
      SHIPPED: '📦',
      DELIVERED: '✅',
      DISPUTED: '⚠️',
      RELEASED: '💰',
      REFUNDED: '↩️',
    };
    const message = `${statusEmoji[escrow.status] || '📋'} Escrow Update\n\nStatus: ${escrow.status}\n💰 PKR ${escrow.amount.toLocaleString()}\n📝 ${escrow.description}\n\nReply HELP for options.`;
    return this.sendMessage(to, message);
  }

  async sendInstallmentReminder(to: string, installment: {
    unitNumber: string;
    projectName: string;
    amount: number;
    dueDate: string;
  }) {
    const message = `🏠 Installment Reminder\n\n🏗️ ${installment.projectName} - ${installment.unitNumber}\n💰 PKR ${installment.amount.toLocaleString()}\n📅 Due: ${installment.dueDate}\n\nPay via Raast to avoid late fees. Reply PAY to confirm.`;
    return this.sendMessage(to, message);
  }

  // ── INCOMING MESSAGES ─────────────────────────────────

  async handleIncomingMessage(data: EvolutionMessage) {
    const phone = data.key.remoteJid.replace(/@s\.whatsapp\.net$/, '');
    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
    const name = data.pushName || 'User';

    if (!text || data.key.fromMe) return;

    // Log message
    await prisma.whatsAppMessage.create({
      data: {
        userId: '', // Lookup by phone
        direction: 'INBOUND',
        type: 'TEXT',
        content: text,
        externalId: data.key.id || '',
      },
    });

    // Process command
    const response = await this.processCommand(phone, text, name);
    if (response) {
      await this.sendMessage(phone, response);
    }
  }

  async processCommand(phone: string, text: string, name: string): Promise<string> {
    const lower = text.toLowerCase().trim();

    // Booking commands
    if (lower.startsWith('book')) {
      return this.handleBookingCommand(phone, text);
    }

    // Payment commands
    if (lower.startsWith('pay')) {
      return this.handlePaymentCommand(phone, text);
    }

    // My bookings
    if (lower === 'my bookings' || lower === 'bookings') {
      return this.handleMyBookings(phone);
    }

    // My payments
    if (lower === 'my payments' || lower === 'payments') {
      return this.handleMyPayments(phone);
    }

    // Search businesses
    if (lower.startsWith('search') || lower.startsWith('find')) {
      return this.handleSearch(phone, text);
    }

    // Installment status
    if (lower === 'installment status' || lower === 'installments') {
      return this.handleInstallmentStatus(phone);
    }

    // Escrow status
    if (lower.startsWith('escrow')) {
      return this.handleEscrowQuery(phone, text);
    }

    // Help
    if (lower === 'help' || lower === 'hi' || lower === 'hello') {
      return this.getHelpMessage(name);
    }

    // Default response
    return `Hi ${name}! 👋\n\nWelcome to Pabandi. Reply HELP to see available commands.\n\nQuick actions:\n• BOOK [business] at [time]\n• PAY [amount] to [business]\n• SEARCH [category] in [city]\n• MY BOOKINGS\n• MY PAYMENTS`;
  }

  private async handleBookingCommand(phone: string, text: string): Promise<string> {
    // Parse: "book table at Karim's tonight 7pm for 4"
    const match = text.match(/book\s+(?:table\s+)?(?:at\s+)?(.+?)(?:\s+(?:at|for)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?(?:\s+for\s+(\d+))?/i);
    
    if (!match) {
      return '❌ Invalid booking format.\n\nUsage: BOOK [business name] at [time] for [guests]\nExample: BOOK at Karim\'s tonight 7pm for 4';
    }

    const businessName = match[1]?.trim() || 'Unknown';
    const time = match[2]?.trim() || '7:00 PM';
    const guests = match[3]?.trim() || '2';

    // In production: create booking in database
    return `✅ Booking Received!\n\n📍 ${businessName}\n⏰ ${time}\n👥 ${guests} guests\n\nWe'll confirm your booking shortly.`;
  }

  private async handlePaymentCommand(phone: string, text: string): Promise<string> {
    const match = text.match(/pay\s+(\d+(?:,\d+)?)\s+(?:to\s+)?(.+)/i);
    
    if (!match) {
      return '❌ Invalid payment format.\n\nUsage: PAY [amount] to [business]\nExample: PAY 5000 to Karim\'s Restaurant';
    }

    const amount = parseInt(match[1].replace(/,/g, ''));
    const business = match[2].trim();

    return `💳 Payment Initiated\n\n💰 PKR ${amount.toLocaleString()}\n📍 ${business}\n\nSend payment via Raast to:\n📱 03123456789\n\nReply PROOF after sending screenshot.`;
  }

  private async handleMyBookings(phone: string): Promise<string> {
    // In production: fetch from database
    return '📋 Your Bookings\n\n1. Karim's Restaurant - Today 7:00 PM ✅\n2. Salt n Pepper - Tomorrow 8:00 PM ⏳\n\nReply CANCEL [number] to cancel.';
  }

  private async handleMyPayments(phone: string): Promise<string> {
    return '💳 Payment History\n\n1. PKR 5,000 - Karim's Restaurant - ✅ Paid\n2. PKR 15,000 - Bahria Town Installment - ⏳ Due Oct 15\n\nReply PAY to make a payment.';
  }

  private async handleSearch(phone: string, text: string): Promise<string> {
    const match = text.match(/(?:search|find)\s+(.+?)(?:\s+in\s+(.+))?/i);
    const category = match?.[1]?.trim() || 'restaurant';
    const city = match?.[2]?.trim() || 'Karachi';

    return `🔍 Searching for ${category} in ${city}...\n\nResults:\n1. Karim's Restaurant - 2.3km ⭐4.5\n2. Salt n Pepper - 3.1km ⭐4.3\n3. BBQ Tonight - 4.5km ⭐4.6\n\nReply BOOK [number] to book a table.`;
  }

  private async handleInstallmentStatus(phone: string): Promise<string> {
    return '🏠 Your Installments\n\n1. Bahria Town - Unit 3B\n   Total: PKR 5,000,000 | Paid: 40%\n   Next: PKR 250,000 due Oct 15, 2026\n\n2. DHA Phase 8 - Unit 5A\n   Total: PKR 8,000,000 | Paid: 60%\n   Next: PKR 400,000 due Nov 1, 2026\n\nReply PAY [number] to pay installment.';
  }

  private async handleEscrowQuery(phone: string, text: string): Promise<string> {
    return '📦 Escrow Status\n\n1. Order #ESC001 - Shipped 📦\n2. Order #ESC002 - Delivered ✅\n\nReply TRACK [number] for details.';
  }

  private getHelpMessage(name: string): string {
    return `Hi ${name}! 👋\n\nPabandi WhatsApp Bot Commands:\n\n📋 BOOKING\n• BOOK at [restaurant] [time] [guests]\n• MY BOOKINGS\n• CANCEL [number]\n\n💳 PAYMENTS\n• PAY [amount] to [business]\n• MY PAYMENTS\n• PROOF (after sending payment)\n\n🔍 SEARCH\n• SEARCH [category] in [city]\n\n🏠 REAL ESTATE\n• INSTALLMENT STATUS\n• PAY INSTALLMENT [number]\n\n📦 E-COMMERCE\n• ESCROW STATUS\n• TRACK [order number]\n\n🏥 HELP\n• Reply HELP anytime\n\nPowered by Pabandi - Trust for Pakistan 🇵🇰`;
  }
}

export const whatsAppService = new WhatsAppService();
