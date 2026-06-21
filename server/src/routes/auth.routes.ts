import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { register, login, refreshToken, verifyEmail, verifyPhone, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter';
import passport from 'passport';
import { cryptoService } from '../services/cryptoService';
import jwt from 'jsonwebtoken';
import type { Secret, JwtPayload } from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;

// ── Email / Password auth ──────────────────────────────────────────────────

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
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  const role = (req.query.role as string) || 'customer';
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: role,   // pass role through so callback can read it
  })(req, res, next);
});

// Step 2: Google redirects back here after auth
router.get(
  '/google/callback',
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

    // Redirect with token in query string — frontend will pick it up
    return res.redirect(
      `${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`
    );
  }
);

// ── Facebook OAuth ─────────────────────────────────────────────────────────

// Step 1: Redirect to Facebook, passing role as state
router.get('/facebook', (req: Request, res: Response, next: NextFunction) => {
  if (!FACEBOOK_APP_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=facebook_not_configured`);
  }
  const role = (req.query.role as string) || 'customer';
  passport.authenticate('facebook', {
    scope: ['email', 'public_profile'],
    state: role,
  })(req, res, next);
});

// Step 2: Facebook redirects back here after auth
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=facebook_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=facebook_failed`);
    }

    // Issue a JWT and redirect to the frontend with it
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    // Redirect with token in query string — frontend will pick it up
    return res.redirect(
      `${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`
    );
  }
);

// ── Twitter OAuth ──────────────────────────────────────────────────────────

router.get('/twitter', (req: Request, res: Response, next: NextFunction) => {
  const role = (req.query.role as string) || 'customer';
  passport.authenticate('twitter', {
    state: role,
  })(req, res, next);
});

router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=twitter_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=twitter_failed`);
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
  }
);

// ── LinkedIn OAuth ─────────────────────────────────────────────────────────

router.get('/linkedin', (req: Request, res: Response, next: NextFunction) => {
  const role = (req.query.role as string) || 'customer';
  passport.authenticate('linkedin', {
    state: role,
  })(req, res, next);
});

router.get(
  '/linkedin/callback',
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
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
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
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
  }
);

export default router;
