import { prisma } from '../utils/database';

export const openwaDropBotService = {
  isDropCommand(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return normalized === '!drop' || normalized.startsWith('!drop ');
  },

  isClaimCommand(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return normalized === '/claim' || normalized === 'claim';
  },

  isCloseCommand(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return normalized === '/close-drop' || normalized === 'close drop';
  },

  async handleDropCommand(businessId: string, message: string, ownerPhone?: string): Promise<string> {
    const trimmed = message.trim();
    const segments = trimmed.split(/\s+/).slice(1);
    if (segments.length === 0) {
      return this.getUsageHint(businessId);
    }
    if (segments.length < 2) {
      return "Format error: provide price and item name, e.g. `!drop 500 Vintage Jacket`.";
    }
    const [priceSegment, ...rest] = segments;
    const price = Number(priceSegment);
    if (!price || Number.isNaN(price) || price <= 0) {
      return "Price must be a positive number, e.g. `!drop 500 Vintage Jacket`.";
    }
    const name = rest.join(' ').trim();
    if (!name) {
      return "Item name is empty. Use e.g. `!drop 500 Vintage Jacket`.";
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return "Business not found. Complete your business profile before publishing drops.";
    }
    if (ownerPhone && !this.isOwnerPhone(business, ownerPhone)) {
      return "Unauthorized: only the business owner can publish drops from this line.";
    }

    const service = await prisma.businessService.create({
      data: {
        businessId,
        name,
        description: 'WhatsApp Drop',
        price,
        duration: 0,
        isActive: false,
      },
    });

    const slug = business.slug || business.id;
    const encodedItem = encodeURIComponent(service.name);
    const link = `https://pabandi.com/s/${slug}?item=${encodedItem}&price=${price}&mode=instant`;

    return [
      '🔥 DROP PUBLISHED',
      `${service.name} — $${price}`,
      '',
      'Secure checkout link:',
      link,
      '',
      'Need a recap? Reply STATUS.',
      'Need a human? Reply /human.',
    ].join('\n');
  },

  async handleCloseCommand(businessId: string, message: string, ownerPhone?: string): Promise<string> {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return "Business not found.";
    }
    if (ownerPhone && !this.isOwnerPhone(business, ownerPhone)) {
      return "Unauthorized: only the business owner can close drops from this line.";
    }

    const services = await prisma.businessService.findMany({
      where: { businessId, isActive: false, description: 'WhatsApp Drop' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (!services.length) {
      return 'No WhatsApp drops are currently open.';
    }

    let reply = 'Closing all open WhatsApp drops:\n';
    let closed = 0;
    for (const service of services) {
      await prisma.businessService.update({
        where: { id: service.id },
        data: { isActive: true },
      });
      reply += `- ${service.name} ($${service.price})\n`;
      closed++;
    }
    return `${reply}\nClosed ${closed} drop${closed === 1 ? '' : 's'}.`;
  },

  async handleClaimCommand(businessId: string, message: string, customerPhone: string): Promise<{ text: string; paymentUrl?: string }> {
    const serviceName = message.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!serviceName) {
      return { text: 'Claim format: `/claim [item name]`. Example: `/claim Vintage Jacket`.' };
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return { text: 'Business not found.' };
    }
    const slug = business.slug || business.id;

    const service = await prisma.businessService.findFirst({
      where: {
        businessId,
        name: { equals: serviceName, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!service) {
      return { text: `No matching drop found for "${serviceName}".` };
    }

    let paymentUrl: string | undefined;
    try {
      const checkout = await prisma.checkoutSession.create({
        data: {
          businessId,
          amount: service.price,
          currency: 'USD',
          status: 'PENDING',
          successUrl: `${process.env.FRONTEND_URL || 'https://pabandi-42c5b.web.app'}/checkout/${businessId}/success`,
          cancelUrl: `${process.env.FRONTEND_URL || 'https://pabandi-42c5b.web.app'}/checkout/${businessId}/cancel`,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          metadata: { customerPhone: customerPhone.replace(/[^\d]/g, ''), serviceId: service.id, serviceName: service.name },
        },
      });
      paymentUrl = `https://pabandi.com/checkout/${checkout.id}?mode=instant`;
    } catch (err) {
      console.error('[Drop Claim Checkout]', err);
    }

    const text = [
      '📦 CLAIM REQUEST RECEIVED',
      `${service.name} — $${service.price}`,
      '',
      paymentUrl ? `Confirm and pay: ${paymentUrl}` : 'Payment link unavailable; try again in a moment.',
    ].join('\n');

    return { text, paymentUrl };
  },

  async listDrops(businessId: string): Promise<Array<{ id: string; name: string; price: number; isActive: boolean; createdAt: string }>> {
    const services = await prisma.businessService.findMany({
      where: { businessId, description: 'WhatsApp Drop' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      price: service.price,
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
    }));
  },

  isOwnerPhone(business: { phone?: string | null; ownerPhone?: string | null }, phone: string): boolean {
    const normalizedBusinessPhone = this.normalizePhone(business.phone);
    const normalizedOwnerPhone = this.normalizePhone(business.ownerPhone);
    const normalizedSender = this.normalizePhone(phone);
    return Boolean(normalizedSender && (normalizedSender === normalizedBusinessPhone || normalizedSender === normalizedOwnerPhone));
  },

  normalizePhone(phone?: string | null): string {
    if (!phone) return '';
    return phone.replace(/[^\d]/g, '');
  },

  getUsageHint(businessId: string): string {
    const link = `https://pabandi.com/s/YOUR-BUSINESS?item=${encodeURIComponent('Your Drop')}&price=0&mode=instant`;
    return [
      'Format: `!drop [price] [item name]`',
      'Example: `!drop 500 Vintage Jacket`',
      '',
      'Draft checkout:',
      link,
      '',
      'Need help? Reply /menu.',
    ].join('\n');
  },
};
