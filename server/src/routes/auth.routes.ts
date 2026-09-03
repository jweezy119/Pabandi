import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { register, login, refreshToken, verifyEmail, sendVerificationCode, verifyPhone, forgotPassword, resetPassword, getTrustAttestation, updateProfile, updatePassword, getNonce, verifyWallet, requestProfileChange, getProfileChangeStatus } from '../controllers/auth.controller';
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

router.post('/auth/request-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    const { prisma } = await import('../utils/database');
    const { generateVerificationCode, sendVerificationEmail } = await import('../services/email.service');

    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.upsert({
      where: { email },
      create: { email, verificationCode: code, verificationCodeExpires: expires } as any,
      update: { verificationCode: code, verificationCodeExpires: expires },
    });

    const sent = await sendVerificationEmail(email, code, 'there');
    if (!sent) {
      return res.status(500).json({ success: false, message: 'Failed to send verification email' });
    }

    res.json({ success: true, message: 'Verification code sent to your email', expiresIn: 900 });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/verify-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body as { email: string; code: string };
    const { prisma } = await import('../utils/database');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }
    if (user.verificationCodeExpires && user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code expired' });
    }

    await prisma.user.update({ where: { email }, data: { isEmailVerified: true, verificationCode: null, verificationCodeExpires: null } });
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/register', authRateLimiter, [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Please enter a valid email address.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
  body('firstName').trim().notEmpty().withMessage('First name is required.'),
  body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  body('code').notEmpty().withMessage('Verification code is required'),
], validateRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, role, code } = req.body;
    const { prisma } = await import('../utils/database');
    const { hash } = await import('bcrypt');
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET!;
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

    const existingUser = await prisma.user.findFirst({ where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email or phone already exists' });
    }

    const verifiedUser = await prisma.user.findUnique({ where: { email } });
    if (!verifiedUser || !verifiedUser.verificationCode || verifiedUser.verificationCode !== code) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }
    if (verifiedUser.verificationCodeExpires && verifiedUser.verificationCodeExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code expired. Please request a new one.' });
    }

    const passwordHash = await hash(password, 12);
    const resolvedRole = ['BUSINESS', 'AGENT', 'TENANT', 'CUSTOMER'].includes(role) ? role : 'CUSTOMER';

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: resolvedRole as any,
        isEmailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
      },
    });

    const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, isVerified: true },
    });
  } catch (error) {
    next(error);
  }
});
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


