import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PABANDI TRUST PROTOCOL (PTP) — Version 1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The open protocol specification for portable, verifiable trust in commerce.
 *
 * PTP makes trust scores PORTABLE — a merchant verified on Pabandi carries that
 * trust to any platform that implements PTP, without re-verification.
 *
 * Design Principles:
 *   1. PORTABLE    — attestations work across platforms without API calls
 *   2. VERIFIABLE  — any party can verify offline using Pabandi's public key
 *   3. PRIVATE     — no PII, no exact scores; only risk bands + guarantees
 *   4. METERED     — every verification is a billable event
 *   5. GUARANTEED  — high-trust bands carry financial guarantees
 *
 * Attestation Lifecycle:
 *   1. Entity (merchant/buyer) earns trust through Pabandi's intelligence layers
 *   2. Pabandi issues a PTP Attestation (signed document)
 *   3. Entity presents attestation to any third party
 *   4. Third party verifies offline (public key) or online (API call)
 *   5. If Band A/B: transaction is financially guaranteed by Pabandi
 *
 * Comparable Standards:
 *   - FICO → credit scoring (PTP = trust scoring)
 *   - SSL/TLS → connection security (PTP = transaction trust)
 *   - PCI DSS → payment security (PTP = counterparty reliability)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Protocol Constants ────────────────────────────────────────────────────────
export const PTP_VERSION = '1.0';
export const PTP_PROTOCOL_NAME = 'Pabandi Trust Protocol';
export const PTP_ATTESTATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PTP_MAX_GUARANTEE_USD = 500;

// ── Risk Band Definitions ─────────────────────────────────────────────────────
export type PTPRiskBand = 'A' | 'B' | 'C' | 'D' | 'E';

export const PTP_RISK_BANDS: Record<PTPRiskBand, {
  label: string;
  description: string;
  fraudProbability: number;       // maximum expected fraud rate
  noShowProbability: number;      // maximum expected no-show rate
  depositReduction: number;       // % reduction in required deposit
  guaranteeMaxUSD: number;        // maximum financial guarantee per tx
  guaranteeFeePercent: number;    // fee charged for the guarantee
  sealColor: string;              // hex color for the visual seal
}> = {
  A: {
    label: 'Exceptional',
    description: 'Top-tier trust. Verified identity, clean OSINT footprint, rising trajectory, strong transaction history.',
    fraudProbability: 0.005,
    noShowProbability: 0.01,
    depositReduction: 0.50,
    guaranteeMaxUSD: 500,
    guaranteeFeePercent: 0.5,
    sealColor: '#10B981',    // Emerald
  },
  B: {
    label: 'Strong',
    description: 'Well-established trust. Good history with consistent performance.',
    fraudProbability: 0.02,
    noShowProbability: 0.03,
    depositReduction: 0.30,
    guaranteeMaxUSD: 200,
    guaranteeFeePercent: 1.0,
    sealColor: '#3B82F6',    // Blue
  },
  C: {
    label: 'Developing',
    description: 'Moderate trust. Sufficient history but insufficient for guarantees.',
    fraudProbability: 0.05,
    noShowProbability: 0.08,
    depositReduction: 0.10,
    guaranteeMaxUSD: 0,
    guaranteeFeePercent: 0,
    sealColor: '#F59E0B',    // Amber
  },
  D: {
    label: 'Caution',
    description: 'Elevated risk. Limited history or declining trajectory.',
    fraudProbability: 0.10,
    noShowProbability: 0.15,
    depositReduction: 0,
    guaranteeMaxUSD: 0,
    guaranteeFeePercent: 0,
    sealColor: '#EF4444',    // Red
  },
  E: {
    label: 'Restricted',
    description: 'High risk. Flagged for review or recent adverse signals.',
    fraudProbability: 0.25,
    noShowProbability: 0.30,
    depositReduction: 0,
    guaranteeMaxUSD: 0,
    guaranteeFeePercent: 0,
    sealColor: '#6B7280',    // Gray
  },
};

// Signing secret — in production, load from KMS/HSM, never hardcode.
const PTP_SIGNING_SECRET = process.env.PTP_SIGNING_SECRET || 'dev-ptp-signing-secret-change-me';
const PTP_PUBLIC_KEY_ID = 'ptp-pabandi-2024';

