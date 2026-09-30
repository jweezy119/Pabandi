export declare class EvolutionService {
    private client;
    constructor();
    createInstance(instanceName: string): Promise<any>;
    getQRCode(instanceName: string): Promise<any>;
    getInstanceState(instanceName: string): Promise<any>;
    listInstances(): Promise<any>;
    logoutInstance(instanceName: string): Promise<any>;
    sendTextMessage(instanceName: string, to: string, message: string): Promise<any>;
    sendInteractiveMessage(instanceName: string, to: string, buttons: any[]): Promise<any>;
    handleWebhook(instanceName: string, payload: any): Promise<void>;
    private handleIncomingMessage;
    private handleConnectionUpdate;
    private processCommand;
    sendBookingConfirmation(instanceName: string, to: string, bookingDetails: any): Promise<any>;
    sendPaymentReminder(instanceName: string, to: string, details: any): Promise<any>;
    sendEscrowUpdate(instanceName: string, to: string, details: any): Promise<any>;
    getUserStatus(userId: string): Promise<{
        connected: boolean;
        messages: {
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            id: string;
            userId: string | null;
            createdAt: Date;
            status: import(".prisma/client").$Enums.WhatsAppStatus;
            type: import(".prisma/client").$Enums.WhatsAppType;
            externalId: string | null;
            sentAt: Date | null;
            readAt: Date | null;
            direction: import(".prisma/client").$Enums.WhatsAppDirection;
            content: string;
            deliveredAt: Date | null;
            mediaUrl: string | null;
        }[];
    }>;
}
export declare const evolutionAPI: EvolutionService;
//# sourceMappingURL=evolution.service.d.ts.map