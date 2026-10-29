import { apiClient } from './api';

export interface GuaranteePolicy {
  id: string;
  merchantId: string;
  buyerId: string;
  buyerRiskBand: string;
  transactionAmountUSD: number;
  guaranteedAmountUSD: number;
  feeUSD: number;
  feePercent: number;
  status: string;
  coverageType: string;
  createdAt: number;
  expiresAt: number;
  transactionId?: string;
  claimId?: string;
}

export interface GuaranteeClaim {
  id: string;
  policyId: string;
  merchantId: string;
  claimType: 'FRAUD' | 'NO_SHOW';
  claimAmountUSD: number;
  evidence: string;
  status: string;
  submittedAt: number;
  resolvedAt?: number;
  payoutAmountUSD?: number;
  denialReason?: string;
}

export interface RiskPoolStats {
  totalGuaranteedUSD: number;
  totalFeesCollectedUSD: number;
  totalPayoutsUSD: number;
  netRevenueUSD: number;
  lossRatio: number;
  activePolicies: number;
  pendingClaims: number;
}

export interface GuaranteeEligibility {
  eligible: boolean;
  riskBand: string;
  guaranteedAmountUSD: number;
  feeUSD: number;
  feePercent: number;
  coverageDescription: string;
}

export const trustGuaranteeService = {
  purchaseGuarantee: (
    merchantId: string,
    buyerId: string,
    transactionAmountUSD: number,
    buyerTrustScore: number
  ) =>
    apiClient.post('/trust/guarantee/purchase', {
      merchantId,
      buyerId,
      transactionAmountUSD,
      buyerTrustScore,
    }),

  getRiskPoolStats: () =>
    apiClient.get('/trust/guarantee/pool-stats'),

  getEligibility: (buyerTrustScore: number, transactionAmountUSD: number) =>
    apiClient.get('/trust/guarantee/eligibility', {
      params: { buyerTrustScore, transactionAmountUSD },
    }),

  fileClaim: (
    policyId: string,
    merchantId: string,
    claimType: 'FRAUD' | 'NO_SHOW',
    claimAmountUSD: number,
    evidence: string
  ) =>
    apiClient.post('/trust/guarantee/claim', {
      policyId,
      merchantId,
      claimType,
      claimAmountUSD,
      evidence,
    }),
};

export const trustGuarantee = new (class {
  activePolicies: Map<string, GuaranteePolicy> = new Map();
  claims: Map<string, GuaranteeClaim> = new Map();
  totalGuaranteedUSD = 0;
  totalFeesCollectedUSD = 0;
  totalPayoutsUSD = 0;

  purchaseGuarantee(
    merchantId: string,
    buyerId: string,
    transactionAmountUSD: number,
    buyerTrustScore: number
  ): GuaranteePolicy | { error: string } {
    const riskBand = buyerTrustScore >= 800 ? 'A' : buyerTrustScore >= 600 ? 'B' : 'C';
    const guaranteeMaxUSD = riskBand === 'A' ? 1000 : riskBand === 'B' ? 500 : 0;
    const feePercent = riskBand === 'A' ? 0.5 : riskBand === 'B' ? 1.0 : 0;

    if (guaranteeMaxUSD <= 0) {
      return { error: `Buyer's risk band (${riskBand}) is not eligible for guarantees.` };
    }

    const guaranteedAmount = Math.min(transactionAmountUSD, guaranteeMaxUSD);
    const feeUSD = Math.round(guaranteedAmount * (feePercent / 100) * 100) / 100;

    const policy: GuaranteePolicy = {
      id: `guar_${cryptoRandom()}`,
      merchantId,
      buyerId,
      buyerRiskBand: riskBand,
      transactionAmountUSD,
      guaranteedAmountUSD: guaranteedAmount,
      feeUSD,
      feePercent,
      status: 'ACTIVE',
      coverageType: 'BOTH',
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    this.activePolicies.set(policy.id, policy);
    this.totalGuaranteedUSD += guaranteedAmount;
    this.totalFeesCollectedUSD += feeUSD;

    return policy;
  }

  getRiskPoolStats(): RiskPoolStats {
    const pendingClaims = Array.from(this.claims.values()).filter(
      c => c.status === 'PENDING' || c.status === 'UNDER_REVIEW'
    ).length;

    return {
      totalGuaranteedUSD: Math.round(this.totalGuaranteedUSD * 100) / 100,
      totalFeesCollectedUSD: Math.round(this.totalFeesCollectedUSD * 100) / 100,
      totalPayoutsUSD: Math.round(this.totalPayoutsUSD * 100) / 100,
      netRevenueUSD: Math.round((this.totalFeesCollectedUSD - this.totalPayoutsUSD) * 100) / 100,
      lossRatio: this.totalFeesCollectedUSD > 0
        ? Math.round((this.totalPayoutsUSD / this.totalFeesCollectedUSD) * 1000) / 1000
        : 0,
      activePolicies: Array.from(this.activePolicies.values()).filter(p => p.status === 'ACTIVE').length,
      pendingClaims,
    };
  }

  getEligibility(buyerTrustScore: number, transactionAmountUSD: number): GuaranteeEligibility {
    const riskBand = buyerTrustScore >= 800 ? 'A' : buyerTrustScore >= 600 ? 'B' : 'C';
    const guaranteeMaxUSD = riskBand === 'A' ? 1000 : riskBand === 'B' ? 500 : 0;
    const feePercent = riskBand === 'A' ? 0.5 : riskBand === 'B' ? 1.0 : 0;

    if (guaranteeMaxUSD <= 0) {
      return {
        eligible: false,
        riskBand,
        guaranteedAmountUSD: 0,
        feeUSD: 0,
        feePercent: 0,
        coverageDescription: `Band ${riskBand} is not eligible for guarantees. Minimum Band B required.`,
      };
    }

    const guaranteedAmount = Math.min(transactionAmountUSD, guaranteeMaxUSD);
    const feeUSD = Math.round(guaranteedAmount * (feePercent / 100) * 100) / 100;

    return {
      eligible: true,
      riskBand,
      guaranteedAmountUSD: guaranteedAmount,
      feeUSD,
      feePercent,
      coverageDescription: `Band ${riskBand}: Up to $${guaranteedAmount} guaranteed against fraud and no-shows.`,
    };
  }
})();

function cryptoRandom(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
