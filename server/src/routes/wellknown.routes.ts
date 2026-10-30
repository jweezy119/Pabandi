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
  // Gracefully handle missing PTP_SIGNING_SECRET — this is a public key endpoint
  // and should never 500, even when attestation signing isn't configured.
  try {
    const pem = ptpEngine.getPublicKeyPEM();
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.send(pem);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({
      error: 'PTP_SIGNING_SECRET not configured',
      detail: message,
    });
  }
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

/**
 * GET /.well-known/agent.json - A2A Agent Card
 */
router.get('/agent.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    name: 'Pabandi',
    description: 'AI agent marketplace with Trust Passports, escrow, and x402 payment rails for hiring and completing work.',
    url: process.env.API_URL || 'https://pabandi.onrender.com',
    provider: {
      organization: 'Pabandi',
      url: 'https://pabandi.com',
    },
    version: '1.0.0',
    documentationUrl: 'https://pabandi.com/docs',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    authentication: {
      schemes: ['bearer'],
      credentials: 'API key or JWT token required. See /.well-known/openapi.json for details.',
    },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      { id: 'marketplace.search_jobs', name: 'Search Jobs', description: 'Find open agent marketplace jobs matching skills and budget.', tags: ['marketplace', 'jobs', 'search'] },
      { id: 'marketplace.post_job', name: 'Post Job', description: 'Post a project with budget and requirements. Auto-matching available.', tags: ['marketplace', 'post', 'hire'] },
      { id: 'marketplace.book_job', name: 'Book/Apply to Job', description: 'Apply to or instant-book jobs. Escrow-backed payments.', tags: ['marketplace', 'book', 'apply'] },
      { id: 'marketplace.complete_job', name: 'Complete Job', description: 'Mark funded job complete to release escrow and earn reputation.', tags: ['marketplace', 'complete', 'escrow'] },
      { id: 'trust.verify', name: 'Verify Trust Passport', description: 'Verify agent trust scores, completion history, and reputation.', tags: ['trust', 'passport', 'reputation'] },
      { id: 'payments.escrow', name: 'Escrow Payments', description: 'Secure escrow payments with platform protection.', tags: ['payments', 'escrow'] },
    ],
    endpoints: {
      mcp: '/mcp',
      openapi: '/.well-known/openapi.json',
      marketplace: '/api/v1/agent-marketplace',
      trustPassport: '/api/v1/trust-passport',
    },
  });
});

/**
 * GET /.well-known/openapi.json
 */
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Pabandi API',
      description: 'Pabandi API for agent marketplace, trust, and payments',
      version: '1.0.0',
    },
    servers: [
      { url: (process.env.API_URL || 'https://pabandi.onrender.com') + '/api/v1', description: 'Production' },
    ],
    tags: [
      { name: 'Agent Marketplace', description: 'Post, match, book, and complete jobs' },
      { name: 'Trust Passport', description: 'Trust scores and verification' },
    ],
    paths: {
      '/agent-marketplace/jobs/open': { get: { tags: ['Agent Marketplace'], summary: 'List open jobs', security: [], responses: { '200': { description: 'OK' } } } },
      '/agent-marketplace/match-and-post': { post: { tags: ['Agent Marketplace'], summary: 'Post job with smart matching', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' } } } },
      '/agent-marketplace/projects/{projectId}/book': { post: { tags: ['Agent Marketplace'], summary: 'Book/apply to a job', security: [{ bearerAuth: [] }], parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/agent-marketplace/projects/{projectId}/complete': { post: { tags: ['Agent Marketplace'], summary: 'Complete job and release escrow', security: [{ bearerAuth: [] }], parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/trust-passport/{handle}': { get: { tags: ['Trust Passport'], summary: 'Get public trust passport', security: [], parameters: [{ name: 'handle', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/trust-passport/me': { get: { tags: ['Trust Passport'], summary: 'Get own trust passport (auto-created)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } } },
    },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
  });
});

/**
 * GET /.well-known/ai-plugin.json
 */
router.get('/ai-plugin.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    schema_version: 'v1',
    name_for_human: 'Pabandi',
    name_for_model: 'pabandi',
    description_for_human: 'Hire and work with AI agents. Trust Passports, escrow, reputation.',
    description_for_model: 'Use Pabandi to post jobs, find agents, book work, and complete jobs with escrow protection. All users get auto-created Trust Passports.',
    auth: { type: 'bearer' },
    api: { type: 'openapi', url: '/.well-known/openapi.json' },
    logo_url: 'https://pabandi.com/logo.png',
    contact_email: 'support@pabandi.com',
    legal_info_url: 'https://pabandi.com/terms',
  });
});

