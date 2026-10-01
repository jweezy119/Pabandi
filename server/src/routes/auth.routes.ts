import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  verifyEmail,
  sendVerificationCode,
  verifyPhone,
  forgotPassword,
  resetPassword,
  updatePassword,
  getTrustAttestation,
  updateProfile,
  getNonce,
  verifyWallet,
  requestProfileChange,
  getProfileChangeStatus,
  requestLoginCode,
  verifyLoginCode,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter, emailCodeRateLimiter, registrationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public auth routes
//
// These are unauthenticated, so the global 100-req/15-min limiter is far too
// generous: it permits ~100 account creations per IP per window, which is enough
// for a script to fill the user table with junk (a recurring `probe-N@example.com`
// registration was found doing exactly this). Registration gets its own tighter
// budget; the credential endpoints reuse the previously-unused authRateLimiter.
router.post('/register', registrationRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);

// Email code login (public - no auth required)
router.post('/request-code', emailCodeRateLimiter, requestLoginCode);
router.post('/verify-code', emailCodeRateLimiter, verifyLoginCode);
// Wallet auth routes
router.post('/wallet/nonce', getNonce);
router.post('/wallet/verify', verifyWallet);

// Protected routes (require authentication) - apply authenticate middleware individually
router.post('/verify/email', authenticate, verifyEmail);
router.post('/verify/send-code', authenticate, sendVerificationCode);
router.post('/verify/phone', authenticate, verifyPhone);
router.put('/update-password', authenticate, updatePassword);
router.get('/trust-attestation', authenticate, getTrustAttestation);
router.put('/profile', authenticate, updateProfile);
router.post('/request-change', authenticate, requestProfileChange);
router.get('/change-status', authenticate, getProfileChangeStatus);

export default router;