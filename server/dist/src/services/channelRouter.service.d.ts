type Channel = 'WHATSAPP' | 'TELEGRAM' | 'SMS';
interface RouteResult {
    success: boolean;
    channel: Channel;
    messageId?: string;
    error?: string;
}
interface ChannelStats {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    cost: number;
}
export declare class ChannelRouterService {
    private channelPriority;
    getPreferredChannel(userId: string): Promise<Channel>;
    setPreferredChannel(userId: string, channel: Channel): Promise<void>;
    routeMessage(businessId: string, customerId: string, message: string, channels?: Channel[], options?: {
        parse_mode?: string;
        buttons?: any[][];
    }): Promise<RouteResult>;
    fallback(businessId: string, customerId: string, message: string, fromChannel: Channel, toChannel: Channel, options?: {
        parse_mode?: string;
        buttons?: any[][];
    }): Promise<RouteResult>;
    trackDelivery(messageId: string, channel: Channel): Promise<{
        status: string;
        deliveredAt?: Date;
    }>;
    getUnifiedInbox(businessId: string, options?: {
        channel?: Channel;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        error: string | null;
        id: string;
        createdAt: Date;
        businessId: string;
        status: string;
        customerId: string;
        externalId: string | null;
        direction: string;
        content: string;
        sentAt: Date | null;
        deliveredAt: Date | null;
        channel: string;
        failedAt: Date | null;
    }[]>;
    getChannelStats(businessId: string, startDate?: Date, endDate?: Date): Promise<Record<Channel, ChannelStats>>;
    getBestTimeToSend(businessId: string): Promise<{
        hour: number;
        day: string;
        engagement: number;
    }[]>;
    private sendViaChannel;
}
export declare const channelRouter: ChannelRouterService;
export {};
//# sourceMappingURL=channelRouter.service.d.ts.map