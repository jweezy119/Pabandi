import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Lightweight GitHub OAuth — no Passport required
// Uses direct OAuth 2.0 flow with fetch()

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const API_URL = process.env.API_URL || 'https://pabandi.onrender.com';
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://pabandi.com';
const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-secret';
const CALLBACK_URL = `${API_URL}/api/v1/auth/social/github/callback`;

// Step 1: Redirect user to GitHub for authorization
router.get('/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ 
      success: false, 
      message: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' 
    });
  }

  const role = req.query.role || 'customer';
  const state = Buffer.from(JSON.stringify({ role, timestamp: Date.now() })).toString('base64');
  
  const authUrl = `https://github.com/login/oauth/authorize?` + new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'user:email',
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

  if (error) {
    logger.warn('GitHub OAuth error:', error, error_description);
    const msg = (error_description as string) || (error as string) || 'Authorization failed';
    return res.redirect(`${CLIENT_URL}/login?error=github&message=${encodeURIComponent(msg)}`);
  }

  if (!code) {
    return res.redirect(`${CLIENT_URL}/login?error=github&message=Missing authorization code`);
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
      return res.redirect(`${CLIENT_URL}/login?error=github&message=${encodeURIComponent(tokenData.error_description || 'Failed to obtain access token')}`);
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
      return res.redirect(`${CLIENT_URL}/login?error=github&message=Failed to fetch GitHub profile`);
    }

    const profile = await userResponse.json();
    logger.info('GitHub profile fetched', { login: profile.login, id: profile.id });

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
      return res.redirect(`${CLIENT_URL}/login?error=github&message=Failed to fetch GitHub emails`);
    }

    const emails = await emailResponse.json();
    logger.info('GitHub emails fetched', { count: emails.length });

    const primaryEmail = emails.find((e: any) => e.primary && e.verified)?.value 
      || emails.find((e: any) => e.verified)?.value
      || emails[0]?.value;

    if (!primaryEmail) {
      logger.warn('No verified email from GitHub', { emails });
      return res.redirect(`${CLIENT_URL}/login?error=github&message=No verified email from GitHub`);
    }

    logger.info('Primary email found', { email: primaryEmail });

    // Find or create user
    logger.info('Looking up user in DB', { email: primaryEmail });
    let user = await prisma.user.findUnique({ where: { email: primaryEmail } });
    logger.info('User lookup result', { found: !!user, userId: user?.id });

    if (!user) {
      logger.info('Creating new user', { email: primaryEmail });
      const displayName = profile.name || profile.login;
      const nameParts = displayName.split(' ');
      
      user = await prisma.user.create({
        data: {
          email: primaryEmail,
          firstName: nameParts[0] || profile.login,
          lastName: nameParts.slice(1).join(' ') || '',
          githubId: profile.id.toString(),
          isEmailVerified: true,
          passwordHash: '', // OAuth users don't need password
          role: 'CUSTOMER',
          reliabilityScore: 750,
          trustScore: 50.0,
          verificationTier: 'BASIC',
          gracePeriodUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
      logger.info('User created', { userId: user.id });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    const roleParam = state ? JSON.parse(Buffer.from(state as string, 'base64').toString()).role : 'customer';
    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&role=${roleParam}`);
  } catch (e: any) {
    logger.error('GitHub OAuth callback error:', {
      message: e.message,
      stack: e.stack,
      code: e.code,
      meta: e.meta,
    });
    const msg = e.message?.substring(0, 200) || 'Unknown error';
    res.redirect(`${CLIENT_URL}/login?error=github&message=${encodeURIComponent(msg)}`);
  }
});

export default router;