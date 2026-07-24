import { prisma } from '../utils/database';
import { catalogService } from './catalog.service';

export const openwaDropBotService = {
  isDropEngineCommand(message: string): boolean {
    const lower = message.trim().toLowerCase();
    return lower.startsWith('!drop') || lower.startsWith('!buy') || lower.startsWith('!catalog');
  },

  async handleDropEngineCommand(businessId: string, customerPhone: string, message: string): Promise<string> {
    const lower = message.trim().toLowerCase();
    
    if (lower.startsWith('!drop')) {
      return this.handleDropCommand(businessId, message);
    } else if (lower.startsWith('!buy')) {
      return this.handleBuyCommand(businessId, customerPhone, message);
    } else if (lower.startsWith('!catalog')) {
      return this.handleCatalogCommand(businessId);
    }
    
    return "Unknown command.";
  },

  async handleDropCommand(businessId: string, message: string): Promise<string> {
    // Expected format: !drop [price] [item name]
    const parts = message.trim().split(/\s+/);
    if (parts.length < 3) {
      return "Format: !drop [price] [item name]";
    }

    const price = parseFloat(parts[1]);
    if (isNaN(price)) {
      return "Format error: price must be a number.";
    }

    const itemName = parts.slice(2).join(' ');

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return "Error: Business not found.";
    }

    const service = await prisma.businessService.create({
      data: {
        businessId,
        name: itemName,
        price,
        duration: 0,
        isActive: true,
      }
    });

    const encodedItem = encodeURIComponent(service.name);
    
    // Create an actual checkout session for the drop
    const checkoutSession = await prisma.checkoutSession.create({
      data: {
        businessId,
        amount: price,
        currency: 'USD',
        successUrl: `https://pabandi.com/s/${business.slug || business.id}?success=true`,
        cancelUrl: `https://pabandi.com/s/${business.slug || business.id}`,
        metadata: { source: 'drop_bot_drop', serviceId: service.id, itemName: service.name },
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    const link = `https://pabandi.com/checkout/${checkoutSession.id}`;

    return `🔥 DROP LIVE 🔥\n${itemName} - $${price}\n\nReply !buy ${service.id} or tap here:\n${link}`;
  },
  
  async handleBuyCommand(businessId: string, customerPhone: string, message: string): Promise<string> {
    const parts = message.trim().split(/\s+/);
    if (parts.length < 2) {
      return "Format: !buy [item_id]";
    }
    
    const itemId = parts[1];
    
    const service = await catalogService.getProduct(businessId, itemId);
    if (!service) {
      return "Item not found or no longer available.";
    }
    
    const inStock = await catalogService.validateStock(itemId);
    if (!inStock) {
      return "Sorry, this item is out of stock!";
    }
    
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    
    // Create an actual checkout session for the buyer
    const checkoutSession = await prisma.checkoutSession.create({
      data: {
        businessId,
        amount: service.price,
        currency: 'USD',
        successUrl: `https://pabandi.com/s/${business?.slug || business?.id}?success=true`,
        cancelUrl: `https://pabandi.com/s/${business?.slug || business?.id}`,
        metadata: { source: 'drop_bot_buy', serviceId: service.id, itemName: service.name, customerPhone },
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour expiry
      }
    });
    
    const link = `https://pabandi.com/checkout/${checkoutSession.id}`;
    
    return `🛍️ Great choice! Secure your ${service.name} ($${service.price}) instantly via Web3 Escrow:\n${link}`;
  },
  
  async handleCatalogCommand(businessId: string): Promise<string> {
    const services = await catalogService.getCatalog(businessId);
    
    if (services.length === 0) {
      return "No active drops right now. Stay tuned!";
    }
    
    const lines = ["📋 *Available Drops*"];
    services.forEach(s => {
      lines.push(`• ${s.name} - $${s.price} (!buy ${s.id})`);
    });
    
    return lines.join('\n');
  }
};
