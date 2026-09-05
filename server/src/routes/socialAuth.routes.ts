import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH — No business verification required
// ═══════════════════════════════════════════════════════════════════════════════

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL}/api/v1/auth/social/github/callback`,
      scope: ['user:email'],
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(null, false, { message: 'No email from GitHub' });

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              firstName: profile.displayName?.split(' ')[0] || profile.username,
              lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
              githubId: profile.id,
              isEmailVerified: true,
              password: '', // OAuth users don't need password
            } as any,
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
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=github' }),
  (req: any, res: Response) => {
    const user = req.user as any;
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback',
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
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

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              firstName: profile.displayName?.split(' ')[0] || profile.username,
              lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
              twitterId: profile.id,
              isEmailVerified: true,
              password: '',
            } as any,
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
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback',
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
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
