export interface PaymentAdapter {
  id: string;
  supportsEscrow: boolean;
  authorize(amount: number, currency: string, metadata: any): Promise<{ success: boolean; authId?: string; clientSecret?: string }>;
  capture(authId: string, amount?: number): Promise<{ success: boolean; captureId?: string }>;
  refund(captureId: string, amount?: number): Promise<{ success: boolean; refundId?: string }>;
  createAgentCheckout(protocol: 'acp' | 'x402' | 'ap2' | 'ucp', metadata: any): Promise<{ success: boolean; checkoutUrl?: string; challenge?: any }>;
}

export interface PaymentContext {
  amount: number;
  currency: string;
  clientCountry?: string;
  isAgent?: boolean;
  metadata?: any;
}
