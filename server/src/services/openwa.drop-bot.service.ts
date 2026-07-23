import { prisma } from '../utils/database';

export const openwaDropBotService = {
  isDropCommand(message: string): boolean {
    return message.trim().toLowerCase().startsWith('!drop');
  },

  async handleDropCommand(businessId: string, message: string): Promise<string> {
    // Expected format: !drop [price] [item name]
    // Example: !drop 500 Vintage Nike Jacket
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

    const businessSlug = business.slug || business.id;

    // Create the item in the database
    const service = await prisma.businessService.create({
      data: {
        businessId,
        name: itemName,
        price,
        duration: 0, // Not applicable for physical products, default to 0
        isActive: true,
      }
    });

    const encodedItem = encodeURIComponent(service.name);
    const link = `https://pabandi.com/s/${businessSlug}?item=${encodedItem}&price=${price}&mode=instant`;

    return `🔥 DROP LIVE 🔥\n${itemName} - $${price}\n\nSecure it instantly via Web3 Escrow:\n${link}`;
  }
};
