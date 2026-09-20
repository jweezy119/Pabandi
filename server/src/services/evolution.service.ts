import axios from 'axios';
import { prisma } from '../utils/database';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'pabandi-evolution-key-2026';

export class EvolutionService {
  private client;

  constructor() {
    this.client = axios.create({
      baseURL: EVOLUTION_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
    });
  }

  // ── INSTANCE MANAGEMENT ──────────────────────────────

  async createInstance(instanceName: string) {
    const response = await this.client.post('/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
    return response.data;
  }

  async getQRCode(instanceName: string) {
    const response = await this.client.get(`/instance/qrcode/${instanceName}`);
    return response.data;
  }

  async getInstanceState(instanceName: string) {
    const response = await this.client.get(`/instance/connectionState/${instanceName}`);
    return response.data;
  }

  async listInstances() {
    const response = await this.client.get('/instance/fetchInstances');
    return response.data;
  }

  async logoutInstance(instanceName: string) {
    const response = await this.client.delete(`/instance/logout/${instanceName}`);
    return response.data;
  }

  // ── MESSAGING ────────────────────────────────────────

  async sendTextMessage(instanceName: string, to: string, message: string) {
    // Format: 923001234567@s.whatsapp.net
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const response = await this.client.post(`/message/text/${instanceName}`, {
      number: jid,
      text: message,
    });
    return response.data;
  }

  async sendInteractiveMessage(instanceName: string, to: string, buttons: any[]) {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const response = await this.client.post(`/message/interactive/${instanceName}`, {
      number: jid,
      title: 'Pabandi',
      buttons,
    });
    return response.data;
  }

  // ── WEBHOOK HANDLING ────────────────────────────────

  async handleWebhook(instanceName: string, payload: any) {
    const { event, data } = payload;

    switch (event) {
      case 'messages.upsert':
        await this.handleIncomingMessage(instanceName, data);
        break;
      case 'connection.update':
        await this.handleConnectionUpdate(instanceName, data);
        break;
      default:
        console.log(`[Evolution] Unhandled event: ${event}`);
    }
  }

  private async handleIncomingMessage(instanceName: string, data: any) {
    const message = data.messages?.[0];
    if (!message) return;

    const from = message.key.remoteJid.replace('@s.whatsapp.net', '');
    const text = message.message?.conversation || '';

    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone: from },
    });

    if (!user) {
      console.log(`[Evolution] Unknown sender: ${from}`);
      await this.sendTextMessage(
        instanceName,
        from,
        'Welcome to Pabandi! Please register at https://pabandi.com first.'
      );
      return;
    }

    // Log message
    await prisma.whatsAppMessage.create({
      data: {
        userId: user.id,
        direction: 'INBOUND',
        type: 'TEXT',
        content: text,
        externalId: message.key.id,
        status: 'DELIVERED',
      },
    });

    // Process bot command
    await this.processCommand(user.id, from, text, instanceName);
  }

  private async handleConnectionUpdate(instanceName: string, data: any) {
    const { state } = data;
    console.log(`[Evolution] Connection state for ${instanceName}: ${state}`);
  }

  private async processCommand(userId: string, from: string, text: string, instanceName: string) {
    const lowerText = text.toLowerCase();

    if (lowerText.startsWith('book ')) {
      // Book table at <restaurant> for <time>
      await this.sendTextMessage(instanceName, from, `🔍 Searching for ${text.replace('book ', '')}...`);
      // In production: search restaurants, create booking
    } else if (lowerText.startsWith('pay ')) {
      await this.sendTextMessage(instanceName, from, `💳 Processing payment...`);
      // In production: process payment
    } else if (lowerText === 'my bookings') {
      const bookings = await prisma.bookingPabRecord.findMany({
        where: { userId },
        take: 5,
      });
      let message = '📋 Your Bookings:\n';
      bookings.forEach((b: any, i: number) => {
        message += `${i + 1}. ${b.description || 'Booking'} - ${b.status}\n`;
      });
      await this.sendTextMessage(instanceName, from, message);
    } else if (lowerText === 'my payments') {
      await this.sendTextMessage(instanceName, from, '💳 Fetching payment history...');
    } else if (lowerText.startsWith('search ')) {
      const query = text.replace('search ', '');
      await this.sendTextMessage(instanceName, from, `🔍 Searching for "${query}" near you...`);
    } else if (lowerText === 'help') {
      const helpMessage = `🤖 Pabandi Bot Commands:
      
book <restaurant> - Book a table
pay <amount> - Make a payment
my bookings - View your bookings
my payments - Payment history
search <category> - Find businesses
installment status - Check installments
help - Show this menu`;
      await this.sendTextMessage(instanceName, from, helpMessage);
    } else {
      await this.sendTextMessage(instanceName, from, 'Hi! I\'m the Pabandi bot. Type "help" for commands.');
    }
  }

  // ── TEMPLATES ────────────────────────────────────────

  async sendBookingConfirmation(instanceName: string, to: string, bookingDetails: any) {
    const message = `✅ Booking Confirmed!

📍 ${bookingDetails.restaurant || 'Restaurant'}
📅 ${bookingDetails.date || 'Today'}
⏰ ${bookingDetails.time || '8:00 PM'}
👥 ${bookingDetails.guests || 2} guests

Show this at the door. Enjoy! 🍽️`;
    return this.sendTextMessage(instanceName, to, message);
  }

  async sendPaymentReminder(instanceName: string, to: string, details: any) {
    const message = `💳 Payment Reminder

Amount: Rs. ${details.amount?.toLocaleString() || '0'}
Due: ${details.dueDate || 'Today'}
Status: Pending

Pay now to avoid late fees. 📱`;
    return this.sendTextMessage(instanceName, to, message);
  }

  async sendEscrowUpdate(instanceName: string, to: string, details: any) {
    const message = `🔒 Escrow Update

Status: ${details.status || 'Updated'}
Amount: Rs. ${details.amount?.toLocaleString() || '0'}
${details.message || ''}

Track at: pabandi.com/cod/${details.escrowId || ''}`;
    return this.sendTextMessage(instanceName, to, message);
  }

  // ── USER STATUS ──────────────────────────────────────

  async getUserStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { whatsAppMessages: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    return {
      connected: true,
      messages: user?.whatsAppMessages || [],
    };
  }
}

export const evolutionAPI = new EvolutionService();
