import { AxiosInstance } from 'axios';

declare class BusinessResource {
    private client;
    constructor(client: AxiosInstance);
    list(params?: any): Promise<any>;
    getById(id: string): Promise<any>;
    getMyBusiness(): Promise<any>;
    register(data: any): Promise<any>;
    getCustomers(): Promise<any>;
}

declare class AuthResource {
    private client;
    constructor(client: AxiosInstance);
    register(data: any): Promise<any>;
    login(data: any): Promise<any>;
    getMe(): Promise<any>;
}

declare class ReliabilityResource {
    private client;
    constructor(client: AxiosInstance);
    getMatrix(userId: string): Promise<any>;
    verifyIdentity(data: any): Promise<any>;
}

declare class TrustResource {
    private client;
    constructor(client: AxiosInstance);
    verify(walletAddress: string, requiredTier?: string): Promise<any>;
    eligibility(walletAddress: string, requiredTier: string): Promise<any>;
    recordIncident(walletAddress: string, type: string, description?: string): Promise<any>;
    publicProfile(sellerId: string): Promise<any>;
    publicReviews(sellerId: string): Promise<any>;
}

interface EscrowCheckoutInput {
    sellerId: string;
    amount: number;
    currency?: string;
    buyerWallet?: string;
    reference?: string;
    channel?: 'SHOPIFY' | 'LIVE_SELLER' | 'FREELANCE' | 'HOSPITALITY' | 'UNIVERSAL';
    metadata?: Record<string, unknown>;
}
interface EscrowCheckoutResult {
    success: boolean;
    checkoutAllowed?: boolean;
    score?: number;
    tier?: string;
    actionRequired?: string;
    checkoutUrl?: string;
    sessionId?: string;
}
declare class EscrowResource {
    private client;
    constructor(client: AxiosInstance);
    createCheckout(input: EscrowCheckoutInput): Promise<EscrowCheckoutResult>;
    verifyBeforeCheckout(buyerWallet: string, requiredTier?: string): Promise<any>;
}

interface PabandiClientOptions {
    apiKey?: string;
    bearerToken?: string;
    environment?: 'production' | 'development' | 'local';
}
declare class PabandiClient {
    private client;
    business: BusinessResource;
    auth: AuthResource;
    reliability: ReliabilityResource;
    trust: TrustResource;
    escrow: EscrowResource;
    constructor(options: PabandiClientOptions);
}

export { AuthResource, BusinessResource, type EscrowCheckoutInput, type EscrowCheckoutResult, EscrowResource, PabandiClient, type PabandiClientOptions, ReliabilityResource, TrustResource };
