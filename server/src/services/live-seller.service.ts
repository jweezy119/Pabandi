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

export class LiveSellerService {
  constructor(private prisma: PrismaClient) {}

  async listForBusiness(businessId: string) {
    return this.prisma.liveSellerIntegration.findMany({ where: { businessId, isActive: true } });
  }

  async connect(businessId: string, input: LiveSellerIntegrationInput) {
    return this.prisma.liveSellerIntegration.upsert({
      where: { businessId_platform: { businessId, platform: input.platform } },
      update: { accessToken: input.accessToken, refreshToken: input.refreshToken, expiresAt: input.expiresAt, scope: input.scope, shopId: input.shopId, streamKey: input.streamKey, webhookUrl: input.webhookUrl, metadata: input.metadata, lastSyncAt: new Date(), isActive: true, revokedAt: null },
      create: { businessId, ...input },
    });
  }

  async disconnect(businessId: string, platform: LiveSellerPlatform) {
    return this.prisma.liveSellerIntegration.update({ where: { businessId_platform: { businessId, platform } }, data: { isActive: false, revokedAt: new Date() } });
  }
}

export const liveSellerService = new LiveSellerService(new PrismaClient());
