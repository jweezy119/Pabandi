export declare class EbayService {
    /**
     * Fetches active listings from the eBay Inventory API.
     * Note: This is an MVP stub returning mock data structured like real eBay responses.
     */
    fetchActiveListings(accessToken: string): Promise<{
        sku: string;
        product: {
            title: string;
            description: string;
            imageUrls: string[];
        };
        availability: {
            shipToLocationAvailability: {
                quantity: number;
            };
        };
        price: {
            value: string;
            currency: string;
        };
    }[]>;
}
export declare const ebayService: EbayService;
//# sourceMappingURL=ebay.service.d.ts.map