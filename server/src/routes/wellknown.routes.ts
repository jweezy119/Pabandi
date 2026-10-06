import { Router, Request, Response } from 'express';
import { ptpEngine } from '../protocol/ptp.spec';
import path from 'path';
import fs from 'fs';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import { buildAgentsDoc } from '../mcp/agentsDoc';
import { vcJwks } from '../trust/vcKeys';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /.well-known/ptp.json
 * Protocol discovery document for Pabandi Trust Protocol (PTP).
 * Allows third parties to dynamically discover PTP endpoints and capabilities.
 */
router.get('/ptp.json', (req: Request, res: Response) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = `${protocol}://${host}`;

  const discoveryDoc = ptpEngine.getDiscoveryDocument(baseUrl);
  
  res.setHeader('Content-Type', 'application/json');
  res.json(discoveryDoc);
});

/**
 * GET /.well-known/ptp-key.pem
 * Public key for offline verification of PTP Attestations.
 */
router.get('/ptp-key.pem', (_req: Request, res: Response) => {
  const pem = ptpEngine.getPublicKeyPEM();
  
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.send(pem);
});

/**
 * GET /.well-known/agents.json
 * Agent discovery document for PabandiOS.
 */
router.get('/agents.json', (req: Request, res: Response) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');

  res.setHeader('Content-Type', 'application/json');
  res.json(buildAgentsDoc(`${protocol}://${host}`));
});

/**
 * GET /.well-known/pabandi-keys.json
 * Public keys for verifying Pabandi Verifiable Credentials (JWKS).
 *
 * Derived from VC_SIGNING_PRIVATE_KEY at request time rather than committed, so
 * the published key cannot drift from the signing key and no private material
 * lives in the repository.
 *
 * This endpoint previously called crypto.createPublicKey(JWT_SECRET) — deriving a
 * public key from a symmetric HS256 secret — so it threw on every request and no
 * third party could ever verify a credential. See trust/vcKeys.ts.
 */
router.get('/pabandi-keys.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  // No-cache: this is a key document, and a cached stale copy would make a key
  // rotation look like a credential forgery to a verifier that cached the old one.
  res.setHeader('Cache-Control', 'no-cache');
  try {
    res.json(vcJwks());
  } catch (err) {
    // A missing key is a configuration fault, and saying so is more useful than a
    // 500. But it must not imply verification is possible when it is not.
    logger.error(`[WellKnown] VC key set unavailable: ${err instanceof Error ? err.message : 'unknown error'}`);
    res.status(503).json({ success: false, error: 'Signing key is not configured on this server' });
  }
});

export default router;
