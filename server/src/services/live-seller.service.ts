import { PrismaClient } from '@prisma/client';
import { LiveSellerPlatform } from '@prisma/client';

export type LiveSellerIntegrationInput = {
  platform: LiveSellerPlatform;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  shopId?: string;
  streamKey?: string;
  webhookUrl?: string;
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

export class LiveSellerService {
  constructor(private prisma: PrismaClient) {}

  async listForBusiness(businessId: string) {
    return this.prisma.liveSellerIntegration.findMany({ where: { businessId, isActive: true } });
  }

  async connect(businessId: string, input: LiveSellerIntegrationInput) {
    return this.prisma.liveSellerIntegration.upsert({
      where: { businessId_platform: { businessId, platform: input.platform } },
      update: {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
        scope: input.scope,
        shopId: input.shopId,
        streamKey: input.streamKey ?? undefined,
        webhookUrl: input.webhookUrl ?? undefined,
        metadata: { ...(input.metadata || {}), lastConnectError: null },
        lastSyncAt: new Date(),
        isActive: true,
        revokedAt: null,
      },
      create: { businessId, ...input },
    });
  }

  async disconnect(businessId: string, platform: LiveSellerPlatform) {
    return this.prisma.liveSellerIntegration.update({
      where: { businessId_platform: { businessId, platform } },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  private defaultShow(businessId: string, platform: LiveSellerPlatform): ShowState {
    return {
      isLive: false,
      title: undefined,
      streamKey: undefined,
      startedAt: undefined,
      viewerCount: undefined,
      items: [],
      recentOrders: [],
    };
  }

  async getShowState(businessId: string, platform: LiveSellerPlatform) {
    const integration = await this.prisma.liveSellerIntegration.findUnique({
      where: { businessId_platform: { businessId, platform } },
      select: { metadata: true, accessToken: true, refreshToken: true, isActive: true, lastSyncAt: true, id: true },
    });

    if (!integration || !integration.isActive) {
      return this.defaultShow(businessId, platform);
    }

    const metadata = (integration.metadata as any) || {};
    const current: ShowState = metadata.currentShow || this.defaultShow(businessId, platform);
    return {
      ...current,
      isLive: !!current?.isLive,
      items: Array.isArray(current?.items) ? current.items : [],
      recentOrders: Array.isArray(current?.recentOrders) ? current.recentOrders : [],
    };
  }

  async upsertShowState(businessId: string, platform: LiveSellerPlatform, patch: Partial<ShowState>) {
    const integration = await this.prisma.liveSellerIntegration.findUnique({
      where: { businessId_platform: { businessId, platform } },
      select: { id: true, metadata: true },
    });

    if (!integration) {
      throw new Error('Live selling integration not connected');
    }

    const metadata = (integration.metadata as any) || {};
    const current: ShowState = metadata.currentShow || this.defaultShow(businessId, platform);
    const next: ShowState = {
      ...current,
      ...patch,
      items: patch.items ?? current.items,
      recentOrders: patch.recentOrders ?? current.recentOrders,
    };

    await this.prisma.liveSellerIntegration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...metadata,
          currentShow: next,
          lastShowUpdateAt: new Date().toISOString(),
        },
      },
    });

    return next;
  }

  async addOrder(businessId: string, platform: LiveSellerPlatform, order: ShowState['recentOrders'][0]) {
    const integration = await this.prisma.liveSellerIntegration.findUnique({
      where: { businessId_platform: { businessId, platform } },
      select: { id: true, metadata: true, isActive: true },
    });

    if (!integration || !integration.isActive) {
      throw new Error('Live selling integration not connected');
    }

    const metadata = (integration.metadata as any) || {};
    const current: ShowState = metadata.currentShow || this.defaultShow(businessId, platform);
    const nextOrder = { ...order, id: order.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, createdAt: order.createdAt || new Date().toISOString() };
    const next: ShowState = {
      ...current,
      recentOrders: [nextOrder, ...current.recentOrders].slice(0, 50),
    };

    await this.prisma.liveSellerIntegration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...metadata,
          currentShow: next,
          lastOrderAt: nextOrder.createdAt,
        },
      },
    });

    return nextOrder;
  }
}

export const liveSellerService = new LiveSellerService(new PrismaClient());
