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

  /**
   * Merge a settings patch, keeping custom fields in ONE place.
   *
   * WHY THIS NORMALISES
   * `BusinessSettings` has a dedicated `customFields` column AND an `enabledFeatures` JSON
   * bag. The bag is a feature-flag store and is used as one across the app --
   * `enabledFeatures['contact']` gates a page, `.notifications` holds notification
   * preferences, the trust page keeps its own keys. A field SCHEMA is not a feature flag: it
   * has a different shape and a different lifecycle, and burying it in the bag is what let
   * `CustomFieldsPage` (which writes `enabledFeatures.customFields`) and `GET /crm/settings`
   * (which reads `customFields`) drift apart and 404 the CRM's custom fields for two audit
   * cycles.
   *
   * `customFields` is canonical. This accepts the field definitions from EITHER place a
   * caller might send them and always persists them to the column, so no caller has to know
   * the rule and no legacy shape can quietly become a second home again. The key is stripped
   * out of `enabledFeatures` on the way through, so the bag goes back to holding only flags.
   *
   * `enabledFeatures` is MERGED rather than replaced, because every settings page sends the
   * whole bag it knows about: replacing it would let `CustomFieldsPage` saving custom fields
   * silently wipe a business's notification preferences. That is the same class of bug as the
   * partial deal import.
   */
  static async updateSettings(businessId: string, data: any) {
    const patch: Record<string, unknown> = { ...(data ?? {}) };

    const fromBag =
      patch.enabledFeatures &&
      typeof patch.enabledFeatures === 'object' &&
      (patch.enabledFeatures as Record<string, unknown>).customFields;
    const fromTop = patch.customFields;

    // Explicit top-level wins over the legacy nested position.
    const canonical = fromTop ?? fromBag;

    if (canonical !== undefined) {
      patch.customFields = canonical;
      if (patch.enabledFeatures && typeof patch.enabledFeatures === 'object') {
        const bag = { ...(patch.enabledFeatures as Record<string, unknown>) };
        delete bag.customFields;
        patch.enabledFeatures = bag;
      }
    }

    const existing = await prisma.businessSettings.findUnique({
      where: { businessId },
      select: { enabledFeatures: true },
    });

    if (patch.enabledFeatures !== undefined && existing?.enabledFeatures) {
      patch.enabledFeatures = {
        ...(existing.enabledFeatures as Record<string, unknown>),
        ...(patch.enabledFeatures as Record<string, unknown>),
      };
    }

    return await prisma.businessSettings.upsert({
      where: { businessId },
      update: patch,
      create: {
        businessId,
        ...patch,
      },
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
