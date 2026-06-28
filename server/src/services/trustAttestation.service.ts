import { prisma } from '../utils/database';
import { cryptoService } from './cryptoService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface TrustAttestation {
  subject: string;
  score: number;
  tier: 'BASIC' | 'ENHANCED' | 'CONDITIONAL' | 'RESTRICTED';
  guarantees: {
    noShowProbability: number;
    fraudProbability: number;
    depositReduction: number;
  };
  issuedAt: number;
  expiresAt: number;
  payloadHash: string;
  methodologyVersion: string;
  pubkey: string;
  sig: string;
}

export class TrustAttestationService {
  /**
   * Calculates probabilistic guarantees based on a trust score (0-100)
   */
  private calculateGuarantees(score: number) {
    // Score >= 90: <1% no-show
    // Score 80-89: <2% no-show
    // Score 70-79: <5% no-show
    // Score 60-69: <10% no-show
    
    let noShowProbability = 0.15; // default 15%
    if (score >= 90) noShowProbability = 0.009;
    else if (score >= 80) noShowProbability = 0.019;
    else if (score >= 70) noShowProbability = 0.049;
    else if (score >= 60) noShowProbability = 0.099;

    let fraudProbability = 0.05;
    if (score >= 90) fraudProbability = 0.001;
    else if (score >= 80) fraudProbability = 0.005;
    else if (score >= 70) fraudProbability = 0.01;
    else if (score >= 60) fraudProbability = 0.03;

    // depositMultiplier = 1 - (user.trustScore / 200) -> meaning 100 = 0.5x reduction
    let depositReduction = score / 200;

    return {
      noShowProbability,
      fraudProbability,
      depositReduction
    };
  }

  /**
   * Issue a signed cryptographic attestation for a user
   */
  public async issue(userId: string): Promise<TrustAttestation> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true, verificationTier: true }
    });

    if (!user) throw new Error('User not found');

    const score = user.trustScore;
    const tier = user.verificationTier as any;

    const issuedAt = Date.now();
    const expiresAt = issuedAt + (24 * 60 * 60 * 1000); // 24h TTL
    const methodologyVersion = "1.0.0";

    const payloadToSign = {
      subject: userId,
      score,
      tier,
      issuedAt,
      expiresAt,
      methodologyVersion
    };

    const dataBuffer = Buffer.from(JSON.stringify(payloadToSign));
    const payloadHash = crypto.createHash('sha256').update(dataBuffer).digest('hex');
    const { signature, pubkey } = cryptoService.signAttestationData(dataBuffer);

    return {
      ...payloadToSign,
      guarantees: this.calculateGuarantees(score),
      payloadHash,
      pubkey,
      sig: signature
    };
  }

  /**
   * Verify an attestation from a 3rd party
   */
  public verify(attestation: TrustAttestation): boolean {
    if (Date.now() > attestation.expiresAt) {
      return false; // Expired
    }
    const payload = {
      subject: attestation.subject,
      score: attestation.score,
      tier: attestation.tier,
      issuedAt: attestation.issuedAt,
      expiresAt: attestation.expiresAt,
      methodologyVersion: attestation.methodologyVersion
    };
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    
    const expectedHash = crypto.createHash('sha256').update(dataBuffer).digest('hex');
    if (expectedHash !== attestation.payloadHash) {
      return false; // Payload was tampered with
    }
    
    return cryptoService.verifyAttestationSignature(dataBuffer, attestation.sig, attestation.pubkey);
  }
}

export const trustAttestationService = new TrustAttestationService();
