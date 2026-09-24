"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public auth routes
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
router.post('/refresh', auth_controller_1.refreshToken);
router.post('/forgot-password', auth_controller_1.forgotPassword);
router.post('/reset-password', auth_controller_1.resetPassword);
// Email code login (public - no auth required)
router.post('/request-code', auth_controller_1.requestLoginCode);
router.post('/verify-code', auth_controller_1.verifyLoginCode);
// Wallet auth routes
router.post('/wallet/nonce', auth_controller_1.getNonce);
router.post('/wallet/verify', auth_controller_1.verifyWallet);
// Protected routes (require authentication) - apply authenticate middleware individually
router.post('/verify/email', auth_middleware_1.authenticate, auth_controller_1.verifyEmail);
router.post('/verify/send-code', auth_middleware_1.authenticate, auth_controller_1.sendVerificationCode);
router.post('/verify/phone', auth_middleware_1.authenticate, auth_controller_1.verifyPhone);
router.put('/update-password', auth_middleware_1.authenticate, auth_controller_1.updatePassword);
router.get('/trust-attestation', auth_middleware_1.authenticate, auth_controller_1.getTrustAttestation);
router.put('/profile', auth_middleware_1.authenticate, auth_controller_1.updateProfile);
router.post('/request-change', auth_middleware_1.authenticate, auth_controller_1.requestProfileChange);
router.get('/change-status', auth_middleware_1.authenticate, auth_controller_1.getProfileChangeStatus);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map