import { logger } from '../utils/logger';

export class EbayService {
  /**
   * Fetches active listings from the eBay Inventory API.
   * Note: This is an MVP stub returning mock data structured like real eBay responses.
   */
  async fetchActiveListings(accessToken: string) {
    logger.info(`[EbayService] Fetching eBay inventory using token: ${accessToken.substring(0, 10)}...`);
    
    // Simulating API latency
    await new Promise(resolve => setTimeout(resolve, 500));

    return [
      {
        sku: 'IPHONE-14-PRO-128',
        product: {
          title: 'iPhone 14 Pro 128GB - Unlocked',
          description: 'Pristine condition, battery health 98%',
          imageUrls: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=400']
        },
        availability: { shipToLocationAvailability: { quantity: 5 } },
        price: { value: '899.00', currency: 'USD' }
      },
      {
        sku: 'SONY-WH1000XM5',
        product: {
          title: 'Sony WH-1000XM5 Noise Canceling Headphones',
          description: 'Brand new in box, sealed.',
          imageUrls: ['https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=400']
        },
        availability: { shipToLocationAvailability: { quantity: 2 } },
        price: { value: '349.00', currency: 'USD' }
      },
      {
        sku: 'VINTAGE-ROLEX-SUBMARINER',
        product: {
          title: 'Rolex Submariner Date 16610 (1998)',
          description: 'Excellent vintage condition. Includes box and papers.',
          imageUrls: ['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=400']
        },
        availability: { shipToLocationAvailability: { quantity: 1 } },
        price: { value: '9500.00', currency: 'USD' }
      }
    ];
  }
}

export const ebayService = new EbayService();
