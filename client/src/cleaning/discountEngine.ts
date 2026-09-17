export class DiscountEngine {
  private discountTypes = {
    loyalty: 'loyalty',
    referral: 'referral',
    seasonal: 'seasonal',
    weekly: 'weekly',
    bulk: 'bulk'
  };

  /**
   * Apply a discount to a client
   * @param clientId - Client ID
   * @param discountType - Type of discount
   * @param discountValue - Discount amount or percentage
   * @returns Discount application result
   */
  applyDiscount(clientId: string, discountType: string, discountValue: number): any {
    const rules = {
      loyalty: (clientId) => {
        // Calculate loyalty bonus based on tenure
        const client = this.crmService.getClient(clientId);
        if (client.tenureMonths > 12) return 10;
        if (client.tenureMonths > 6) return 5;
        return 0;
      },
      referral: () => 20,
      seasonal: () => 15,
      weekly: () => 5,
      bulk: (clientId) => {
        // Bulk discount for frequent customers
        const client = this.crmService.getClient(clientId);
        if (client.monthlyVolume > 10) return 15;
        return 0;
      }
    };

    const discount = rules[discountType](clientId);
    if (discount) {
      return {
        type: discountType,
        amount: discount,
        appliedTo: clientId,
        expiresAt: new Date(Date.now() + 30 * 86400000) // 30 days
      };
    }
    return null;
  }

  /**
   * Get all active discounts for a client
   * @param clientId - Client ID
   * @returns Array of discount objects
   */
  getActiveDiscounts(clientId: string): any[] {
    const client = this.crmService.getClient(clientId);
    if (!client) throw new Error(`Client ${clientId} not found`);
    
    const discounts = [];
    
    // Loyalty discount
    if (client.tenureMonths > 6) {
      discounts.push({
        type: 'loyalty',
        amount: 5,
        description: 'Loyalty bonus for 6+ month tenure'
      });
    }
    
    // Referral discount
    if (client.referralsCount > 0) {
      discounts.push({
        type: 'referral',
        amount: 20,
        description: 'Referral reward for new client'
      });
    }
    
    // Seasonal discount
    if (this.isSeasonalDiscountActive()) {
      discounts.push({
        type: 'seasonal',
        amount: 15,
        description: 'Summer promotion'
      });
    }
    
    return discounts;
  }

  private isSeasonalDiscountActive(): boolean {
    // Check if current date falls within seasonal promotion period
    const today = new Date();
    const seasonStart = new Date('2026-06-01'); // Example: Summer season
    const seasonEnd = new Date('2026-08-31');
    return today >= seasonStart && today <= seasonEnd;
  }
}

export default DiscountEngine;