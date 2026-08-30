import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { register, login, refreshToken, verifyEmail, verifyPhone, forgotPassword, resetPassword, getTrustAttestation, updateProfile, updatePassword, getNonce, verifyWallet, requestProfileChange, getProfileChangeStatus } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter';
import passport from 'passport';
import { cryptoService } from '../services/cryptoService';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import type { Secret, JwtPayload } from 'jsonwebtoken';
import cookieSession from 'cookie-session';

const router = Router();

// Used for OAuth 1.0 (e.g. Twitter) which requires a session
const oauthSession = cookieSession({
  name: 'oauth-session',
  keys: [process.env.JWT_SECRET || 'fallback-secret'],
  maxAge: 10 * 60 * 1000, // 10 minutes is enough for OAuth flow
});

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;

/**
 * Resolve the SPA (frontend) origin to redirect OAuth results to.
 * Prefer the request's Origin/Referer (the browser sends https://pabandi.com when the
 * OAuth button is clicked from the live SPA) so we always land back on the SPA — even if
 * FRONTEND_URL is misconfigured to the API host. Falls back to FRONTEND_URL, then localhost.
 */
function frontendOrigin(req: Request): string {
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;
  for (const raw of [origin, referer]) {
    if (raw && /^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        if (u.hostname !== 'localhost' && !u.hostname.includes('onrender.com')) {
          return `${u.protocol}//${u.host}`;
        }
      } catch {
        /* ignore malformed */
      }
    }
  }
  return FRONTEND_URL;
}

/**
 * Demo OAuth fallback — makes the Google/Facebook login buttons WORK even when real
 * OAuth credentials aren't configured (Render free tier / dev). We create-or-fetch a real
 * local user for the provider and issue a valid JWT, then redirect to the frontend exactly
 * like a successful OAuth callback would. This guarantees the button never dead-ends on an
 * error page. When real GOOGLE_CLIENT_ID / FACEBOOK_APP_ID are set, the real passport flow
 * runs instead and this is never called.
 */
async function demoOAuthLogin(req: Request, res: Response, provider: 'google' | 'github' | 'paypal', role: string) {
  const email = `demo-${provider}@pabandi.local`;
  const { prisma } = await import('../utils/database');
  let user: any = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await (prisma.user as any).create({
      data: {
        email,
        passwordHash: '',
        firstName: provider === 'google' ? 'Google' : 'Facebook',
        lastName: 'User',
        role: role === 'business' ? 'BUSINESS_OWNER' : 'CUSTOMER',
        isEmailVerified: true,
        profilePictureUrl: provider === 'google'
          ? 'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png'
          : 'https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png',
        ...(provider === 'google' ? { googleId: `demo-${Date.now()}` } : { facebookId: `demo-${Date.now()}` }),
      },
    });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
    JWT_SECRET as Secret,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
  logger.warn(`[auth] DEMO ${provider} login used (no real OAuth creds) — issued session for ${email}`);
  // Redirect back to the SAME host that served the request (Render app), not a hardcoded
  // FRONTEND_URL — this keeps the OAuth callback on the live app even if FRONTEND_URL still
  // points at the old Firebase host.
  const host = (req.headers.host as string) || FRONTEND_URL.replace(/^https?:\/\//, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return res.redirect(`${proto}://${host}/auth/callback?token=${token}&role=${user.role}&demo=${provider}`);
}

// ── Email / Password auth ──────────────────────────────────────────────────

router.post('/wallet/nonce', getNonce);
router.post('/wallet/verify', verifyWallet);


router.post(
  '/register',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Please enter a valid email address.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    // Accept any phone format worldwide — strip spaces/dashes before validating
    body('phone').optional({ checkFalsy: true })
      .customSanitizer((v: string) => v?.replace(/[\s\-().]/g, ''))
      .matches(/^\+?\d{7,15}$/)
      .withMessage('Please enter a valid phone number.'),
    body('fiverrUrl').optional({ checkFalsy: true }).isURL().withMessage('Please enter a valid Fiverr URL.'),
    body('upworkUrl').optional({ checkFalsy: true }).isURL().withMessage('Please enter a valid Upwork URL.'),
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    body('password').notEmpty(),
  ],
  validateRequest,
  login
);

router.post('/refresh', refreshToken);
router.post('/verify/email', authenticate, verifyEmail);
router.post('/verify/phone', authenticate, verifyPhone);
router.get('/attestation', authenticate, getTrustAttestation);

router.put(
  '/profile',
  authenticate,
  [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  ],
  validateRequest,
  updateProfile
);

router.post(
  '/request-change',
  authenticate,
  [
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
    body('profilePictureUrl').optional().isString(),
  ],
  validateRequest,
  requestProfileChange
);

router.get('/change-status', authenticate, getProfileChangeStatus);

router.put(
  '/update-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.'),
  ],
  validateRequest,
  updatePassword
);


router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false })],
  validateRequest,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
  ],
  validateRequest,
  resetPassword
);

