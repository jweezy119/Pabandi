import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SettingsService {
  // We use CrmBusiness ID to map to BusinessSettings businessId
  static async getSettings(businessId: string) {
    let settings = await prisma.businessSettings.findUnique({
      where: { businessId }
    });

    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {
          businessId,
          enabledFeatures: {},
          enabledModules: []
        }
      });
    }
    return settings;
  }

  static async updateSettings(businessId: string, data: any) {
    return await prisma.businessSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        businessId,
        ...data
      }
    });
  }

  static async getBusinessProfile(businessId: string) {
    return await prisma.crmBusiness.findUnique({
      where: { id: businessId }
    });
  }

  static async updateBusinessProfile(businessId: string, data: any) {
    return await prisma.crmBusiness.update({
      where: { id: businessId },
      data
    });
  }

  static async getApiKeys(businessId: string) {
    return await prisma.apiKey.findMany({
      where: { managerId: businessId }
    });
  }

  static async createApiKey(businessId: string, data: any) {
    return await prisma.apiKey.create({
      data: {
        managerId: businessId,
        name: data.name,
        key: `pk_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`,
        permissions: data.permissions || {}
      }
    });
  }

  static async revokeApiKey(id: string) {
    return await prisma.apiKey.update({
      where: { id },
      data: { isActive: false }
    });
  }

  static async getWebhooks(businessId: string) {
    return await prisma.webhookEndpoint.findMany({
      where: { businessId }
    });
  }

  static async createWebhook(businessId: string, data: any) {
    return await prisma.webhookEndpoint.create({
      data: {
        businessId,
        targetUrl: data.targetUrl,
        subscribedEvents: data.subscribedEvents || [],
        signingSecret: `whsec_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`
      }
    });
  }

  static async deleteWebhook(id: string) {
    return await prisma.webhookEndpoint.delete({
      where: { id }
    });
  }
}
