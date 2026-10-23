import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/v1/trust/agent/:passportId/credentials
 * Public Trust Verification Layer - returns a JSON-LD Verifiable Credential
 */
router.get('/trust/agent/:passportId/credentials', async (req: Request, res: Response) => {
  try {
    const passportId = req.params.passportId;
    
    // Find the passport record
    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
      include: {
        // Include relevant trust data for credential generation
        onchainAttestations: {
          where: { status: 'confirmed' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!passport) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
        message: 'The specified passport ID does not exist in Pabandi's trust system',
      });
    }

    // Calculate data brokerage capabilities based on attestations and passport data
    const attestations = passport.onchainAttestations;
    const successfulTransactions = attestations.filter(a => a.status === 'confirmed').length;
    const totalAttestations = attestations.length;
    const successRate = totalAttestations > 0 ? totalAttestations / 10 : 0; // Use fraction of recent attestations

    // Determine domain from agent type or other identifying factors
    const domain = passport.category ? `Data Brokerage - ${passport.category}` : 'Data Brokerage';

    // Generate a did:key for the agent (in a real implementation, this would be the agent's actual DID)
    const didKey = `did:key:z6Mk${crypto.randomBytes(16).toString('hex')}`;

    // Create the Verifiable Credential in JSON-LD format
    const verifiableCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
      ],
      id: crypto.randomUUID(),
      type: ['VerifiableCredential', 'DataBrokerageCapabilityCredential'],
      issuer: 'https://pabandi.com',
      issued: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      credentialSubject: {
        id: didKey,
        dataBrokerageCapability: {
          domain: domain,
          successRate: Number(successRate.toFixed(3)), // Format as 0.998
          verifiedTransactions: successfulTransactions,
          totalAttestations: totalAttestations,
          reputationScore: passport.paymentScore || 500,
          category: passport.category,
          handle: passport.handle,
          displayName: passport.displayName,
        },
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: 'https://pabandi.com#key-1',
        proofPurpose: 'assertionMethod',
        jws: `eyJhbGciOiJEd25519GCI6IkpXVCJ9.${btoa(JSON.stringify({
          sub: didKey,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
        }))}.signature`, // This is a placeholder - in production would use proper JWT signing
      },
    };

    // Log the credential generation for audit purposes
    logger.info(`[TrustVerification] Generated Verifiable Credential for passport ${passportId} with ${successfulTransactions} successful transactions`);

    return res.json({
      success: true,
      credential: verifiableCredential,
      metadata: {
        passportId: passportId,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        verificationEndpoint: 'https://pabandi.com/api/v1/trust/agent/:passportId/verify-credential',
      },
    });
  } catch (error: any) {
    logger.error(`[TrustVerification] Error generating credential: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to generate trust verification credential',
    });
  }
});

export default router;
