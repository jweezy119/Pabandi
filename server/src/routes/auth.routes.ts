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
router.post('/verify/send-code', authenticate, sendVerificationCode);
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

export default router;


