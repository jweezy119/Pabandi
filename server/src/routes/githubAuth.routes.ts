import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { findOrCreateUser, getActiveBusinessId } from '../services/identity.service';
import { resolveFrontendOrigin } from '../utils/oauthRedirect';
import { safeReturnPath } from '../utils/url';

const router = Router();

// Lightweight GitHub OAuth — no Passport required
// Uses direct OAuth 2.0 flow with fetch()

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const API_URL = process.env.API_URL || 'https://pabandi.onrender.com';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not configured');
}
const CALLBACK_URL = `${API_URL}/api/v1/auth/social/github/callback`;

/**
 * The SPA this OAuth round trip started from.
 *
 * The client puts its origin in the OAuth state, and that is the only place it
 * can come from: CLIENT_URL on this deployment points at the API origin, which
 * serves the built app as well, so trusting it put every GitHub user's session
 * in the API origin's localStorage — signed in on pabandi.onrender.com, signed
 * out on pabandi.com, forever bouncing between them.
 */
function frontendFor(stateValue: unknown) {
  let origin: string | null = null;
  let returnTo = '/';
  try {
    const parsed = typeof stateValue === 'string' ? JSON.parse(Buffer.from(stateValue, 'base64').toString()) : null;
    origin = (parsed?.origin as string) || null;
    returnTo = safeReturnPath(parsed?.returnTo as string);
  } catch {
    /* fall through to the configured origin */
  }
  return { origin: resolveFrontendOrigin(origin), returnTo };
}

function redirectToLogin(origin: string, code: string, message: string) {
  return `${origin}/login?error=${encodeURIComponent(code)}&message=${encodeURIComponent(message)}`;
}

// Step 1: Redirect user to GitHub for authorization
router.get('/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(503).json({
      success: false,
      message: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'
    });
  }

  const role = req.query.role || 'customer';
  const origin = typeof req.query.origin === 'string' ? req.query.origin : null;
  const returnTo = safeReturnPath(typeof req.query.return_to === 'string' ? req.query.return_to : null);
  const state = Buffer.from(JSON.stringify({ role, origin, returnTo, timestamp: Date.now() })).toString('base64');
  
  const authUrl = `https://github.com/login/oauth/authorize?` + new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'read:user user:email',
    state,
  }).toString();

  res.redirect(authUrl);
});

// Step 2: Handle GitHub callback
router.get('/github/callback', async (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
  }

  const { code, state, error, error_description } = req.query;
  const { origin, returnTo } = frontendFor(state);

  if (error) {
    logger.warn('GitHub OAuth error:', error, error_description);
    const msg = (error_description as string) || (error as string) || 'Authorization failed';
    return res.redirect(redirectToLogin(origin, 'github', msg));
  }

  if (!code) {
    return res.redirect(redirectToLogin(origin, 'github', 'Missing authorization code'));
  }

  try {
    logger.info('GitHub OAuth callback received', { hasCode: !!code, hasState: !!state });

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL,
      }),
    });

    const tokenData = await tokenResponse.json();
    logger.info('GitHub token exchange', { 
      success: !!tokenData.access_token, 
      error: tokenData.error,
      errorDescription: tokenData.error_description 
    });
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      logger.error('GitHub token exchange failed:', tokenData);
      return res.redirect(redirectToLogin(origin, 'github', tokenData.error_description || 'Failed to obtain access token'));
    }

    // Fetch user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!userResponse.ok) {
      const err = await userResponse.json();
      logger.error('GitHub user fetch failed:', { status: userResponse.status, error: err });
      return res.redirect(redirectToLogin(origin, 'github', 'Failed to fetch GitHub profile'));
    }

    const profile = await userResponse.json();
    logger.info('GitHub profile fetched', { login: profile.login, id: profile.id, hasPublicEmail: !!profile.email });
    // Granted scopes reveal scope-downgrade issues (e.g. stale grant without user:email)
    logger.info('GitHub granted scopes', { scopes: userResponse.headers.get('x-oauth-scopes') });

    // Fetch user emails
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!emailResponse.ok) {
      const err = await emailResponse.json();
      logger.error('GitHub emails fetch failed:', { status: emailResponse.status, error: err });
      return res.redirect(redirectToLogin(origin, 'github', 'Failed to fetch GitHub emails'));
    }

    const emails = await emailResponse.json();
    logger.info('GitHub emails fetched', { count: Array.isArray(emails) ? emails.length : 'non-array' });

    const emailList = Array.isArray(emails) ? emails : [];
    // GitHub's email objects look like { email, primary, verified, visibility }.
    // Prefer verified addresses, but fall back gracefully: public profile
    // email, then primary (even unverified), then anything usable — an
    // account with an unverified email beats a failed login.
    const verifiedPrimary = emailList.find((e: any) => e.primary && e.verified)?.email;
    const verifiedAny = emailList.find((e: any) => e.verified)?.email;
    const primaryAny = emailList.find((e: any) => e.primary)?.email;
    const firstAny = emailList[0]?.email;
    const primaryEmail = verifiedPrimary || (profile.email as string) || verifiedAny || primaryAny || firstAny;
    const emailVerified = !!(verifiedPrimary || verifiedAny);

    if (!primaryEmail) {
      logger.warn('No usable email from GitHub', { count: emailList.length });
      return res.redirect(
        redirectToLogin(origin, 'github', 'GitHub returned no email address. Add and verify an email at github.com/settings/emails, then try again.'),
      );
    }

    logger.info('Primary email found', { email: primaryEmail });

    // Find or create user by email — link GitHub ID so all sign-in methods share one account
    logger.info('Looking up user in DB', { email: primaryEmail });
    const user = await findOrCreateUser({
      provider: 'github',
      providerId: profile.id.toString(),
      email: primaryEmail,
      metadata: { login: profile.login, name: profile.name, avatarUrl: profile.avatar_url },
    });
    logger.info('User lookup result', { found: !!user, userId: user.id });

    // Ensure GitHub ID is linked
    if (!user.githubId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { githubId: profile.id.toString() },
      });
      logger.info('Linked GitHub ID to existing user', { userId: user.id, githubId: profile.id.toString() });
    }

    // Generate tokens. The refresh token matters here as much as on the email
    // login: without one, a GitHub session dies with its access token and the
    // client's refresh path has nothing to trade.
    const claims = {
      id: user.id, email: user.email, role: user.role,
      firstName: user.firstName || '', lastName: user.lastName || '',
      activeBusinessId: getActiveBusinessId(user),
      mode: user.preferredMode || 'personal',
    };
    const token = jwt.sign(claims, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN as any });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET!, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });

    // Redirect to the SPA this flow started from. `origin` comes from the
    // allowlisted OAuth state, so it is the site the user actually clicked
    // "Sign in with GitHub" on — which is the only thing that makes the
    // resulting session land in the localStorage they will actually use.
    const roleParam = state ? JSON.parse(Buffer.from(state as string, 'base64').toString()).role : 'customer';
    const params = new URLSearchParams({ token, refreshToken, role: String(roleParam), returnTo });
    res.redirect(`${origin}/auth/callback?${params.toString()}`);
  } catch (e: any) {
    logger.error('GitHub OAuth callback error:', {
      message: e.message,
      stack: e.stack,
      code: e.code,
      meta: e.meta,
    });
    const msg = e.message?.substring(0, 200) || 'Unknown error';
    res.redirect(redirectToLogin(origin, 'github', msg));
  }
});

export default router;