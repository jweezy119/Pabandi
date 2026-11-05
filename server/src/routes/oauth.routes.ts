import { Router, Request, Response } from 'express';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import crypto from 'crypto';
import {
  getJwks,
  signOidcToken,
  verifyOidcToken,
  scoreToTrustBand,
  IamTokenClaims,
  TrustBand,
  PrincipalType,
} from '../utils/iamKeys';
import { validateDPoPProof, verifySiwsSignature } from '../utils/dpop';
import { logger } from '../utils/logger';

const router = Router();
const ISSUER = 'https://pabandi.com';

interface DPoPHeaderPayload {
  jkt?: string;
  htm?: string;
  htu?: string;
  iat?: number;
}

/**
 * Helper: Extract DPoP key thumbprint from request if DPoP header is present
 */
function extractDPoPThumbprint(req: Request): string | undefined {
  const dpopHeader = req.headers['dpop'] as string | undefined;
  if (!dpopHeader) return undefined;

  try {
    const decoded = jwt.decode(dpopHeader, { complete: true });
    if (!decoded || !decoded.header || typeof decoded.header !== 'object') return undefined;

    const jwk = (decoded.header as Record<string, unknown>).jwk;
    if (!jwk || typeof jwk !== 'object') return undefined;

    return calculateJwkThumbprint(jwk as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

/**
 * Helper: Resolve principal's trust score and band from user record
 */
async function resolvePrincipalTrust(userId: string): Promise<{
  trustScore: number;
  trustBand: TrustBand;
  delegationMaxSpendCents: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trustScore: true,
      reliabilityScore: true,
      walletAddress: true,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });

  let score = user?.trustScore || user?.reliabilityScore || 50;

  // Check verifications for bonus trust
  if (user?.isEmailVerified) score = Math.min(100, score + 5);
  if (user?.isPhoneVerified) score = Math.min(100, score + 5);
  if (user?.walletAddress) score = Math.min(100, score + 10);

  const passport = await prisma.trustPassport.findFirst({
    where: { userId },
    select: { score: true, verifiedIdentity: true },
  });

  if (passport?.score && passport.score > score) {
    score = passport.score;
  }
  if (passport?.verifiedIdentity) {
    score = Math.min(100, score + 15);
  }

  const trustBand = scoreToTrustBand(score);

  // Check for any active agent delegation spend caps
  const delegation = await prisma.agentDelegation.findFirst({
    where: { principalId: userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });

  const delegationMaxSpendCents = delegation ? delegation.maxAmountCents - delegation.spentCents : 50000;

  return {
    trustScore: score,
    trustBand,
    delegationMaxSpendCents: Math.max(0, delegationMaxSpendCents),
  };
}

// ── 1. GET /.well-known/openid-configuration ──
router.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/api/v1/oauth/authorize`,
    token_endpoint: 'https://pabandi.onrender.com/api/v1/oauth/token',
    userinfo_endpoint: 'https://pabandi.onrender.com/api/v1/oauth/userinfo',
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    introspection_endpoint: 'https://pabandi.onrender.com/api/v1/oauth/introspect',
    revocation_endpoint: 'https://pabandi.onrender.com/api/v1/oauth/revoke',
    response_types_supported: ['code'],
    grant_types_supported: [
      'authorization_code',
      'client_credentials',
      'refresh_token',
      'siws',
      'urn:ietf:params:oauth:grant-type:siws',
    ],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    dpop_signing_alg_values_supported: ['RS256', 'ES256', 'EdDSA'],
    scopes_supported: ['openid', 'profile', 'email', 'trust:passport', 'agent:execute', 'agent:lease'],
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'email',
      'name',
      'trust_score',
      'trust_band',
      'principal_type',
      'delegation_max_spend_cents',
      'jkt',
    ],
  });
});

// ── 2. GET /.well-known/jwks.json ──
router.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(getJwks());
});

// ── 3. GET /api/v1/oauth/authorize ──
router.get('/authorize', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, redirect_uri, response_type, scope, state } = req.query;
    const userId = req.user?.id;

    if (!client_id || !redirect_uri || response_type !== 'code') {
      res.status(400).json({ error: 'invalid_request', error_description: 'client_id, redirect_uri, and response_type=code required' });
      return;
    }

    const clientIdStr = String(client_id);
    const redirectUriStr = String(redirect_uri);

    // Verify or register client
    let client = await prisma.oAuthClient.findUnique({
      where: { clientId: clientIdStr },
    });

    if (!client) {
      // Auto-register public clients for agent and developer federation
      client = await prisma.oAuthClient.create({
        data: {
          clientId: clientIdStr,
          clientSecret: crypto.randomBytes(32).toString('hex'),
          name: clientIdStr,
          redirectUris: [redirectUriStr],
          isActive: true,
        },
      });
    }

    if (!userId) {
      // Redirect to login with return parameter
      const loginUrl = new URL('https://pabandi.com/auth');
      loginUrl.searchParams.set('redirect', req.originalUrl || req.url);
      res.redirect(loginUrl.toString());
      return;
    }

    // Generate short-lived auth code
    const code = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId: clientIdStr,
        userId,
        redirectUri: redirectUriStr,
        expiresAt,
        used: false,
      },
    });

    const redirectUrl = new URL(redirectUriStr);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', String(state));
    res.redirect(redirectUrl.toString());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    logger.error('[OAuth Authorize] Error: ' + msg);
    res.status(500).json({ error: 'server_error', error_description: msg });
  }
});

// ── 4. POST /api/v1/oauth/token ──
router.post('/token', async (req: Request, res: Response) => {
  try {
    const {
      grant_type,
      code,
      client_id,
      client_secret,
      redirect_uri,
      refresh_token,
      publicKey,
      walletAddress,
      signature,
      message,
    } = req.body;

    const jkt = extractDPoPThumbprint(req);
    const tokenType = jkt ? 'DPoP' : 'Bearer';

    // ── Grant: authorization_code ──
    if (grant_type === 'authorization_code') {
      if (!code || !client_id) {
        res.status(400).json({ error: 'invalid_request', error_description: 'code and client_id required' });
        return;
      }

      const authCode = await prisma.oAuthAuthCode.findUnique({
        where: { code: String(code) },
      });

      if (!authCode || authCode.used || authCode.clientId !== String(client_id)) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or already used code' });
        return;
      }

      if (new Date() > authCode.expiresAt) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
        return;
      }

      // Mark code as used
      await prisma.oAuthAuthCode.update({
        where: { id: authCode.id },
        data: { used: true },
      });

      const user = await prisma.user.findUnique({ where: { id: authCode.userId } });
      const trustInfo = await resolvePrincipalTrust(authCode.userId);

      const accessToken = signOidcToken(
        {
          sub: authCode.userId,
          aud: String(client_id),
          scope: 'openid profile email trust:passport',
          trust_score: trustInfo.trustScore,
          trust_band: trustInfo.trustBand,
          principal_type: 'human',
          delegation_max_spend_cents: trustInfo.delegationMaxSpendCents,
          jkt,
          email: user?.email,
          name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        },
        { expiresIn: '1h' }
      );

      const idToken = signOidcToken(
        {
          sub: authCode.userId,
          aud: String(client_id),
          trust_score: trustInfo.trustScore,
          trust_band: trustInfo.trustBand,
          principal_type: 'human',
          delegation_max_spend_cents: trustInfo.delegationMaxSpendCents,
          email: user?.email,
          name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
          wallet_address: user?.walletAddress || undefined,
        },
        { expiresIn: '1h' }
      );

      // Save token in DB for revocation tracking
      await prisma.oAuthToken.create({
        data: {
          accessToken,
          refreshToken: crypto.randomBytes(32).toString('hex'),
          clientId: String(client_id),
          userId: authCode.userId,
          expiresAt: new Date(Date.now() + 3600 * 1000),
          revoked: false,
        },
      });

      res.json({
        access_token: accessToken,
        token_type: tokenType,
        expires_in: 3600,
        id_token: idToken,
        scope: 'openid profile email trust:passport',
      });
      return;
    }

    // ── Grant: client_credentials (M2M / AI Agents) ──
    if (grant_type === 'client_credentials') {
      if (!client_id) {
        res.status(400).json({ error: 'invalid_request', error_description: 'client_id required' });
        return;
      }

      const client = await prisma.oAuthClient.findUnique({
        where: { clientId: String(client_id) },
      });

      if (!client || !client.isActive) {
        res.status(401).json({ error: 'invalid_client', error_description: 'Client not registered or inactive' });
        return;
      }

      if (client_secret && client.clientSecret !== String(client_secret)) {
        res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client credentials' });
        return;
      }

      // Resolve agent's trust band (default to 85, Band B for verified M2M credentials)
      const agentTrustScore = 85;
      const agentTrustBand: TrustBand = 'B';
      const agentMaxSpendCents = 25000; // $250 default lease

      // AI Agent tokens have a strict capability lease of at most 15 minutes (900 seconds)
      const agentToken = signOidcToken(
        {
          sub: `agent:${client.clientId}`,
          aud: client.clientId,
          scope: 'agent:execute agent:lease trust:passport',
          trust_score: agentTrustScore,
          trust_band: agentTrustBand,
          principal_type: 'agent',
          delegation_max_spend_cents: agentMaxSpendCents,
          jkt,
          name: client.name,
        },
        { expiresIn: '15m' }
      );

      res.json({
        access_token: agentToken,
        token_type: tokenType,
        expires_in: 900, // 15 minutes capability lease
        scope: 'agent:execute agent:lease trust:passport',
        trust_score: agentTrustScore,
        trust_band: agentTrustBand,
        principal_type: 'agent',
      });
      return;
    }

    // ── Grant: siws (Sign-In with Solana) ──
    if (grant_type === 'siws' || grant_type === 'urn:ietf:params:oauth:grant-type:siws') {
      const address = walletAddress || publicKey;
      if (!address || !signature || !message) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'walletAddress, signature, and message are required for SIWS',
        });
        return;
      }

      // Verify Solana signature
      const siwsResult = verifySiwsSignature(String(address), String(signature), String(message));
      if (!siwsResult.valid) {
        res.status(401).json({
          error: 'invalid_grant',
          error_description: `Solana signature verification failed: ${siwsResult.error || 'Invalid signature'}`,
        });
        return;
      }

      // Find or create user for this wallet
      let user = await prisma.user.findFirst({ where: { walletAddress: String(address) } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `${String(address).slice(0, 8)}@wallet.pabandi.com`,
            passwordHash: '',
            firstName: 'Solana',
            lastName: String(address).slice(-4),
            walletAddress: String(address),
            role: 'CUSTOMER',
            trustScore: 75,
          },
        });
      }

      const trustInfo = await resolvePrincipalTrust(user.id);
      const targetAud = String(client_id || 'pabandi-web3');

      const accessToken = signOidcToken(
        {
          sub: user.id,
          aud: targetAud,
          scope: 'openid profile email trust:passport',
          trust_score: trustInfo.trustScore,
          trust_band: trustInfo.trustBand,
          principal_type: 'human',
          delegation_max_spend_cents: trustInfo.delegationMaxSpendCents,
          jkt,
          wallet_address: String(address),
          email: user.email,
        },
        { expiresIn: '1h' }
      );

      const idToken = signOidcToken(
        {
          sub: user.id,
          aud: targetAud,
          trust_score: trustInfo.trustScore,
          trust_band: trustInfo.trustBand,
          principal_type: 'human',
          delegation_max_spend_cents: trustInfo.delegationMaxSpendCents,
          wallet_address: String(address),
          email: user.email,
        },
        { expiresIn: '1h' }
      );

      res.json({
        access_token: accessToken,
        token_type: tokenType,
        expires_in: 3600,
        id_token: idToken,
        scope: 'openid profile email trust:passport',
      });
      return;
    }

    res.status(400).json({ error: 'unsupported_grant_type', error_description: `Grant type '${grant_type}' not supported` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Token issuance failure';
    logger.error('[OAuth Token] Error: ' + msg);
    res.status(500).json({ error: 'server_error', error_description: msg });
  }
});

// ── 5. POST /api/v1/oauth/introspect (RFC 7662) ──
router.post('/introspect', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.json({ active: false });
      return;
    }

    // Verify cryptographic signature and expiry
    let claims: IamTokenClaims;
    try {
      claims = verifyOidcToken(token);
    } catch {
      res.json({ active: false });
      return;
    }

    // Check if revoked in database
    const revokedToken = await prisma.oAuthToken.findFirst({
      where: { accessToken: token, revoked: true },
    });
    if (revokedToken) {
      res.json({ active: false });
      return;
    }

    res.json({
      active: true,
      scope: claims.scope || 'openid profile trust:passport',
      client_id: claims.aud,
      sub: claims.sub,
      exp: claims.exp,
      iat: claims.iat,
      iss: claims.iss,
      trust_score: claims.trust_score,
      trust_band: claims.trust_band,
      principal_type: claims.principal_type,
      delegation_max_spend_cents: claims.delegation_max_spend_cents,
      jkt: claims.jkt,
    });
  } catch {
    res.json({ active: false });
  }
});

// ── 6. POST /api/v1/oauth/revoke (RFC 7009) ──
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'invalid_request', error_description: 'token required' });
      return;
    }

    await prisma.oAuthToken.updateMany({
      where: { accessToken: token },
      data: { revoked: true },
    });

    res.json({ success: true, message: 'Token revoked successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Revocation error';
    res.status(500).json({ error: 'server_error', error_description: msg });
  }
});

// ── 7. GET /api/v1/oauth/userinfo ──
router.get('/userinfo', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const passport = await prisma.trustPassport.findUnique({ where: { userId } });
    const trustInfo = await resolvePrincipalTrust(userId);

    res.json({
      sub: userId,
      email: user?.email,
      name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      wallet_address: user?.walletAddress || undefined,
      trust_score: trustInfo.trustScore,
      trust_band: trustInfo.trustBand,
      delegation_max_spend_cents: trustInfo.delegationMaxSpendCents,
      passport: passport
        ? {
            id: passport.id,
            handle: passport.handle,
            score: passport.score,
            level: passport.level,
            verified: passport.verifiedIdentity,
            profile_url: `https://pabandi.com/trust/${passport.handle}`,
          }
        : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Userinfo error';
    res.status(500).json({ error: 'server_error', error_description: msg });
  }
});

