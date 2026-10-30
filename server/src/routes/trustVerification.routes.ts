import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import {
  verifyX402Payment,
  verifyX402PaymentV2,
  createX402PaymentRequirement,
  buildPaymentRequired,
  encodePaymentRequired,
  parseX402PaymentHeaderRaw,
  X402_PRICING,
} from '../services/x402.service';
import { declareDiscoveryExtension } from '@x402/extensions';

const router = Router();

/**
 * GET /api/v1/trust/agent/:passportId/credentials
 * Trust Score as a Service — returns a JSON-LD Verifiable Credential.
 *
 * x402-gated: $0.01 per lookup. First request receives a 402 with payment
 * requirements; a valid x402 payment unlocks the credential.
 *
 * Discovery: the Bazaar declaration on every 402 tells agents the exact
 * price, accepted asset, and how to pay — so any agent can render the
 * endpoint without reading docs.
 */
const TRUST_CREDENTIAL_BAZAAR = declareDiscoveryExtension({
  bodyType: 'text',
  input: {
    amount: 0.01,
    description: 'Trust API lookup',
    route: '/api/v1/trust/agent/{passportId}/credentials',
  },
  output: {
    example: {
      success: true,
      data: {
        method: 'x402',
        settled: true,
        amount: 0.01,
        transactionHash: '5nHJSmv2m8Znrkm4tVwqfTqbVQUydjyFvX8mLFdvENq1',
        recipientId: 'platform',
        description: 'Trust API lookup',
        credential: { '@context': ['https://www.w3.org/2018/credentials/v1'] },
      },
    },
  },
});

const TRUST_CREDENTIAL_BAZAAR_RAW = {
  bazaar: {
    ...TRUST_CREDENTIAL_BAZAAR.bazaar,
    info: {
      ...TRUST_CREDENTIAL_BAZAAR.bazaar.info,
      input: {
        ...TRUST_CREDENTIAL_BAZAAR.bazaar.info.input,
        method: 'GET',
      },
    },
  },
};

router.get('/:passportId/credentials', async (req: Request, res: Response) => {
  const passportId = req.params.passportId;
  const PAYMENT_RESOURCE = `/api/v1/trust/agent/${passportId}/credentials`;

  // ── x402 payment check ──────────────────────────────────────────────
  const paymentHeader = req.headers['x-payment'];
  const paymentSignature = req.headers['payment-signature'];

  if (!paymentSignature && (typeof paymentHeader !== 'string' || paymentHeader.length === 0)) {
    // No payment yet: serve the 402 with payment requirements.
    return res.status(402)
      .header('Payment-Required', encodePaymentRequired(buildPaymentRequired({
        resource: PAYMENT_RESOURCE,
        amountUsdc: X402_PRICING.TRUST_API_CALL,
        extensions: TRUST_CREDENTIAL_BAZAAR_RAW,
      })))
      .json({
        ...createX402PaymentRequirement(PAYMENT_RESOURCE, X402_PRICING.TRUST_API_CALL),
        hint: 'Include a valid x-payment or payment-signature header to unlock this trust credential.',
        pricing: { trustApiCall: X402_PRICING.TRUST_API_CALL },
        extensions: TRUST_CREDENTIAL_BAZAAR_RAW,
      });
  }

  // ── Verify x402 v2 spec payment ─────────────────────────────────────
  if (typeof paymentSignature === 'string' && paymentSignature.length > 0) {
    const parsedV2 = parseX402PaymentHeaderRaw(paymentSignature);
    if (parsedV2.v2) {
      const result = await verifyX402PaymentV2({
        paymentPayload: parsedV2.v2,
        resource: PAYMENT_RESOURCE,
        amountUsdc: X402_PRICING.TRUST_API_CALL,
      });
      if (!result.valid) {
        return res.status(402).json({
          success: false,
          error: 'PAYMENT_NOT_VERIFIED',
          message: result.reason ?? 'Payment could not be verified',
          extensions: TRUST_CREDENTIAL_BAZAAR_RAW,
        });
      }
      return serveCredential(res, passportId, { method: 'x402', settled: true, amount: X402_PRICING.TRUST_API_CALL, transactionHash: result.transactionHash });
    }
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_NOT_VERIFIED',
      message: 'Malformed PAYMENT-SIGNATURE header',
      extensions: TRUST_CREDENTIAL_BAZAAR_RAW,
    });
  }

  // ── Verify legacy x-payment header ──────────────────────────────────
  const legacyHeader = typeof paymentHeader === 'string' ? paymentHeader : Array.isArray(paymentHeader) ? paymentHeader[0] : undefined;
  const result = await verifyX402Payment({
    paymentHeader: legacyHeader,
    resource: PAYMENT_RESOURCE,
    amount: X402_PRICING.TRUST_API_CALL,
  });
  if (!result.valid) {
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_NOT_VERIFIED',
      message: result.reason ?? 'Payment could not be verified',
      extensions: TRUST_CREDENTIAL_BAZAAR_RAW,
    });
  }
  return serveCredential(res, passportId, { method: 'x402', settled: true, amount: X402_PRICING.TRUST_API_CALL, transactionHash: result.transactionHash });
});

/**
 * Serve the trust credential after successful payment.
 */
function serveCredential(
  res: Response,
  passportId: string,
  payment: { method: string; settled: boolean; amount: number; transactionHash?: string | null }
): void {
  try {
    const passport = prisma.trustPassport.findUnique({
      where: { id: passportId },
    });

    const attestations = prisma.onchainAttestation.findMany({
      where: { passportId, status: 'confirmed' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    Promise.all([passport, attestations]).then(([passport, attestations]) => {
      if (!passport) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      const successfulTransactions = attestations.length;
      const successRate = successfulTransactions > 0 ? successfulTransactions / 10 : 0;
      const domain = passport.category ? `Data Brokerage - ${passport.category}` : 'Data Brokerage';
      const didKey = `did:key:z6Mk${crypto.randomBytes(16).toString('hex')}`;

      const verifiableCredential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
        ],
        id: crypto.randomUUID(),
        type: ['VerifiableCredential', 'DataBrokerageCapabilityCredential'],
        issuer: 'https://pabandi.com',
        issued: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        credentialSubject: {
          id: didKey,
          dataBrokerageCapability: {
            domain,
            successRate: Number(successRate.toFixed(3)),
            verifiedTransactions: successfulTransactions,
            totalAttestations: attestations.length,
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
          }))}.signature`,
        },
      };

      logger.info(
        `[TrustVerification] Paid credential for passport ${passportId}: $${payment.amount} via ${payment.method}`
      );

      res.json({
        success: true,
        payment,
        credential: verifiableCredential,
        metadata: {
          passportId,
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          verificationEndpoint: 'https://pabandi.com/api/v1/trust/agent/:passportId/verify-credential',
        },
      });
    }).catch((error: any) => {
      logger.error(`[TrustVerification] Error generating credential: ${error.message}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    });
  } catch (error: any) {
    logger.error(`[TrustVerification] Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export default router;
