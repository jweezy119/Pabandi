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
  getAiSignInGuidance,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Email code login (public - no auth required)
router.post('/request-code', requestLoginCode);
router.post('/verify-code', verifyLoginCode);

// Wallet auth routes
router.post('/wallet/nonce', getNonce);
router.post('/wallet/verify', verifyWallet);

// AI sign-in guidance (public, no auth required)
router.post('/ai/signin-guidance', getAiSignInGuidance);

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