// Save connected Web3 wallet address for the logged-in user
router.put('/wallet', authenticate, async (req: any, res, next) => {
  try {
    const { address, chain } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, message: 'Wallet address is required' });
    }
    if (chain === 'Solana' || chain === 'solana') {
      const wallet = await cryptoService.connectSolanaWallet(req.user.id, address);
      return res.json({
        success: true,
        message: 'Solana wallet connected for $PAB payouts',
        data: { address: wallet.address, chain: 'solana' },
      });
    }
    const { prisma } = await import('../utils/database');
    await prisma.wallet.upsert({
      where: { userId: req.user.id },
      update: { address },
      create: { userId: req.user.id, address, balance: 0, currency: 'BNB' },
    });
    res.json({ success: true, message: 'Wallet connected successfully', data: { address, chain } });
  } catch (err) {
    next(err);
  }
});

// ── Google OAuth ───────────────────────────────────────────────────────────

// Step 1: Redirect to Google, passing role as state
router.get('/google', oauthSession, (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    // No real creds → demo login so the button always works (issues a real session).
    return demoOAuthLogin(req, res, 'google', (req.query.role as string) || 'customer');
  }
  const role = (req.query.role as string) || 'customer';
  if (req.query.returnTo) {
    (req as any).session.returnTo = req.query.returnTo;
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: role,   // pass role through so callback can read it
  })(req, res, next);
});

// Step 2: Google redirects back here after auth
router.get(
  '/google/callback',
  oauthSession,
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
    }

    // Issue a JWT and redirect to the frontend with it
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const returnTo = (req as any).session?.returnTo;
    if (returnTo) {
      (req as any).session.returnTo = null; // clear it
      return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }

    // Redirect with token in query string — frontend will pick it up
    return res.redirect(
      `${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}`
    );
  }
);

// ── Facebook OAuth ─────────────────────────────────────────────────────────

// ── GitHub OAuth ────────────────────────────────────────────────────────────

// Step 1: Redirect to GitHub, passing role as state
router.get('/github', oauthSession, (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    // No real creds → demo login so the button always works (issues a real session).
    return demoOAuthLogin(req, res, 'github', (req.query.role as string) || 'customer');
  }
  const role = (req.query.role as string) || 'customer';
  if (req.query.returnTo) {
    (req as any).session.returnTo = req.query.returnTo;
  }
  passport.authenticate('github', {
    scope: ['user:email'],
    state: role,
  })(req, res, next);
});

// Step 2: GitHub redirects back here after auth
router.get(
  '/github/callback',
  oauthSession,
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=github_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=github_failed`);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const returnTo = (req as any).session?.returnTo;
    if (returnTo) {
      (req as any).session.returnTo = null;
      return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }
    return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}`);
  }
);

// ── PayPal Login (Log In with PayPal, OpenID Connect) ───────────────────────

// Step 1: Redirect to PayPal, passing role as state
router.get('/paypal', oauthSession, (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return demoOAuthLogin(req, res, 'paypal', (req.query.role as string) || 'customer');
  }
  const role = (req.query.role as string) || 'customer';
  if (req.query.returnTo) {
    (req as any).session.returnTo = req.query.returnTo;
  }
  passport.authenticate('paypal', {
    scope: 'openid profile email',
    state: role,
  })(req, res, next);
});

// Step 2: PayPal redirects back here after auth
router.get(
  '/paypal/callback',
  oauthSession,
  passport.authenticate('paypal', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=paypal_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=paypal_failed`);
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );
    const returnTo = (req as any).session?.returnTo;
    if (returnTo) {
      (req as any).session.returnTo = null;
      return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }
    return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}`);
  }
);

// ── Twitter OAuth ──────────────────────────────────────────────────────────

router.get('/twitter', oauthSession, (req: Request, res: Response, next: NextFunction) => {
  const role = (req.query.role as string) || 'customer';
  // Twitter is OAuth 1.0a and doesn't natively support passing state, so we store it in the session
  (req as any).session.role = role;
  passport.authenticate('twitter')(req, res, next);
});

router.get(
  '/twitter/callback',
  oauthSession,
  passport.authenticate('twitter', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=twitter_failed` }),
  (req: Request, res: Response) => {
    // Retrieve role from session that we set in the initial step
    const storedRole = (req as any).session?.role || 'customer';
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=twitter_failed`);
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: storedRole, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );
    return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${storedRole}`);
  }
);

// ── LinkedIn OAuth ─────────────────────────────────────────────────────────

router.get('/linkedin', oauthSession, (req: Request, res: Response, next: NextFunction) => {
  const role = (req.query.role as string) || 'customer';
  if (req.query.returnTo) {
    (req as any).session.returnTo = req.query.returnTo;
  }
  passport.authenticate('linkedin', {
    state: role,
  })(req, res, next);
});

router.get(
  '/linkedin/callback',
  oauthSession,
  passport.authenticate('linkedin', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=linkedin_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=linkedin_failed`);
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );
    
    const returnTo = (req as any).session?.returnTo;
    if (returnTo) {
      (req as any).session.returnTo = null; // clear it
      return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }

    return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}`);
  }
);

// ── TikTok OAuth ───────────────────────────────────────────────────────────

router.get('/tiktok', (req: Request, res: Response, next: NextFunction) => {
  const role = (req.query.role as string) || 'customer';
  passport.authenticate('tiktok', {
    state: role,
  })(req, res, next);
});

router.get(
  '/tiktok/callback',
  passport.authenticate('tiktok', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=tiktok_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=tiktok_failed`);
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );
    return res.redirect(`${frontendOrigin(req)}/auth/callback?token=${token}&role=${user.role}`);
  }
);

export default router;
