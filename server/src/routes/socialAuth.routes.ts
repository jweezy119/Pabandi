import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { findOrCreateUser, getActiveBusinessId } from '../services/identity.service';
import { resolveFrontendOrigin } from '../utils/oauthRedirect';
import { safeReturnPath } from '../utils/url';

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not configured');
}

/**
 * Both providers used to hard-code `process.env.CLIENT_URL`, which on this
 * deployment is the API origin. That origin serves the built SPA too, so the
 * login "succeeded" — in that origin's localStorage. pabandi.com, where the
 * user actually was, kept them signed out, and clicking "Sign in with GitHub"
 * again began the same trip: the reported loop. See utils/oauthRedirect.ts.
 */
function frontendOrigin(req: any) {
  return resolveFrontendOrigin(typeof req.query?.origin === 'string' ? req.query.origin : req.get?.('origin'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH — No business verification required
// ═══════════════════════════════════════════════════════════════════════════════

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL || 'https://pabandi.onrender.com'}/api/v1/auth/social/github/callback`,
      scope: ['user:email'],
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(null, false, { message: 'No email from GitHub' });

        const user = await findOrCreateUser({
          provider: 'github',
          providerId: profile.id,
          email,
          metadata: { login: profile.username, name: profile.displayName, avatarUrl: profile.photos?.[0]?.value },
        });

        if (!user.githubId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { githubId: profile.id },
            include: { business: true },
          });
        }
        return done(null, user);
      } catch (e) {
        return done(e, false);
      }
    }
  ));
}

// GitHub OAuth routes
router.get('/github', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get('/github/callback',
  (req: Request, res: Response, next: NextFunction) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
    }
    passport.authenticate('github', { failureRedirect: '/login?error=github' })(req, res, next);
  },
  (req: any, res: Response) => {
    const user = req.user as any;
    const token = jwt.sign(
      { id: user.id, email: user.email, activeBusinessId: getActiveBusinessId(user), mode: user.preferredMode || 'personal' },
      JWT_SECRET!,
      { expiresIn: JWT_EXPIRES_IN as any }
    );
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET!, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });
    const params = new URLSearchParams({ token, refreshToken, returnTo: safeReturnPath(req.query?.return_to as string) });
    res.redirect(`${frontendOrigin(req)}/auth/callback?${params.toString()}`);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TWITTER/X OAUTH — No business verification required
// ═══════════════════════════════════════════════════════════════════════════════

if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET) {
  passport.use(new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_API_KEY,
      consumerSecret: process.env.TWITTER_API_SECRET,
      callbackURL: `${process.env.API_URL}/api/v1/auth/social/twitter/callback`,
      includeEmail: true,
    },
    async (token: string, tokenSecret: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(null, false, { message: 'No email from Twitter' });

        const user = await findOrCreateUser({
          provider: 'twitter',
          providerId: profile.id,
          email,
          metadata: { username: profile.username, displayName: profile.displayName },
        });

        // Ensure Twitter ID is linked
        if (!user.twitterId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { twitterId: profile.id },
            include: { business: true },
          });
        }
        return done(null, user);
      } catch (e) {
        return done(e, false);
      }
    }
  ));
}

router.get('/twitter', passport.authenticate('twitter'));

router.get('/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/login?error=twitter' }),
  (req: any, res: Response) => {
    const user = req.user as any;
    const token = jwt.sign(
      { id: user.id, email: user.email, activeBusinessId: getActiveBusinessId(user), mode: user.preferredMode || 'personal' },
      JWT_SECRET!,
      { expiresIn: JWT_EXPIRES_IN as any }
    );
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET!, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });
    const params = new URLSearchParams({ token, refreshToken, returnTo: safeReturnPath(req.query?.return_to as string) });
    res.redirect(`${frontendOrigin(req)}/auth/callback?${params.toString()}`);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// OPENWA WHATSAPP — Self-hosted, free WhatsApp automation
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/whatsapp/send-confirmation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message required' });
    }

    const { openwaService } = await import('../services/whatsapp.service');
    await openwaService.sendTextToBusiness(phone, message);

    res.json({ success: true, message: 'WhatsApp confirmation sent' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to send WhatsApp' });
  }
});

router.get('/whatsapp/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { openwaService } = await import('../services/whatsapp.service');
    const health = await openwaService.healthCheck();
    res.json({ success: true, data: health });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'OpenWA health check failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMS — Twilio if configured, else OpenWA WhatsApp fallback
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/sms/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message required' });
    }

    // Use Twilio if configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = (await import('twilio')).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
      res.json({ success: true, message: 'SMS sent via Twilio' });
    } else {
      // Fallback: use OpenWA for WhatsApp instead
      const { openwaService } = await import('../services/whatsapp.service');
      await openwaService.sendTextToBusiness(phone, message);
      res.json({ success: true, message: 'Sent via WhatsApp (Twilio not configured)' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to send SMS' });
  }
});

export default router;
