import { PrismaClient } from '@prisma/client';
import { LiveSellerPlatform } from '@prisma/client';
export type StreamScheduleItem = {
    id?: string;
    title?: string;
    startsAt?: string;
    endsAt?: string;
    recurrence?: 'once' | 'weekly';
    note?: string;
};
export type LiveSellerIntegrationInput = {
    platform: LiveSellerPlatform;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    shopId?: string;
    streamKey?: string;
    webhookUrl?: string;
    schedule?: StreamScheduleItem[];
    metadata?: any;
};
type ShowItem = {
    id: string;
    name: string;
    description?: string;
    price: number;
    currency?: string;
    inventory?: number;
    images?: string[];
    buyItNow?: boolean;
    auctionEndsAt?: string;
};
type ShowState = {
    isLive: boolean;
    title?: string;
    streamKey?: string;
    startedAt?: string;
    viewerCount?: number;
    items: ShowItem[];
    recentOrders: {
        id: string;
        buyerName: string;
        buyerContact?: string;
        itemId: string;
        itemName?: string;
        quantity: number;
        amount: number;
        currency: string;
        status: string;
        createdAt: string;
    }[];
};
export declare class LiveSellerService {
    private prisma;
    constructor(prisma: PrismaClient);
    listForBusiness(businessId: string): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        scope: string | null;
        businessId: string;
        isActive: boolean;
        accessToken: string;
        refreshToken: string | null;
        expiresAt: Date | null;
        webhookUrl: string | null;
        platform: import(".prisma/client").$Enums.LiveSellerPlatform;
        connectedAt: Date;
        lastSyncAt: Date | null;
        shopId: string | null;
        streamKey: string | null;
        revokedAt: Date | null;
    }[]>;
    connect(businessId: string, input: LiveSellerIntegrationInput): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        scope: string | null;
        businessId: string;
        isActive: boolean;
        accessToken: string;
        refreshToken: string | null;
        expiresAt: Date | null;
        webhookUrl: string | null;
        platform: import(".prisma/client").$Enums.LiveSellerPlatform;
        connectedAt: Date;
        lastSyncAt: Date | null;
        shopId: string | null;
        streamKey: string | null;
        revokedAt: Date | null;
    }>;
    disconnect(businessId: string, platform: LiveSellerPlatform): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        scope: string | null;
        businessId: string;
        isActive: boolean;
        accessToken: string;
        refreshToken: string | null;
        expiresAt: Date | null;
        webhookUrl: string | null;
        platform: import(".prisma/client").$Enums.LiveSellerPlatform;
        connectedAt: Date;
        lastSyncAt: Date | null;
        shopId: string | null;
        streamKey: string | null;
        revokedAt: Date | null;
    }>;
    private defaultShow;
    getShowState(businessId: string, platform: LiveSellerPlatform): Promise<ShowState>;
    upsertShowState(businessId: string, platform: LiveSellerPlatform, patch: Partial<ShowState>): Promise<ShowState>;
    addOrder(businessId: string, platform: LiveSellerPlatform, order: ShowState['recentOrders'][0]): Promise<{
        id: string;
        createdAt: string;
        buyerName: string;
        buyerContact?: string;
        itemId: string;
        itemName?: string;
        quantity: number;
        amount: number;
        currency: string;
        status: string;
    }>;
    getSchedule(businessId: string, platform: LiveSellerPlatform): Promise<any>;
    setSchedule(businessId: string, platform: LiveSellerPlatform, schedule: StreamScheduleItem[]): Promise<{
        id: string;
        title: string;
        startsAt: string;
        endsAt: string;
        recurrence: "once" | "weekly";
        note: string;
    }[]>;
    /**
     * Share a live selling product to a WhatsApp chat using OpenWA native product messages.
     */
    shareProductOnWhatsApp(businessId: string, chatId: string, productId: string, body?: string): Promise<import("./openwa.service").OpenWAMessageSendResult>;
    /**
     * Share the full business catalog to a WhatsApp chat.
     */
    shareCatalogOnWhatsApp(businessId: string, chatId: string, body?: string): Promise<import("./openwa.service").OpenWAMessageSendResult>;
    importEbayListings(businessId: string): Promise<ShowState>;
    dropEbayItemToWhatsApp(businessId: string, chatId: string, itemId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare const liveSellerService: LiveSellerService;
export {};
//# sourceMappingURL=live-seller.service.d.ts.map