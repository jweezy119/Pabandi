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

// Protected routes (require authentication)
router.use(authenticate);
router.post('/verify/email', verifyEmail);
router.post('/verify/send-code', sendVerificationCode);
router.post('/verify/phone', verifyPhone);
router.put('/update-password', updatePassword);
router.get('/trust-attestation', getTrustAttestation);
router.put('/profile', updateProfile);
router.post('/request-change', requestProfileChange);
router.get('/change-status', getProfileChangeStatus);

export default router;