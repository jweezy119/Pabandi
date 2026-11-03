export interface RawBusinessProfile {
  name: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  lat?: number;
  lng?: number;
  googleRating?: number;
  reviewCount?: number;
  verificationStatus?: 'verified' | 'unverified' | 'pending';
  sourceId?: string;
  source: 'opendirectories' | 'apify' | 'googlemaps';
}

export interface DataSourceAdapter {
  id: string;
  fetchBusinesses(query: any): Promise<RawBusinessProfile[]>;
}

export interface IngestionResult {
  adapterId: string;
  totalFetched: number;
  totalUpserted: number;
  businesses: RawBusinessProfile[];
  errors: Array<{ index: number; error: string }>;
}
