/**
 * WhatsApp Bot Service - Handle incoming WhatsApp messages and commands
 */
export interface BotResponse {
    success: boolean;
    message: string;
    data?: any;
}
export declare class WhatsAppBotService {
    /**
     * Process incoming message and execute appropriate command
     */
    processMessage(phone: string, text: string): Promise<BotResponse>;
    /**
     * Show help message
     */
    private showHelp;
    /**
     * Get user bookings
     */
    private getMyBookings;
    /**
     * Get user payments
     */
    private getMyPayments;
    /**
     * Get installment status
     */
    private getInstallmentStatus;
    /**
     * Search for businesses
     */
    private searchBusinesses;
    /**
     * Book a table
     */
    private bookTable;
    /**
     * Process payment
     */
    private processPayment;
}
export declare const whatsAppBotService: WhatsAppBotService;
//# sourceMappingURL=whatsappBot.service.d.ts.map