// ── 8. GET /api/v1/oauth/apps (Developer Console: List Apps) ──
router.get('/apps', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.oAuthClient.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      data: clients.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        name: c.name,
        redirectUris: c.redirectUris,
        createdAt: c.createdAt,
      })),
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to fetch apps' });
  }
});

// ── 9. POST /api/v1/oauth/apps (Developer Console: Create App) ──
router.post('/apps', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, redirectUris } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'App name required' });
      return;
    }

    const clientId = `pab_app_${crypto.randomBytes(8).toString('hex')}`;
    const clientSecret = `pab_sec_${crypto.randomBytes(24).toString('hex')}`;

    const uris = Array.isArray(redirectUris)
      ? redirectUris
      : redirectUris
      ? [String(redirectUris)]
      : ['http://localhost:3000/api/auth/callback'];

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        name: String(name),
        redirectUris: uris,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: {
        id: client.id,
        clientId: client.clientId,
        clientSecret, // Returned once upon creation
        name: client.name,
        redirectUris: client.redirectUris,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'App creation failed' });
  }
});

// ── 10. GET /api/v1/oauth/verifications (Developer Console: Verification Hub) ──
router.get('/verifications', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // Default demo state for guest
      res.json({
        success: true,
        data: {
          trustScore: 70,
          trustBand: 'B',
          checklist: [
            { id: 'email', title: 'Email Address Verified', verified: true, boost: '+10 Trust' },
            { id: 'phone', title: 'Phone Number (SMS OTP)', verified: false, boost: '+10 Trust' },
            { id: 'github', title: 'GitHub Open-Source Profile', verified: true, boost: '+15 Trust' },
            { id: 'solana', title: 'Solana Web3 Wallet Signed', verified: true, boost: '+15 Trust' },
            { id: 'business', title: 'OpenStreetMap Physical Business', verified: false, boost: '+20 Trust' },
            { id: 'escrow', title: 'First Escrow Project Completed', verified: false, boost: '+25 Trust' },
          ],
        },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isEmailVerified: true,
        isPhoneVerified: true,
        walletAddress: true,
        trustScore: true,
      },
    });

    const passport = await prisma.trustPassport.findFirst({
      where: { userId },
      select: { verifiedIdentity: true, score: true },
    });

    const hasBiz = await prisma.business.findFirst({
      where: { ownerId: userId, isActive: true },
    });

    const trustInfo = await resolvePrincipalTrust(userId);

    const checklist = [
      { id: 'email', title: 'Email Address Verified', verified: Boolean(user?.isEmailVerified), boost: '+10 Trust' },
      { id: 'phone', title: 'Phone Number (SMS OTP)', verified: Boolean(user?.isPhoneVerified), boost: '+10 Trust' },
      { id: 'github', title: 'GitHub Open-Source Profile', verified: Boolean(passport?.verifiedIdentity), boost: '+15 Trust' },
      { id: 'solana', title: 'Solana Web3 Wallet Signed', verified: Boolean(user?.walletAddress), boost: '+15 Trust' },
      { id: 'business', title: 'OpenStreetMap Physical Business Claimed', verified: Boolean(hasBiz), boost: '+20 Trust' },
      { id: 'escrow', title: 'First Escrow Deal Settled', verified: false, boost: '+25 Trust' },
    ];

    res.json({
      success: true,
      data: {
        trustScore: trustInfo.trustScore,
        trustBand: trustInfo.trustBand,
        checklist,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to fetch verifications' });
  }
});

export default router;
