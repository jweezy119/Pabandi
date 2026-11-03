import { DataSourceAdapter, RawBusinessProfile } from './types';

export class ApifyAdapter implements DataSourceAdapter {
  readonly id = 'apify';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.apify.com/v2';

  constructor() {
    this.apiKey = process.env.APIFY_API_KEY || '';
  }

  async fetchBusinesses(query: any): Promise<RawBusinessProfile[]> {
    if (!this.apiKey) {
      throw new Error('APIFY_API_KEY is not configured');
    }

    const { country, state, category, limit = 50 } = query || {};

    try {
      // Call Apify actor for Freelancer.com scraper
      // Using a generic actor call pattern; the actor ID should be configured
      const actorId = process.env.APIFY_FREELANCER_ACTOR_ID || 'apify/freelancer-com-scraper';

      const runResp = await fetch(`${this.baseUrl}/acts/${actorId}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          country,
          state,
          category,
          maxItems: limit,
        }),
      });

      if (!runResp.ok) {
        throw new Error(`Apify run failed: ${runResp.status}`);
      }

      const runData = await runResp.json();
      const runId = runData.data?.id;

      if (!runId) {
        throw new Error('No run ID returned from Apify');
      }

      // Wait briefly and fetch dataset items
      // In production, this would poll until the run finishes
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const datasetResp = await fetch(
        `${this.baseUrl}/actor-runs/${runId}/dataset/items?limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }
      );

      if (!datasetResp.ok) {
        throw new Error(`Apify dataset fetch failed: ${datasetResp.status}`);
      }

      const items = await datasetResp.json();
      return items.map((item: Record<string, unknown>) => this.mapFreelancer(item));
    } catch (error) {
      throw new Error(`Apify fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private mapFreelancer(item: Record<string, unknown>): RawBusinessProfile {
    return {
      name: String(item.name || item.fullName || item.username || item.title || 'Unknown Freelancer'),
      address: String(item.location || item.city || item.address || ''),
      city: item.city ? String(item.city) : undefined,
      state: item.state ? String(item.state) : undefined,
      country: item.country ? String(item.country) : undefined,
      phone: item.phone ? String(item.phone) : undefined,
      email: item.email ? String(item.email) : undefined,
      website: item.profileUrl || item.url ? String(item.profileUrl || item.url) : undefined,
      googleRating: item.rating ? Number(item.rating) : undefined,
      reviewCount: item.reviews_count || item.reviewCount ? Number(item.reviews_count || item.reviewCount) : undefined,
      verificationStatus: item.verified ? 'verified' : 'pending',
      sourceId: item.id || item.username ? String(item.id || item.username) : undefined,
      source: 'apify',
    };
  }
}
