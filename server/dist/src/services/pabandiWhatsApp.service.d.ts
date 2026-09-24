export declare class WhatsAppService {
    private client;
    constructor();
    sendMessage(instanceName: string, to: string, message: string): Promise<any>;
    sendInteractiveMessage(instanceName: string, to: string, buttons: any[]): Promise<any>;
    sendBookingConfirmation(instanceName: string, to: string, details: any): Promise<any>;
    sendPaymentReminder(instanceName: string, to: string, details: any): Promise<any>;
    sendEscrowUpdate(instanceName: string, to: string, details: any): Promise<any>;
    handleIncomingMessage(instanceName: string, phone: string, text: string): Promise<any>;
    processCommand(instanceName: string, phone: string, text: string): Promise<string>;
    private handleBooking;
    private handlePayment;
    private handleMyBookings;
    private handleMyPayments;
    private handleSearch;
    private handleInstallmentStatus;
    private handleEscrowQuery;
    private getHelpMessage;
}
export declare const whatsAppService: WhatsAppService;
//# sourceMappingURL=pabandiWhatsApp.service.d.ts.map