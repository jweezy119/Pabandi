/**
 * Pabandi WhatsApp Service - Evolution API Gateway
 * Handles all WhatsApp messaging for Pabandi
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const EVOLUTION_BASE_URL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE_ID || 'pabandi-main';

export interface BookingDetails {
  id: string;
  businessName: string;
  customerName: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  totalAmount?: number;
}

export interface InstallmentDetails {
  id: string;
  businessName: string;
  amount: number;
  dueDate: string;
  status: string;
  installmentNumber: number;
  totalInstallments: number;
}

export interface EscrowDetails {
  id: string;
  businessName: string;
  amount: number;
  status: string;
  releaseDate?: string;
}

export interface WhatsAppPayloadMessage {
  from: string;
  id: string;
  text?: { body: string };
  type: string;
}

export interface WhatsAppPayloadContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppMessagePayload {
  object: string;
  entry: Array<{
    changes: Array<{
      value: {
        messages?: WhatsAppPayloadMessage[];
        contacts?: WhatsAppPayloadContact[];
        metadata?: {
          display_phone_number: string;
        };
      };
    }>;
  }>;
}

export class PabandiWhatsAppService {
  private isInitialized = false;

  /**
   * Initialize Evolution API connection
   */
  async initialize(): Promise<void> {
    try {
      const response = await axios.get(`${EVOLUTION_BASE_URL}/instance/fetchInstances`, {
        headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      });
      
      if (response.status === 200) {
        this.isInitialized = true;
        logger.info('[WhatsApp] Evolution API connected successfully');
      }
    } catch (error) {
      logger.warn('[WhatsApp] Evolution API not available, running in mock mode');
      this.isInitialized = false;
    }
  }

  /**
   * Format phone number to PK format (+92)
   */
  private formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    
    if (digits.startsWith('0')) {
      return '+92' + digits.substring(1);
    }
    if (digits.startsWith('92') && digits.length > 10) {
      return '+' + digits;
    }
    if (digits.startsWith('3') && digits.length === 10) {
      return '+92' + digits;
    }
    if (phone.startsWith('+')) {
      return phone;
    }
    return '+92' + digits;
  }

  /**
   * Send text message
   */
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const formattedPhone = this.formatPhone(to);
    
    try {
      if (this.isInitialized) {
        const response = await axios.post(
          `${EVOLUTION_BASE_URL}/message/sendText/${DEFAULT_INSTANCE}`,
          { number: formattedPhone, text: message },
          { headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
        );
        
        const messageId = response.data?.key?.id;
        logger.info(`[WhatsApp] Sent to ${formattedPhone}: ${messageId}`);
        return { success: true, messageId };
      } else {
        logger.info(`[WhatsApp Mock] Send to ${formattedPhone}: ${message}`);
        return { success: true, messageId: 'mock_' + Date.now() };
      }
    } catch (error: any) {
      logger.error(`[WhatsApp] Send failed: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Send booking confirmation message
   */
  async sendBookingConfirmation(to: string, bookingDetails: BookingDetails): Promise<{ success: boolean; messageId?: string }> {
    const message = `🎉 *Booking Confirmed!*

📋 *Booking ID:* ${bookingDetails.id}
🏪 *Business:* ${bookingDetails.businessName}
👤 *Customer:* ${bookingDetails.customerName}
📅 *Date:* ${bookingDetails.date}
⏰ *Time:* ${bookingDetails.time}
👥 *Party Size:* ${bookingDetails.partySize}
💰 *Amount:* PKR ${bookingDetails.totalAmount?.toLocaleString() || 'N/A'}
📊 *Status:* ${bookingDetails.status}

Thank you for choosing Pabandi! 🇵🇰

_Reply "My bookings" to view all bookings_`;

    return this.sendMessage(to, message);
  }

  /**
   * Send payment reminder message
   */
  async sendPaymentReminder(to: string, installmentDetails: InstallmentDetails): Promise<{ success: boolean; messageId?: string }> {
    const message = `💰 *Payment Reminder*

📋 *Installment ID:* ${installmentDetails.id}
🏪 *Business:* ${installmentDetails.businessName}
💵 *Amount Due:* PKR ${installmentDetails.amount.toLocaleString()}
📅 *Due Date:* ${installmentDetails.dueDate}
📊 *Installment:* ${installmentDetails.installmentNumber} of ${installmentDetails.totalInstallments}
📈 *Status:* ${installmentDetails.status}

Please make your payment on time to avoid late fees.

Pay now: https://pabandi.com/pay/${installmentDetails.id}

_Reply "Installment status" to check all installments_`;

    return this.sendMessage(to, message);
  }

  /**
   * Send escrow update message
   */
  async sendEscrowUpdate(to: string, escrowDetails: EscrowDetails): Promise<{ success: boolean; messageId?: string }> {
    const message = `🔒 *Escrow Status Update*

📋 *Escrow ID:* ${escrowDetails.id}
🏪 *Business:* ${escrowDetails.businessName}
💵 *Amount:* PKR ${escrowDetails.amount.toLocaleString()}
📊 *Status:* ${escrowDetails.status}
${escrowDetails.releaseDate ? `📅 *Release Date:* ${escrowDetails.releaseDate}` : ''}

Your funds are safe in escrow until the service is completed.

_Reply "Help" for more options_`;

    return this.sendMessage(to, message);
  }

  /**
   * Send interactive message with buttons
   */
  async sendInteractiveMessage(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<{ success: boolean; messageId?: string }> {
    const formattedPhone = this.formatPhone(to);
    
    try {
      if (this.isInitialized) {
        const response = await axios.post(
          `${EVOLUTION_BASE_URL}/message/sendButtons/${DEFAULT_INSTANCE}`,
          {
            number: formattedPhone,
            text: body,
            buttons: buttons.map(b => ({ buttonId: b.id, buttonText: { displayText: b.title }, type: 1 })),
          },
          { headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
        );
        
        const messageId = response.data?.key?.id;
        return { success: true, messageId };
      } else {
        logger.info(`[WhatsApp Mock] Interactive to ${formattedPhone}: ${body}`);
        return { success: true, messageId: 'mock_' + Date.now() };
      }
    } catch (error: any) {
      logger.error(`[WhatsApp] Interactive send failed: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Handle incoming webhook message
   */
  async handleIncomingMessage(payload: WhatsAppMessagePayload): Promise<void> {
    try {
      if (!payload.object || !payload.entry) return;
      
      for (const entry of payload.entry) {
        for (const change of entry.changes || []) {
          const messages = change.value?.messages || [];
          const contacts = change.value?.contacts || [];
          const metadata = change.value?.metadata;
          
          for (const msg of messages) {
            const customerPhone = this.formatPhone(msg.from);
            const businessPhone = metadata ? this.formatPhone(metadata.display_phone_number) : '';
            const profileName = contacts[0]?.profile?.name || 'Unknown';
            const msgBody = msg.text?.body || '';
            
            logger.info(`[WhatsApp] Received from ${customerPhone}: ${msgBody}`);
          }
        }
      }
    } catch (error: any) {
      logger.error(`[WhatsApp] Webhook error: ${error.message}`);
    }
  }

  /**
   * Process booking command
   */
  processBookingCommand(from: string, text: string): string {
    const bookMatch = text.match(/book\s+(?:a\s+)?table\s+(?:at\s+)?(.+?)\s+for\s+(.+)/i);
    
    if (bookMatch) {
      const restaurantName = bookMatch[1].trim();
      const timeSpec = bookMatch[2].trim();
      return `🍽️ Booking request received!\n\nRestaurant: ${restaurantName}\nTime: ${timeSpec}\n\nWe're processing your booking. You'll receive a confirmation shortly.\n\nBooking ID: BK-${Date.now().toString(36).toUpperCase()}`;
    }
    
    return '';
  }

  /**
   * Process payment command
   */
  processPaymentCommand(from: string, text: string): string {
    const payMatch = text.match(/pay\s+(\d+(?:,\d+)?)\s+(?:to\s+)?(.+)/i);
    
    if (payMatch) {
      const amount = parseInt(payMatch[1].replace(/,/g, ''));
      const businessName = payMatch[2].trim();
      
      if (isNaN(amount) || amount <= 0) {
        return '❌ Invalid amount. Use: Pay [amount] to [business]';
      }
      
      return `💳 Payment Initiated!\n\nAmount: PKR ${amount.toLocaleString()}\nBusiness: ${businessName}\n\nReply "Confirm" to proceed with payment.`;
    }
    
    return '';
  }
}

// Singleton instance
export const pabandiWhatsAppService = new PabandiWhatsAppService();
