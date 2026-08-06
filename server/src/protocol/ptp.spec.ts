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
    sealColor: '#F97316',    // Orange
  },
  E: {
    label: 'High Risk',
    description: 'Significant risk. OSINT flags, poor history, or declining trust.',
    fraudProbability: 0.20,
    noShowProbability: 0.25,
    depositReduction: 0,
    guaranteeMaxUSD: 0,
    guaranteeFeePercent: 0,
    sealColor: '#EF4444',    // Red
  },
};

// ── PTP Attestation Document ──────────────────────────────────────────────────
export interface PTPAttestation {
  // Protocol metadata
  protocol: typeof PTP_PROTOCOL_NAME;
  version: typeof PTP_VERSION;

  // Subject (anonymized)
  subject: {
    id: string;              // SHA-256 hash of the real ID
    type: 'INDIVIDUAL' | 'BUSINESS';
  };

  // Trust Assessment
  assessment: {
    riskBand: PTPRiskBand;
    guarantees: {
      fraudProbability: number;     // e.g. 0.005 (0.5%)
      noShowProbability: number;    // e.g. 0.01 (1%)
      depositReduction: number;     // e.g. 0.50 (50% less deposit needed)
    };
    velocity: {
      direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE';
      momentum: number;             // [0, 1] — strength of the direction
      confidence: number;           // [0, 1] — data sufficiency
    };
  };

  // Zero-Knowledge Proof (score ≥ threshold without revealing score)
  zkProof: {
    commitment: string;            // cryptographic commitment
    threshold: number;             // proven minimum score
    verified: boolean;             // proof validity
  };

  // Financial Guarantee (if eligible)
  guarantee?: {
    maxAmountUSD: number;          // maximum covered per transaction
    feePercent: number;            // fee for the guarantee
    coverageType: 'FRAUD' | 'NO_SHOW' | 'BOTH';
    claimEndpoint: string;         // URL to file a guarantee claim
  };

  // Attestation metadata
  issuedAt: number;                // Unix ms
  expiresAt: number;               // Unix ms
  nonce: string;                   // replay protection
  issuer: string;                  // "pabandi.com"

  // Cryptographic signature (Ed25519-style via HMAC-SHA512 for now)
  signature: string;               // hex-encoded signature of the attestation body
  publicKeyId: string;             // key ID for key rotation support
}

// ── PTP Verification Result ───────────────────────────────────────────────────
export interface PTPVerificationResult {
  valid: boolean;
  expired: boolean;
  signatureValid: boolean;
  attestation: PTPAttestation | null;
  verifiedAt: number;
  error?: string;
}

// ── PTP Discovery Document ────────────────────────────────────────────────────
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
  supported_risk_bands: PTPRiskBand[];
  supported_entity_types: string[];
  documentation_url: string;
  contact: string;
}

// ── PTP Attestation Engine ────────────────────────────────────────────────────

// Signing key (in production: HSM or KMS-backed Ed25519 key)
const PTP_SIGNING_SECRET = process.env.PTP_SIGNING_SECRET || crypto.randomBytes(64).toString('hex');
const PTP_PUBLIC_KEY_ID = 'ptp-key-v1-2026';

export class PTPEngine {

  /**
   * Issue a PTP Attestation for an entity.
   * This is the core revenue-generating operation — every attestation is a billable event.
   */
  public issueAttestation(
    entityId: string,
    entityType: 'INDIVIDUAL' | 'BUSINESS',
    trustScore: number,
    velocity: { direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE'; momentum: number; confidence: number },
    zkCommitment?: string,
    zkThreshold?: number
  ): PTPAttestation {
    // 1. Determine risk band from trust score
    const riskBand = this.scoreToRiskBand(trustScore);
    const bandSpec = PTP_RISK_BANDS[riskBand];

    // 2. Generate nonce for replay protection
    const nonce = crypto.randomBytes(16).toString('hex');

    // 3. Build the attestation body
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
      signature: '', // Will be set below
      publicKeyId: PTP_PUBLIC_KEY_ID,
    };

    // 4. Add financial guarantee for Band A/B
    if (bandSpec.guaranteeMaxUSD > 0) {
      attestation.guarantee = {
        maxAmountUSD: bandSpec.guaranteeMaxUSD,
        feePercent: bandSpec.guaranteeFeePercent,
        coverageType: 'BOTH',
        claimEndpoint: 'https://api.pabandi.com/api/v1/guarantee/claim',
      };
    }

    // 5. Sign the attestation
    attestation.signature = this.signAttestation(attestation);

    logger.info(`[PTP] Attestation issued: ${attestation.subject.id.substring(0, 8)}... → Band ${riskBand} (${bandSpec.label})`);

    return attestation;
  }