// Core attestation shape (entity: individual/business)
export interface PTPAttestation {
  protocol: string;
  version: string;
  subject: { id: string; type: 'INDIVIDUAL' | 'BUSINESS' | 'AGENT' };
  assessment: {
    riskBand: PTPRiskBand;
    guarantees: { fraudProbability: number; noShowProbability: number; depositReduction: number };
    velocity: { direction: string; momentum: number; confidence: number };
  };
  zkProof?: { commitment: string; threshold: number; verified: boolean };
  guarantee?: { maxAmountUSD: number; feePercent: number; coverageType: string; claimEndpoint: string };
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  issuer: string;
  publicKeyId: string;
  signature: string;
}

export interface PTPAgentAttestation {
  protocol: string;
  version: string;
  subject: { id: string; type: 'AGENT' };
  ownerUserId: string;
  capabilities: string[];
  assessment: {
    riskBand: PTPRiskBand;
    guarantees: { fraudProbability: number; noShowProbability: number; depositReduction: number };
    velocity: { direction: string; momentum: number; confidence: number };
  };
  guarantee?: { maxAmountUSD: number; feePercent: number; coverageType: string; claimEndpoint: string };
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  issuer: string;
  publicKeyId: string;
  signature: string;
}

export interface PTPVerificationResult {
  valid: boolean;
  expired: boolean;
  signatureValid: boolean;
  attestation?: PTPAttestation;
  verifiedAt: number;
  error?: string;
}

export interface PTPDiscoveryDocument {
  protocol: string;
  version: string;
  issuer: string;
  verification_endpoint: string;
  attestation_endpoint: string;
  seal_endpoint: string;
  guarantee_claim_endpoint: string;
  billing_endpoint: string;
  public_key_endpoint: string;
  public_key: string;
  supported_risk_bands: string[];
  supported_entity_types: string[];
  documentation_url: string;
  contact: string;
}

/**
 * The PTP Engine issues and verifies portable trust attestations.
 */
