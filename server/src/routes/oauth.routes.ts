import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * GET /api/v1/oauth/authorize
 * OAuth authorization endpoint - show consent screen or auto-approve for trusted clients
 */
router.get('/authorize', authenticate, async (req: Request, res: Response) => {
  try {
    const { client_id, redirect_uri, response_type, scope, state } = req.query;
    const userId = (req as any).user?.id;

    if (!client_id || !redirect_uri || response_type !== 'code') {
      return res.status(400).json({ error: 'invalid_request' });
    }

    // Check if client exists or create on-the-fly for open federation
    let client = await prisma.$queryRaw<any[]>`
      SELECT * FROM "OAuthClient" WHERE "clientId" = ${client_id} LIMIT 1
    `.catch(() => []);

    if (client.length === 0) {
      // Auto-register public clients for agent federation
      await prisma.$executeRaw`
        INSERT INTO "OAuthClient" (id, "clientId", "clientSecret", name, "redirectUris", scopes, "isPublic", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${client_id}, ${crypto.randomBytes(32).toString('hex')}, ${client_id}, ${JSON.stringify([redirect_uri])}::jsonb, ${JSON.stringify(['openid', 'profile', 'trust:passport'])}::jsonb, true, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `.catch(() => {});
    }

    // Get user's trust passport
    const passport = await prisma.trustPassport.findUnique({ where: { userId } });

    // Generate auth code
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.$executeRaw`
      INSERT INTO "OAuthCode" (id, code, "clientId", "userId", scope, "redirectUri", "expiresAt", "createdAt")
      VALUES (gen_random_uuid(), ${code}, ${client_id}, ${userId}, ${scope || 'openid profile trust:passport'}, ${redirect_uri}, ${expiresAt}, NOW())
    `.catch(() => {});

    // For agent federation, auto-approve if passport exists
    if (passport) {
      const redirectUrl = new URL(redirect_uri as string);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state as string);
      return res.redirect(redirectUrl.toString());
    }

    // Otherwise redirect to consent (simplified - auto-approve)
    const redirectUrl = new URL(redirect_uri as string);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state as string);
    return res.redirect(redirectUrl.toString());
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', error_description: e.message });
  }
});

/**
 * POST /api/v1/oauth/token
 * Exchange auth code for tokens
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;

    if (grant_type !== 'authorization_code' || !code) {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    const codes = await prisma.$queryRaw<any[]>`
      SELECT * FROM "OAuthCode" WHERE code = ${code} AND "clientId" = ${client_id} AND used = false AND "expiresAt" > NOW() LIMIT 1
    `.catch(() => []);

    if (codes.length === 0) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    const authCode = codes[0];

    // Mark code as used
    await prisma.$executeRaw`UPDATE "OAuthCode" SET used = true WHERE id = ${authCode.id}`.catch(() => {});

    // Get user and passport
    const user = await prisma.user.findUnique({ where: { id: authCode.userId } });
    const passport = await prisma.trustPassport.findUnique({ where: { userId: authCode.userId } });

    // Issue tokens
    const accessToken = jwt.sign(
      {
        sub: authCode.userId,
        iss: 'https://pabandi.com',
        aud: client_id,
        scope: authCode.scope,
        passport_id: passport?.id,
        passport_handle: passport?.handle,
        trust_score: passport?.score,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const idToken = jwt.sign(
      {
        sub: authCode.userId,
        iss: 'https://pabandi.com',
        aud: client_id,
        email: user?.email,
        name: user ? `${user.firstName} ${user.lastName}` : undefined,
        passport_id: passport?.id,
        passport_handle: passport?.handle,
        trust_score: passport?.score,
        trust_level: passport?.level,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: idToken,
      scope: authCode.scope,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', error_description: e.message });
  }
});

/**
 * GET /api/v1/oauth/userinfo
 * OIDC userinfo endpoint
 */
router.get('/userinfo', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const passport = await prisma.trustPassport.findUnique({ where: { userId } });

    res.json({
      sub: userId,
      email: user?.email,
      name: user ? `${user.firstName} ${user.lastName}` : undefined,
      passport: {
        id: passport?.id,
        handle: passport?.handle,
        score: passport?.score,
        level: passport?.level,
        verified: passport?.verifiedIdentity,
        profile_url: `https://pabandi.com/trust/${passport?.handle}`,
        vc_issuer: 'did:web:pabandi.com',
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', error_description: e.message });
  }
});

/**
 * GET /.well-known/openid-configuration
 */
router.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
  res.json({
    issuer: 'https://pabandi.com',
    authorization_endpoint: 'https://pabandi.com/api/v1/oauth/authorize',
    token_endpoint: 'https://pabandi.onrender.com/api/v1/oauth/token',
    userinfo_endpoint: 'https://pabandi.onrender.com/api/v1/oauth/userinfo',
    jwks_uri: 'https://pabandi.com/.well-known/jwks.json',
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],
    scopes_supported: ['openid', 'profile', 'email', 'trust:passport'],
    claims_supported: ['sub', 'email', 'name', 'passport_id', 'passport_handle', 'trust_score'],
  });
});

export default router;
