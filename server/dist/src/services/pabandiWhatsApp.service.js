"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsAppService = exports.WhatsAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'pabandi-evolution-key-2026';
class WhatsAppService {
    constructor() {
        this.client = axios_1.default.create({
            baseURL: EVOLUTION_API_URL,
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
            },
        });
    }
    async sendMessage(instanceName, to, message) {
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        const response = await this.client.post(`/message/text/${instanceName}`, {
            number: jid,
            text: message,
        });
        return response.data;
    }
    async sendInteractiveMessage(instanceName, to, buttons) {
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        const response = await this.client.post(`/message/interactive/${instanceName}`, {
            number: jid,
            title: 'Pabandi',
            buttons,
        });
        return response.data;
    }
    async sendBookingConfirmation(instanceName, to, details) {
        const message = [
            '✅ Booking Confirmed!',
            '',
            `📍 ${details.restaurant || 'Restaurant'}`,
            `📅 ${details.date || 'Today'}`,
            `⏰ ${details.time || '8:00 PM'}`,
            `👥 ${details.guests || 2} guests`,
            '',
            'Show this at the door. Enjoy! 🍽️',
        ].join('\n');
        return this.sendMessage(instanceName, to, message);
    }
    async sendPaymentReminder(instanceName, to, details) {
        const message = [
            '💳 Payment Reminder',
            '',
            `Amount: Rs. ${details.amount?.toLocaleString() || '0'}`,
            `Due: ${details.dueDate || 'Today'}`,
            'Status: Pending',
            '',
            'Pay now to avoid late fees. 📱',
        ].join('\n');
        return this.sendMessage(instanceName, to, message);
    }
    async sendEscrowUpdate(instanceName, to, details) {
        const message = [
            '🔒 Escrow Update',
            '',
            `Status: ${details.status || 'Updated'}`,
            `Amount: Rs. ${details.amount?.toLocaleString() || '0'}`,
            details.message || '',
            '',
            `Track at: pabandi.com/cod/${details.escrowId || ''}`,
        ].join('\n');
        return this.sendMessage(instanceName, to, message);
    }
    async handleIncomingMessage(instanceName, phone, text) {
        const response = await this.processCommand(instanceName, phone, text);
        return this.sendMessage(instanceName, phone, response);
    }
    // ── BOT COMMANDS ─────────────────────────────────────
    async processCommand(instanceName, phone, text) {
        const lower = text.toLowerCase().trim();
        if (lower.startsWith('book ')) {
            return this.handleBooking(phone, text);
        }
        else if (lower.startsWith('pay ')) {
            return this.handlePayment(phone, text);
        }
        else if (lower === 'my bookings') {
            return this.handleMyBookings(phone);
        }
        else if (lower === 'my payments') {
            return this.handleMyPayments(phone);
        }
        else if (lower.startsWith('search ') || lower.startsWith('find ')) {
            return this.handleSearch(phone, text);
        }
        else if (lower === 'installment status') {
            return this.handleInstallmentStatus(phone);
        }
        else if (lower.startsWith('escrow') || lower.startsWith('track')) {
            return this.handleEscrowQuery(phone, text);
        }
        else {
            return this.getHelpMessage('there');
        }
    }
    async handleBooking(phone, text) {
        return [
            '🔍 Searching for restaurant...',
            '',
            'Found: Karim\'s Restaurant',
            '📍 Clifton, Karachi',
            '⭐ 4.5 rating',
            '',
            'To confirm booking, reply:',
            'BOOK Karim\'s 7:00 PM 2 guests',
        ].join('\n');
    }
    async handlePayment(phone, text) {
        return [
            '💳 Payment Initiated',
            '',
            'Send payment via Raast to:',
            '📱 03123456789',
            '',
            'Reply PROOF after sending screenshot.',
        ].join('\n');
    }
    async handleMyBookings(phone) {
        return [
            '📋 Your Bookings',
            '',
            '1. Karim\'s Restaurant - Today 7:00 PM ✅',
            '2. Salt n Pepper - Tomorrow 8:00 PM ⏳',
            '',
            'Reply CANCEL [number] to cancel.',
        ].join('\n');
    }
    async handleMyPayments(phone) {
        return [
            '💳 Payment History',
            '',
            '1. PKR 5,000 - Karim\'s Restaurant - ✅ Paid',
            '2. PKR 15,000 - Bahria Town Installment - ⏳ Due Oct 15',
            '',
            'Reply PAY to make a payment.',
        ].join('\n');
    }
    async handleSearch(phone, text) {
        return [
            '🔍 Searching...',
            '',
            'Results:',
            '1. Karim\'s Restaurant - 2.3km ⭐4.5',
            '2. Salt n Pepper - 3.1km ⭐4.3',
            '3. BBQ Tonight - 4.5km ⭐4.6',
            '',
            'Reply BOOK [number] to book a table.',
        ].join('\n');
    }
    async handleInstallmentStatus(phone) {
        return [
            '🏠 Your Installments',
            '',
            '1. Bahria Town - Unit 3B',
            '   Total: PKR 5,000,000 | Paid: 40%',
            '   Next: PKR 250,000 due Oct 15, 2026',
            '',
            '2. DHA Phase 8 - Unit 5A',
            '   Total: PKR 8,000,000 | Paid: 60%',
            '   Next: PKR 400,000 due Nov 1, 2026',
            '',
            'Reply PAY [number] to pay installment.',
        ].join('\n');
    }
    async handleEscrowQuery(phone, text) {
        return [
            '📦 Escrow Status',
            '',
            '1. Order #ESC001 - Shipped 📦',
            '2. Order #ESC002 - Delivered ✅',
            '',
            'Reply TRACK [number] for details.',
        ].join('\n');
    }
    getHelpMessage(name) {
        return [
            `Hi ${name}! 👋`,
            '',
            'Pabandi WhatsApp Bot Commands:',
            '',
            '📋 BOOKING',
            '• BOOK at [restaurant] [time] [guests]',
            '• MY BOOKINGS',
            '• CANCEL [number]',
            '',
            '💳 PAYMENTS',
            '• PAY [amount] to [business]',
            '• MY PAYMENTS',
            '• PROOF (after sending payment)',
            '',
            '🔍 SEARCH',
            '• SEARCH [category] in [city]',
            '',
            '🏠 REAL ESTATE',
            '• INSTALLMENT STATUS',
            '• PAY INSTALLMENT [number]',
            '',
            '📦 E-COMMERCE',
            '• ESCROW STATUS',
            '• TRACK [order number]',
            '',
            '🏥 HELP',
            '• Reply HELP anytime',
            '',
            'Powered by Pabandi - Trust for Pakistan 🇵🇰',
        ].join('\n');
    }
}
exports.WhatsAppService = WhatsAppService;
exports.whatsAppService = new WhatsAppService();
//# sourceMappingURL=pabandiWhatsApp.service.js.map