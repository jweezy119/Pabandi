"use strict";
/**
 * WhatsApp Bot Service - Handle incoming WhatsApp messages and commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsAppBotService = exports.WhatsAppBotService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
class WhatsAppBotService {
    /**
     * Process incoming message and execute appropriate command
     */
    async processMessage(phone, text) {
        const normalizedText = text.trim();
        const lowerText = normalizedText.toLowerCase();
        try {
            // Help command
            if (lowerText === 'help' || lowerText === 'مدد') {
                return this.showHelp();
            }
            // My bookings
            if (lowerText === 'my bookings' || lowerText === 'میری بکنگز') {
                return await this.getMyBookings(phone);
            }
            // My payments
            if (lowerText === 'my payments' || lowerText === 'میری ادائیگیاں') {
                return await this.getMyPayments(phone);
            }
            // Installment status
            if (lowerText.includes('installment') || lowerText.includes('قسط')) {
                return await this.getInstallmentStatus(phone);
            }
            // Search command: "Search [category] in [city]"
            const searchMatch = normalizedText.match(/search\s+(.+?)\s+in\s+(.+)/i);
            if (searchMatch) {
                return await this.searchBusinesses(searchMatch[1].trim(), searchMatch[2].trim());
            }
            // Book table command
            const bookMatch = normalizedText.match(/book\s+(?:a\s+)?table\s+(?:at\s+)?(.+?)\s+for\s+(.+)/i);
            if (bookMatch) {
                return await this.bookTable(phone, bookMatch[1].trim(), bookMatch[2].trim());
            }
            // Pay command: "Pay [amount] to [business]"
            const payMatch = normalizedText.match(/pay\s+(\d+(?:,\d+)?)\s+(?:to\s+)?(.+)/i);
            if (payMatch) {
                return await this.processPayment(phone, parseInt(payMatch[1].replace(/,/g, '')), payMatch[2].trim());
            }
            // Default response
            return {
                success: true,
                message: `🤖 Pabandi Bot\n\n"${normalizedText}" - Command not recognized.\n\nReply "Help" for available commands.\n\n_پابانڈی بوٹ - دستحیک اعمال کے لیے "Help" بھیجیں_`,
            };
        }
        catch (error) {
            logger_1.logger.error(`[WhatsApp Bot] Error: ${error.message}`);
            return {
                success: false,
                message: '❌ An error occurred. Please try again later.',
            };
        }
    }
    /**
     * Show help message
     */
    showHelp() {
        return {
            success: true,
            message: `🤖 *Pabandi WhatsApp Bot* 🇵🇰

Available Commands:
📋 *Book* table at [restaurant] for [time]
💳 *Pay* [amount] to [business]
📅 *My bookings*
💰 *My payments*
📊 *Installment status*
🔍 *Search* [category] in [city]
❓ *Help*

Example:
• Book table at BBQ Tonight for 8pm
• Pay 5000 to Al-Hyat Medical
• Search restaurant in Lahore

_Powered by Pabandi - پابانڈی_`,
        };
    }
    /**
     * Get user bookings
     */
    async getMyBookings(phone) {
        const user = await database_1.prisma.user.findFirst({
            where: { phone },
            include: {
                reservations: {
                    include: {
                        business: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
        if (!user || user.reservations.length === 0) {
            return {
                success: true,
                message: `📅 *No Bookings Found*\n\nYou don't have any active bookings.\n\nTo make a booking, use:
Book table at [restaurant] for [time]

_کوئی بکنگ نہیں ملی_`,
            };
        }
        const bookingList = user.reservations
            .map((r, i) => `${i + 1}. ${r.business?.name || 'Unknown'} - ${r.status}`)
            .join('\n');
        return {
            success: true,
            message: `📅 *Your Recent Bookings*\n\n${bookingList}\n\n_مزید تفصیلات کے لیے بکنگ ID بھیجیں_`,
        };
    }
    /**
     * Get user payments
     */
    async getMyPayments(phone) {
        const user = await database_1.prisma.user.findFirst({
            where: { phone },
            include: {
                userPayments: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
        if (!user || user.userPayments.length === 0) {
            return {
                success: true,
                message: `💰 *No Payments Found*\n\nYou haven't made any payments yet.\n\nTo make a payment, use:
Pay [amount] to [business]

_کوئی ادائیگی نہیں ملی_`,
            };
        }
        const paymentList = user.userPayments
            .map((p, i) => `${i + 1}. PKR ${p.amount?.toLocaleString()} - ${p.status}`)
            .join('\n');
        return {
            success: true,
            message: `💰 *Your Recent Payments*\n\n${paymentList}\n\n_پابانڈی کے ذریعے محفوظ ادائیگیاں_`,
        };
    }
    /**
     * Get installment status
     */
    async getInstallmentStatus(phone) {
        const user = await database_1.prisma.user.findFirst({
            where: { phone },
            include: {
                buyerProfile: {
                    include: {
                        installments: {
                            orderBy: { dueDate: 'asc' },
                        },
                    },
                },
            },
        });
        if (!user?.buyerProfile || user.buyerProfile.installments.length === 0) {
            return {
                success: true,
                message: `📊 *No Installments Found*\n\nYou don't have any active installment plans.\n\n_کوئی قسط پلان نہیں ملا_`,
            };
        }
        const installments = user.buyerProfile.installments;
        const pending = installments.filter((i) => i.status === 'PENDING');
        const paid = installments.filter((i) => i.status === 'PAID');
        return {
            success: true,
            message: `📊 *Installment Status*

✅ Paid: ${paid.length}
⏳ Pending: ${pending.length}
📊 Total: ${installments.length}

Next Payment: PKR ${pending[0]?.amount?.toLocaleString() || 'N/A'}
Due Date: ${pending[0]?.dueDate ? new Date(pending[0].dueDate).toLocaleDateString() : 'N/A'}

_سمارٹ قسط منصوبہ_`,
        };
    }
    /**
     * Search for businesses
     */
    async searchBusinesses(category, city) {
        const businesses = await database_1.prisma.business.findMany({
            where: {
                category: category.toUpperCase(),
                city: { contains: city, mode: 'insensitive' },
                isActive: true,
            },
            take: 10,
        });
        if (businesses.length === 0) {
            return {
                success: true,
                message: `🔍 *No Results Found*

Category: ${category}
City: ${city}

Try different keywords or city name.

_کوئی نتیجہ نہیں ملا_`,
            };
        }
        const businessList = businesses
            .slice(0, 5)
            .map((b, i) => `${i + 1}. *${b.name}* - ${b.address || b.city}`)
            .join('\n');
        return {
            success: true,
            message: `🔍 *Search Results*

Category: ${category}
City: ${city}

${businessList}

_Reply with business name to book_
_مزید کے لیے کیٹگری تبدیل کریں_`,
        };
    }
    /**
     * Book a table
     */
    async bookTable(phone, restaurantName, timeSpec) {
        const business = await database_1.prisma.business.findFirst({
            where: {
                name: { contains: restaurantName, mode: 'insensitive' },
                isActive: true,
            },
        });
        if (!business) {
            return {
                success: true,
                message: `❌ *Restaurant Not Found*

"${restaurantName}" not found in our database.

Try: Search restaurant in [city]

_ریستوران نہیں ملا_`,
            };
        }
        return {
            success: true,
            message: `🍽️ *Booking Request Received*

📍 Restaurant: *${business.name}*
🕐 Time: ${timeSpec}
📍 Location: ${business.address || business.city}

Booking ID: *BK-${Date.now().toString(36).toUpperCase()}*

You'll receive a confirmation shortly.

_بکنگ کی درخواست موصول ہوئی_`,
        };
    }
    /**
     * Process payment
     */
    async processPayment(phone, amount, businessName) {
        if (isNaN(amount) || amount <= 0) {
            return {
                success: false,
                message: '❌ Invalid amount. Use: Pay [amount] to [business]',
            };
        }
        const business = await database_1.prisma.business.findFirst({
            where: {
                name: { contains: businessName, mode: 'insensitive' },
                isActive: true,
            },
        });
        if (!business) {
            return {
                success: true,
                message: `❌ *Business Not Found*

"${businessName}" not found.

Try: Search [category] in [city]

_کاروبار نہیں ملا_`,
            };
        }
        return {
            success: true,
            message: `💳 *Payment Initiated*

💰 Amount: *PKR ${amount.toLocaleString()}*
🏪 Business: *${business.name}*

Reply *"Confirm"* to proceed with payment.

⚠️ Funds held in escrow until service completed.

_ادائیگی کی تصدیق کریں_`,
        };
    }
}
exports.WhatsAppBotService = WhatsAppBotService;
// Singleton instance
exports.whatsAppBotService = new WhatsAppBotService();
//# sourceMappingURL=whatsappBot.service.js.map