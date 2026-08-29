export interface EcommerceFeatures {
    role: 'BUYER' | 'SELLER';
    buyerHistory?: {
        totalOrders: number;
        cancellationRate: number;
        returnRate: number;
    };
    buyerPaymentFactors?: {
        prefersCOD: boolean;
        paymentFailureRate: number;
    };
    buyerDeliveryFactors?: {
        codRejectionRate: number;
        addressChanges: number;
    };
    sellerFulfillmentHistory?: {
        totalOrdersFulfilled: number;
        onTimeShippingRate: number;
        outOfStockCancellationRate: number;
    };
    sellerQualityFactors?: {
        returnRefundRate: number;
        disputeRate: number;
        averageReviewScore: number;
    };
    sellerPlatformFactors?: {
        accountAgeDays: number;
        isVerified: boolean;
    };
}
export interface EcommercePredictionResult {
    role: 'BUYER' | 'SELLER';
    trustScore: number;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    factors: Record<string, number>;
    recommendation: {
        action: string;
        details: string;
        paymentRoutingAdvice: string;
    };
}
export declare class EcommerceReliabilityPredictor {
    /**
     * Predict reliability for an E-Commerce actor (Buyer or Seller)
     */
    predict(features: EcommerceFeatures): Promise<EcommercePredictionResult>;
    private ruleBasedPrediction;
    private getRiskLevel;
}
export declare const ecommerceReliabilityPredictor: EcommerceReliabilityPredictor;
//# sourceMappingURL=ecommerceReliabilityPredictor.d.ts.map