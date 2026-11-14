import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { ptpEngine, PTPAttestation, PTPVerificationResult } from '../protocol/ptp.spec';
const trustFluxService = { computeTrustFlux: async (_userId: string) => ({ velocity: { direction: 'STEADY', momentum: 0.5, confidence: 0.8 } }) };

export class TrustAttestationService {
  /**
   * Issue a signed cryptographic attestation for a user using the PTP protocol.
   */
  public async issue(userId: string): Promise<PTPAttestation> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true, verificationTier: true }
    });

    if (!user) throw new Error('User not found');

    const score = user.trustScore;
    
    // Compute velocity for PTP
    let velocityData = { direction: 'STEADY' as any, momentum: 0, confidence: 0.5 };
    try {
      const flux = await trustFluxService.computeTrustFlux(userId);
      velocityData = {
        direction: (flux.velocity.direction || 'STEADY') as any,
        momentum: Math.abs(flux.velocity.momentum || 0),
        confidence: flux.velocity.confidence || 0.5,
      };
    } catch (err) {
      logger.warn(`Could not compute TrustFlux for ${userId}, using defaults.`);
    }

    // Issue standard PTP Attestation
    return ptpEngine.issueAttestation(
      userId,
      'INDIVIDUAL', // default to individual, could infer from DB
      score,
      velocityData
    );
  }

  /**
   * Verify an attestation from a 3rd party.
   * Defers to PTP Engine.
   */
  public verify(attestation: PTPAttestation): PTPVerificationResult {
    return ptpEngine.verifyAttestation(attestation);
  }
}

export const trustAttestationService = new TrustAttestationService();