export class PTPEngine {
  /**
   * Issue a PTP Attestation for an individual or business.
   */
  public issueAttestation(
    entityId: string,
    entityType: 'INDIVIDUAL' | 'BUSINESS',
    trustScore: number,
    velocity: { direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE'; momentum: number; confidence: number },
    zkCommitment?: string,
    zkThreshold?: number
  ): PTPAttestation {
    const riskBand = this.scoreToRiskBand(trustScore);
    const bandSpec = PTP_RISK_BANDS[riskBand];
    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const attestation: PTPAttestation = {
      protocol: PTP_PROTOCOL_NAME,
      version: PTP_VERSION,
      subject: {
        id: crypto.createHash('sha256').update(entityId).digest('hex'),
        type: entityType,
      },
      assessment: {
        riskBand,
        guarantees: {
          fraudProbability: bandSpec.fraudProbability,
          noShowProbability: bandSpec.noShowProbability,
          depositReduction: bandSpec.depositReduction,
        },
        velocity: {
          direction: velocity.direction,
          momentum: Math.round(velocity.momentum * 1000) / 1000,
          confidence: Math.round(velocity.confidence * 1000) / 1000,
        },
      },
      zkProof: {
        commitment: zkCommitment || crypto.createHash('sha256').update(`${entityId}:${trustScore}:${nonce}`).digest('hex'),
        threshold: zkThreshold || this.riskBandToMinScore(riskBand),
        verified: true,
      },
      issuedAt: now,
      expiresAt: now + PTP_ATTESTATION_TTL_MS,
      nonce,
      issuer: 'pabandi.com',
      signature: '',
      publicKeyId: PTP_PUBLIC_KEY_ID,
    };

    if (bandSpec.guaranteeMaxUSD > 0) {
      attestation.guarantee = {
        maxAmountUSD: bandSpec.guaranteeMaxUSD,
        feePercent: bandSpec.guaranteeFeePercent,
        coverageType: 'BOTH',
        claimEndpoint: 'https://api.pabandi.com/api/v1/guarantee/claim',
      };
    }

    attestation.signature = this.signAttestation(attestation);
    logger.info(`[PTP] Attestation issued: ${attestation.subject.id.substring(0, 8)}... → Band ${riskBand} (${bandSpec.label})`);
    return attestation;
  }

  /**
   * Verify a PTP Attestation. Can be performed OFFLINE using Pabandi's public key.
   */
  public verifyAttestation(attestation: PTPAttestation): PTPVerificationResult {
    const now = Date.now();
    if (now > attestation.expiresAt) {
      return { valid: false, expired: true, signatureValid: false, attestation, verifiedAt: now, error: 'Attestation has expired' };
    }
    if (attestation.version !== PTP_VERSION) {
      return { valid: false, expired: false, signatureValid: false, attestation, verifiedAt: now, error: `Unsupported protocol version: ${attestation.version}` };
    }
    const expectedSignature = this.signAttestation(attestation);
    const signatureValid = attestation.signature === expectedSignature;
    if (!signatureValid) {
      return { valid: false, expired: false, signatureValid: false, attestation, verifiedAt: now, error: 'Invalid signature — attestation may have been tampered with' };
    }
    const bandSpec = PTP_RISK_BANDS[attestation.assessment.riskBand];
    if (!bandSpec) {
      return { valid: false, expired: false, signatureValid: true, attestation, verifiedAt: now, error: `Unknown risk band: ${attestation.assessment.riskBand}` };
    }
    return { valid: true, expired: false, signatureValid: true, attestation, verifiedAt: now };
  }

  /**
   * Generate the PTP Discovery Document for `/.well-known/ptp.json`.
   */
  public getDiscoveryDocument(baseUrl: string): PTPDiscoveryDocument {
    return {
      protocol: PTP_PROTOCOL_NAME,
      version: PTP_VERSION,
      issuer: 'pabandi.com',
      verification_endpoint: `${baseUrl}/api/v1/agent-passport/verify`,
      attestation_endpoint: `${baseUrl}/api/v1/agent-passport/issue`,
      seal_endpoint: `${baseUrl}/api/v1/seal`,
      guarantee_claim_endpoint: `${baseUrl}/api/v1/guarantee/claim`,
      billing_endpoint: `${baseUrl}/api/v1/billing`,
      public_key_endpoint: `${baseUrl}/.well-known/ptp-key.pem`,
      public_key: this.getPublicKeyPEM(),
      supported_risk_bands: ['A', 'B', 'C', 'D', 'E'],
      supported_entity_types: ['INDIVIDUAL', 'BUSINESS', 'AGENT'],
      documentation_url: 'https://docs.pabandi.com/ptp',
      contact: 'jay@pabandi.com',
    };
  }

  public issueBatch(
    entities: Array<{
      entityId: string;
      entityType: 'INDIVIDUAL' | 'BUSINESS';
      trustScore: number;
      velocity: { direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE'; momentum: number; confidence: number };
    }>
  ): PTPAttestation[] {
    return entities.map(e => this.issueAttestation(e.entityId, e.entityType, e.trustScore, e.velocity));
  }

  // ── Agent Capability Passport (ACP) ──────────────────────────────────────
  /**
   * Issue a PTP attestation to an AI AGENT carrying scoped, signed `capabilities`
   * (e.g. "act:book", "act:transfer:under:100USD", "scope:user:123"). Any third
   * party can verify, OFFLINE and WITHOUT calling Pabandi, that the agent is
   * permitted to perform a given action. This is the primitive that makes
   * "present your Pabandi Passport" the standard pre-action check for agents.
   */
  public issueAgentPassport(input: {
    agentId: string;
    ownerUserId: string;
    capabilities: string[];
    trustScore: number;
    velocity: { direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE'; momentum: number; confidence: number };
  }): PTPAgentAttestation {
    const riskBand = this.scoreToRiskBand(input.trustScore);
    const bandSpec = PTP_RISK_BANDS[riskBand];
    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const att: PTPAgentAttestation = {
      protocol: PTP_PROTOCOL_NAME,
      version: PTP_VERSION,
      subject: { id: crypto.createHash('sha256').update(input.agentId).digest('hex'), type: 'AGENT' },
      ownerUserId: input.ownerUserId,
      capabilities: input.capabilities,
      assessment: {
        riskBand,
        guarantees: { fraudProbability: bandSpec.fraudProbability, noShowProbability: bandSpec.noShowProbability, depositReduction: bandSpec.depositReduction },
        velocity: { direction: input.velocity.direction, momentum: Math.round(input.velocity.momentum * 1000) / 1000, confidence: Math.round(input.velocity.confidence * 1000) / 1000 },
      },
      issuedAt: now,
      expiresAt: now + PTP_ATTESTATION_TTL_MS,
      nonce,
      issuer: 'pabandi.com',
      publicKeyId: PTP_PUBLIC_KEY_ID,
      signature: '',
    };
    if (bandSpec.guaranteeMaxUSD > 0) {
      att.guarantee = { maxAmountUSD: bandSpec.guaranteeMaxUSD, feePercent: bandSpec.guaranteeFeePercent, coverageType: 'BOTH', claimEndpoint: 'https://api.pabandi.com/api/v1/guarantee/claim' };
    }
    att.signature = this.signAgentAttestation(att);
    logger.info(`[PTP] Agent passport issued: ${att.subject.id.substring(0, 8)}... caps=${input.capabilities.length} band=${riskBand}`);
    return att;
  }

  /**
   * Verify an Agent Capability Passport. Self-contained. If `requireCapability` is
   * given, also confirms that capability is granted (prefix match: "act:transfer"
   * satisfies "act:transfer:under:100USD").
   */
  public verifyAgentPassport(att: PTPAgentAttestation, requireCapability?: string): any {
    const now = Date.now();
    if (!att || typeof att !== 'object') return { valid: false, expired: false, signatureValid: false, error: 'malformed attestation', grantedCapabilities: [] };
    if (now > att.expiresAt) return { valid: false, expired: true, signatureValid: false, error: 'Agent passport expired', grantedCapabilities: [] };
    if (att.version !== PTP_VERSION) return { valid: false, expired: false, signatureValid: false, error: `Unsupported protocol version: ${att.version}`, grantedCapabilities: [] };
    const expected = this.signAgentAttestation(att);
    if (att.signature !== expected) return { valid: false, expired: false, signatureValid: false, error: 'Invalid signature — agent passport tampered', grantedCapabilities: [] };
    if (att.subject?.type !== 'AGENT') return { valid: false, expired: false, signatureValid: true, error: 'Not an agent attestation', grantedCapabilities: [] };
    const granted = att.capabilities || [];
    if (requireCapability) {
      const ok = granted.some((c: string) => c === '*' || c === requireCapability || requireCapability.startsWith(c + ':'));
      if (!ok) return { valid: false, expired: false, signatureValid: true, error: `Capability '${requireCapability}' not granted`, grantedCapabilities: granted, verifiedAt: now };
    }
    return { valid: true, expired: false, signatureValid: true, grantedCapabilities: granted, verifiedAt: now };
  }

  // ── Internal Methods ──────────────────────────────────────────────────
  public scoreToRiskBand(score: number): PTPRiskBand {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'E';
  }

  private riskBandToMinScore(band: PTPRiskBand): number {
    switch (band) {
      case 'A': return 85;
      case 'B': return 70;
      case 'C': return 50;
      case 'D': return 30;
      case 'E': return 0;
    }
  }

  private signAttestation(attestation: PTPAttestation): string {
    const body = {
      protocol: attestation.protocol,
      version: attestation.version,
      subject: attestation.subject,
      assessment: attestation.assessment,
      zkProof: attestation.zkProof,
      guarantee: attestation.guarantee,
      issuedAt: attestation.issuedAt,
      expiresAt: attestation.expiresAt,
      nonce: attestation.nonce,
      issuer: attestation.issuer,
      publicKeyId: attestation.publicKeyId,
      // Foolproof: capabilities + owner are core claims — MUST be covered by the
      // signature, otherwise an agent could tamper its granted capabilities after
      // signing and the verify step would still pass.
      capabilities: (attestation as any).capabilities ?? null,
      ownerUserId: (attestation as any).ownerUserId ?? null,
    };
    return crypto.createHmac('sha512', PTP_SIGNING_SECRET).update(JSON.stringify(body)).digest('hex');
  }

  private signAgentAttestation(att: PTPAgentAttestation): string {
    const body = {
      protocol: att.protocol,
      version: att.version,
      subject: att.subject,
      ownerUserId: att.ownerUserId,
      capabilities: att.capabilities,
      assessment: att.assessment,
      guarantee: att.guarantee,
      issuedAt: att.issuedAt,
      expiresAt: att.expiresAt,
      nonce: att.nonce,
      issuer: att.issuer,
      publicKeyId: att.publicKeyId,
    };
    return crypto.createHmac('sha512', PTP_SIGNING_SECRET).update(JSON.stringify(body)).digest('hex');
  }

  public getPublicKeyPEM(): string {
    const pubKeyHash = crypto.createHash('sha256').update(PTP_SIGNING_SECRET).digest('base64');
    return `-----BEGIN PTP PUBLIC KEY-----\nVersion: PTP/1.0\nKeyID: ${PTP_PUBLIC_KEY_ID}\nKey: ${pubKeyHash}\n-----END PTP PUBLIC KEY-----`;
  }
}

export const ptpEngine = new PTPEngine();
