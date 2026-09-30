export interface TrustScore {
  payment: number;
  showUp: number;
  delivery: number;
  tenancy: number;
  freight: number;
}

export interface PassportProfile {
  handle: string;
  displayName: string;
  category: string;
  walletAddress?: string;
  claimsCount: number;
  scores: TrustScore;
  verifiedIdentity: boolean;
  issuedAt: string;
}

export interface EscrowParty {
  partyId: string;
  role: 'buyer' | 'seller' | 'broker';
}

export interface EscrowCondition {
  type: 'delivery' | 'milestone' | 'checkin' | 'manual';
  verify: Record<string, any>;
}

export interface PabandiClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class PabandiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: PabandiClientOptions = {}) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || 'https://api.pabandi.com';
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, { ...options, headers });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  }

  // Trust API
  async resolve(identifier: string): Promise<PassportProfile> {
    const json = await this.request(`/api/v1/trust/resolve/${encodeURIComponent(identifier)}`);
    return json.data;
  }

  async credential(passportId: string): Promise<{ credential: string; publicKeyUrl: string }> {
    const json = await this.request(`/api/v1/trust/credential/${passportId}`);
    return json.data;
  }

  // Escrow API
  async createEscrow(input: {
    referenceId: string;
    template: string;
    parties: EscrowParty[];
    amount: number;
    currency?: string;
    conditions: EscrowCondition[];
    deadline?: string;
    metadata?: Record<string, any>;
  }) {
    return this.request('/api/v1/escrow', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getEscrow(referenceId: string) {
    return this.request(`/api/v1/escrow/${referenceId}`);
  }

  async updateEscrowStatus(referenceId: string, status: string) {
    return this.request(`/api/v1/escrow/${referenceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Staking API
  async getStakingPosition() {
    return this.request('/api/v1/pab-staking/position');
  }

  async stake(amountPab: number, durationDays: number) {
    return this.request('/api/v1/pab-staking/stake', {
      method: 'POST',
      body: JSON.stringify({ amountPab, durationDays }),
    });
  }

  // Referral API
  async createReferral(email: string) {
    return this.request('/api/v1/pab-staking/referral', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
}

export default PabandiClient;
