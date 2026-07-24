import { AxiosInstance } from 'axios';

export class TrustResource {
  constructor(private client: AxiosInstance) {}

  async verify(walletAddress: string, requiredTier?: string) {
    const body: Record<string, string> = { wallet_address: walletAddress };
    if (requiredTier) body.required_tier = requiredTier;
    const response = await this.client.post('/passport/verify', body);
    return response.data;
  }

  async eligibility(walletAddress: string, requiredTier: string) {
    const response = await this.client.post('/passport/eligibility', {
      wallet_address: walletAddress,
      required_tier: requiredTier,
    });
    return response.data;
  }

  async recordIncident(walletAddress: string, type: string, description?: string) {
    const response = await this.client.post('/passport/incidents', {
      wallet_address: walletAddress,
      type,
      description,
    });
    return response.data;
  }

  async publicProfile(sellerId: string) {
    const response = await this.client.get(`/passport/public/${encodeURIComponent(sellerId)}`);
    return response.data;
  }

  async publicReviews(sellerId: string) {
    const response = await this.client.get(`/passport/public/${encodeURIComponent(sellerId)}/reviews`);
    return response.data;
  }
}
