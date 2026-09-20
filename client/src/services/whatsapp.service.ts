/**
 * WhatsApp Service - Frontend API client for WhatsApp integration
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export interface SendMessageRequest {
  to: string;
  message: string;
  type?: 'text' | 'interactive';
  buttons?: Array<{ id: string; title: string }>;
}

export interface BookingConfirmationRequest {
  phone: string;
  businessName: string;
  customerName: string;
  date: string;
  time: string;
  partySize: number;
  totalAmount?: number;
}

export interface PaymentReminderRequest {
  phone: string;
  businessName: string;
  amount: number;
  dueDate: string;
  installmentNumber: number;
  totalInstallments: number;
}

export interface EscrowUpdateRequest {
  phone: string;
  businessName: string;
  amount: number;
  status: string;
  releaseDate?: string;
}

export interface BotCommandRequest {
  phone: string;
  message: string;
}

class WhatsAppService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}/whatsapp${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send a text message
   */
  async sendMessage(data: SendMessageRequest) {
    return this.request('/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Send booking confirmation
   */
  async sendBookingConfirmation(bookingId: string, data: BookingConfirmationRequest) {
    return this.request(`/booking/${bookingId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(installmentId: string, data: PaymentReminderRequest) {
    return this.request(`/installment/${installmentId}/remind`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Send escrow update
   */
  async sendEscrowUpdate(escrowId: string, data: EscrowUpdateRequest) {
    return this.request(`/escrow/${escrowId}/update`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Send bot command
   */
  async sendBotCommand(data: BotCommandRequest) {
    return this.request('/bot', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get message history
   */
  async getHistory(userId: string, limit = 50) {
    return this.request(`/history/${userId}?limit=${limit}`);
  }

  /**
   * Share via WhatsApp (client-side)
   */
  shareViaWhatsApp(phone: string, message: string): string {
    const formattedPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  }

  /**
   * Generate WhatsApp deep link for sharing
   */
  generateShareLink(phone: string, message: string): string {
    return this.shareViaWhatsApp(phone, message);
  }
}

export const whatsAppService = new WhatsAppService();