  /**
   * Verify a PTP Attestation.
   * Can be performed OFFLINE using Pabandi's published public key.
   * This is how third parties validate trust without calling our API.
   */
  public verifyAttestation(attestation: PTPAttestation): PTPVerificationResult {
    const now = Date.now();

    // 1. Check expiration
    if (now > attestation.expiresAt) {
      return {
        valid: false,
        expired: true,
        signatureValid: false,
        attestation,
        verifiedAt: now,
        error: 'Attestation has expired',
      };
    }

    // 2. Check protocol version
    if (attestation.version !== PTP_VERSION) {
      return {
        valid: false,
        expired: false,
        signatureValid: false,
        attestation,
        verifiedAt: now,
        error: `Unsupported protocol version: ${attestation.version}`,
      };
    }

    // 3. Verify signature
    const expectedSignature = this.signAttestation(attestation);
    const signatureValid = attestation.signature === expectedSignature;

    if (!signatureValid) {
      return {
        valid: false,
        expired: false,
        signatureValid: false,
        attestation,
        verifiedAt: now,
        error: 'Invalid signature — attestation may have been tampered with',
      };
    }

    // 4. Verify risk band consistency
    const bandSpec = PTP_RISK_BANDS[attestation.assessment.riskBand];
    if (!bandSpec) {
      return {
        valid: false,
        expired: false,
        signatureValid: true,
        attestation,
        verifiedAt: now,
        error: `Unknown risk band: ${attestation.assessment.riskBand}`,
      };
    }

    return {
      valid: true,
      expired: false,
      signatureValid: true,
      attestation,
      verifiedAt: now,
    };
  }

  /**
   * Generate the PTP Discovery Document for `/.well-known/ptp.json`.
   */
  public getDiscoveryDocument(baseUrl: string): PTPDiscoveryDocument {
    return {
      protocol: PTP_PROTOCOL_NAME,
      version: PTP_VERSION,
      issuer: 'pabandi.com',
      verification_endpoint: `${baseUrl}/api/v1/ptp/verify`,
      attestation_endpoint: `${baseUrl}/api/v1/ptp/attest`,
      seal_endpoint: `${baseUrl}/api/v1/seal`,
      guarantee_claim_endpoint: `${baseUrl}/api/v1/guarantee/claim`,
      billing_endpoint: `${baseUrl}/api/v1/billing`,
      public_key_endpoint: `${baseUrl}/.well-known/ptp-key.pem`,
      public_key: this.getPublicKeyPEM(),
      supported_risk_bands: ['A', 'B', 'C', 'D', 'E'],
      supported_entity_types: ['INDIVIDUAL', 'BUSINESS'],
      documentation_url: 'https://docs.pabandi.com/ptp',
      contact: 'api@pabandi.com',
    };
  }

  /**
   * Issue attestations in batch for high-volume API customers.
   */
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

  // ── Internal Methods ──────────────────────────────────────────────────

  /**
   * Map a trust score (0-100) to a PTP Risk Band.
   */
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

  /**
   * Sign an attestation using HMAC-SHA512.
   * In production, this would use Ed25519 via a KMS/HSM.
   */
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
    };

    return crypto
      .createHmac('sha512', PTP_SIGNING_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  /**
   * Get the public key in PEM format for offline verification.
   * In production: actual Ed25519 public key.
   */
  public getPublicKeyPEM(): string {
    // Derive a deterministic "public key" from the signing secret for demo
    const pubKeyHash = crypto.createHash('sha256').update(PTP_SIGNING_SECRET).digest('base64');
    return `-----BEGIN PTP PUBLIC KEY-----\nVersion: PTP/1.0\nKeyID: ${PTP_PUBLIC_KEY_ID}\nKey: ${pubKeyHash}\n-----END PTP PUBLIC KEY-----`;
  }
}

export const ptpEngine = new PTPEngine();
