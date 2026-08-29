"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileChangeStatus = exports.requestProfileChange = exports.verifyWallet = exports.getNonce = exports.updateProfile = exports.getTrustAttestation = exports.updatePassword = exports.resetPassword = exports.forgotPassword = exports.verifyPhone = exports.verifyEmail = exports.refreshToken = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../utils/database");
const client_1 = require("@prisma/client");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const odoo_service_1 = require("../services/odoo.service");
const osint_service_1 = require("../services/osint.service");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const encryption_1 = require("../utils/encryption");
const register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, phone, role, refCode } = req.body;
        // Check if user already exists
        const existingUser = await database_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    ...(phone ? [{ phone }] : []),
                ],
            },
        });
        if (existingUser) {
            throw new errorHandler_1.CustomError('User with this email or phone already exists', 409);
        }
        // Enforce password complexity
        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
        if (!passwordRegex.test(password)) {
            throw new errorHandler_1.CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        // Resolve role to enum (defaults to CUSTOMER)
        const resolvedRole = (role && Object.values(client_1.UserRole).includes(role))
            ? role
            : client_1.UserRole.CUSTOMER;
        // 48-Hour Grace Period
        const gracePeriodUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);
        // Resolve Account Manager Referral
        let referredByUserId;
        let accountManagerProfileId;
        if (refCode) {
            const profile = await database_1.prisma.accountManagerProfile.findUnique({
                where: { referralCode: refCode }
            });
            if (profile && profile.status === 'ACTIVE') {
                referredByUserId = profile.userId;
                accountManagerProfileId = profile.id;
            }
        }
        // Frictionless Solana Wallet Generation
        const newWallet = web3_js_1.Keypair.generate();
        const solanaAddress = newWallet.publicKey.toBase58();
        const encryptedSecret = (0, encryption_1.encrypt)(bs58_1.default.encode(newWallet.secretKey));
        // Create user immediately with BASIC tier
        const user = await database_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                phone,
                role: resolvedRole,
                reliabilityScore: 750,
                trustScore: 50.0,
                verificationTier: 'BASIC',
                gracePeriodUntil,
                ...(referredByUserId ? { referredById: referredByUserId } : {}),
                // Create the frictionless wallet
                wallet: {
                    create: {
                        address: solanaAddress,
                        encryptedSecret: encryptedSecret,
                        balance: 0,
                        currency: 'PAB'
                    }
                },
                // Create business profile if role is business owner
                ...(resolvedRole === client_1.UserRole.BUSINESS_OWNER && req.body.businessName && {
                    business: {
                        create: {
                            name: req.body.businessName,
                            category: 'RESTAURANT', // Default category
                            address: 'Global',
                            phone: phone || '',
                            email: email,
                            googlePlaceId: req.body.googlePlaceId,
                            ...(accountManagerProfileId ? { referredById: accountManagerProfileId } : {})
                        }
                    }
                }),
                ...(req.body.fiverrUrl || req.body.upworkUrl ? {
                    socialIdentities: {
                        create: [
                            ...(req.body.fiverrUrl ? [{ platform: 'FIVERR', platformHandle: req.body.fiverrUrl, trustBoost: 15 }] : []),
                            ...(req.body.upworkUrl ? [{ platform: 'UPWORK', platformHandle: req.body.upworkUrl, trustBoost: 15 }] : [])
                        ]
                    }
                } : {})
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                reliabilityScore: true,
                trustScore: true,
                verificationTier: true,
                commerceScore: true,
                hospitalityScore: true,
                freelanceScore: true,
                appointmentScore: true,
                createdAt: true,
                business: true,
            },
        });
        // Create pending Outcome Bond
        await database_1.prisma.outcomeBond.create({
            data: {
                userId: user.id,
                amount: 1.00, // $1 micro-bond (e.g. ~280 PKR)
                currency: 'USD',
                status: 'PENDING_PAYMENT',
                bookedAt: new Date(),
                releaseAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            }
        });
        // PAB referral fuel: a human signing up through a helper's code earns that helper $PAB.
        // Completes the human<->agent PAB loop (agents already earn PAB on referred gig completion).
        if (refCode) {
            try {
                const SIGNUP_REFERRAL_PAB = 25; // incentive fuel for bringing a real person in
                await database_1.prisma.treasuryPosition.create({
                    data: { bucket: 'REFERRAL_EARNED', amount: SIGNUP_REFERRAL_PAB, status: 'PENDING', txHash: `signup:${user.id}`, meta: { asset: 'PAB', source: 'REFERRAL_PAB_SIGNUP', referralCode: refCode, userId: user.id } },
                });
                logger_1.logger.info(`[referral] helper ${refCode} earned ${SIGNUP_REFERRAL_PAB} PAB for signup of ${user.email}`);
            }
            catch (e) {
                logger_1.logger.warn('[referral] PAB signup credit skipped', e.message);
            }
        }
        // Fire off async OSINT checks (background)
        osint_service_1.osintService.queueOSINTChecks(user.id, user.business?.id).catch(err => {
            logger_1.logger.error('Background OSINT check failed', err);
        });
        // Generate tokens
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        logger_1.logger.info(`New user registered: ${user.email} ${user.role === 'BUSINESS_OWNER' ? '(Business: ' + req.body.businessName + ')' : ''}`);
        // Sync to Odoo CRM if business owner
        if (resolvedRole === client_1.UserRole.BUSINESS_OWNER && req.body.businessName) {
            // Fire and forget (don't block the request)
            odoo_service_1.odooService.syncNewBusiness({
                firstName,
                lastName,
                email,
                phone,
                businessName: req.body.businessName
            }).catch(err => logger_1.logger.error('Failed async Odoo sync:', err));
        }
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user,
                token,
                refreshToken,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL;
        const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD;
        if (demoAdminEmail && email === demoAdminEmail && password === demoAdminPassword) {
            const token = jsonwebtoken_1.default.sign({ id: 'admin', email, role: 'ADMIN' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            const refreshToken = jsonwebtoken_1.default.sign({ id: 'admin' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
            return res.json({ success: true, token, refreshToken, data: { user: { id: 'admin', email, role: 'ADMIN' } } });
        }
        logger_1.logger.info(`Login controller received email: '${email}'`);
        // Find user
        const user = await database_1.prisma.user.findUnique({
            where: { email },
            include: { business: true }
        });
        if (!user) {
            throw new errorHandler_1.CustomError('Invalid email or password', 401);
        }
        // Check account lockout
        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            throw new errorHandler_1.CustomError('Account is temporarily locked due to multiple failed login attempts. Please try again later.', 403);
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValidPassword) {
            const failedAttempts = (user.failedLoginAttempts || 0) + 1;
            let lockedUntil = null;
            if (failedAttempts >= 5) {
                lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
            }
            await database_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: failedAttempts,
                    accountLockedUntil: lockedUntil
                }
            });
            throw new errorHandler_1.CustomError('Invalid email or password', 401);
        }
        // Reset lockout counters on success
        if (user.failedLoginAttempts > 0) {
            await database_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: 0,
                    accountLockedUntil: null
                }
            });
        }
        // Generate tokens
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        logger_1.logger.info(`User logged in: ${user.email}`);
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    role: user.role,
                    reliabilityScore: user.reliabilityScore,
                    trustScore: user.trustScore,
                    verificationTier: user.verificationTier,
                    commerceScore: user.commerceScore,
                    hospitalityScore: user.hospitalityScore,
                    freelanceScore: user.freelanceScore,
                    appointmentScore: user.appointmentScore,
                    business: user.business,
                },
                token,
                refreshToken,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new errorHandler_1.CustomError('Refresh token is required', 400);
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, JWT_REFRESH_SECRET);
        const user = await database_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                role: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.CustomError('User not found', 404);
        }
        const newToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({
            success: true,
            data: {
                token: newToken,
            },
        });
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errorHandler_1.CustomError('Invalid refresh token', 401));
        }
        else {
            next(error);
        }
    }
};
exports.refreshToken = refreshToken;
const verifyEmail = async (req, res, next) => {
    try {
        // In production, implement email verification logic
        const user = await database_1.prisma.user.update({
            where: { id: req.user.id },
            data: { isEmailVerified: true },
        });
        res.json({
            success: true,
            message: 'Email verified successfully',
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyEmail = verifyEmail;
const verifyPhone = async (req, res, next) => {
    try {
        // In production, implement SMS verification logic
        const user = await database_1.prisma.user.update({
            where: { id: req.user.id },
            data: { isPhoneVerified: true },
        });
        res.json({
            success: true,
            message: 'Phone verified successfully',
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyPhone = verifyPhone;
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await database_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.',
            });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpires },
        });
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
        const { notificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification.service')));
        await notificationService.sendPasswordResetEmail(email, resetUrl, user.firstName);
        logger_1.logger.info(`Password reset email sent to ${email}. Token: ${resetToken}`);
        res.json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;
        const user = await database_1.prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpires: { gt: new Date() },
            },
        });
        if (!user) {
            throw new errorHandler_1.CustomError('Invalid or expired reset token', 400);
        }
        // Enforce password complexity
        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
        if (!passwordRegex.test(password)) {
            throw new errorHandler_1.CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpires: null,
            },
        });
        res.json({
            success: true,
            message: 'Password reset successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
const updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.CustomError('User not found', 404);
        }
        const isValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            throw new errorHandler_1.CustomError('Incorrect current password', 401);
        }
        // Enforce password complexity
        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            throw new errorHandler_1.CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await database_1.prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
        res.json({
            success: true,
            message: 'Password updated successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updatePassword = updatePassword;
const getTrustAttestation = async (req, res, next) => {
    try {
        const { trustAttestationService } = await Promise.resolve().then(() => __importStar(require('../services/trustAttestation.service')));
        const attestation = await trustAttestationService.issue(req.user.id);
        res.json({
            success: true,
            data: { attestation },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getTrustAttestation = getTrustAttestation;
const updateProfile = async (req, res, next) => {
    try {
        const { firstName, lastName } = req.body;
        const user = await database_1.prisma.user.update({
            where: { id: req.user.id },
            data: { firstName, lastName },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                business: true,
            }
        });
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const getNonce = async (req, res, next) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            throw new errorHandler_1.CustomError('Invalid wallet address', 400);
        }
        const nonce = Date.now() + '_' + crypto_1.default.randomBytes(32).toString('hex');
        let user = await database_1.prisma.user.findUnique({ where: { walletAddress: walletAddress.toLowerCase() } });
        if (!user) {
            // Create stub user
            const passwordHash = await bcryptjs_1.default.hash(crypto_1.default.randomBytes(32).toString('hex'), 12);
            user = await database_1.prisma.user.create({
                data: {
                    email: `${walletAddress.toLowerCase()}@pabandi.local`, // placeholder
                    firstName: 'Web3',
                    lastName: 'User',
                    passwordHash,
                    walletAddress: walletAddress.toLowerCase(),
                    nonce
                }
            });
        }
        else {
            user = await database_1.prisma.user.update({
                where: { id: user.id },
                data: { nonce }
            });
        }
        res.json({ success: true, data: { nonce: user.nonce } });
    }
    catch (error) {
        next(error);
    }
};
exports.getNonce = getNonce;
const verifyWallet = async (req, res, next) => {
    try {
        const { walletAddress, signature } = req.body;
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            throw new errorHandler_1.CustomError('Invalid wallet address', 400);
        }
        if (!signature || !/^0x[a-fA-F0-9]{130}$/.test(signature)) {
            throw new errorHandler_1.CustomError('Invalid signature format', 400);
        }
        const user = await database_1.prisma.user.findUnique({
            where: { walletAddress: walletAddress.toLowerCase() },
            include: { business: true }
        });
        if (!user || !user.nonce) {
            throw new errorHandler_1.CustomError('Nonce not found. Please request a new nonce.', 400);
        }
        // Check expiration (5 minutes)
        const [timestampStr] = user.nonce.split('_');
        const timestamp = parseInt(timestampStr, 10);
        if (isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
            throw new errorHandler_1.CustomError('Nonce expired. Please request a new one.', 400);
        }
        const { ethers } = await Promise.resolve().then(() => __importStar(require('ethers')));
        const message = `Welcome to Pabandi!\n\nClick to sign in and accept the Pabandi Terms of Service: https://pabandi.app/tos\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${walletAddress}\n\nNonce:\n${user.nonce}`;
        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new errorHandler_1.CustomError('Signature verification failed', 401);
        }
        // Clear nonce to prevent replay attacks
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { nonce: null }
        });
        // Generate tokens
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        logger_1.logger.info(`User logged in via wallet: ${user.walletAddress}`);
        res.json({
            success: true,
            message: 'Wallet login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    role: user.role,
                    reliabilityScore: user.reliabilityScore,
                    trustScore: user.trustScore,
                    verificationTier: user.verificationTier,
                    commerceScore: user.commerceScore,
                    hospitalityScore: user.hospitalityScore,
                    freelanceScore: user.freelanceScore,
                    appointmentScore: user.appointmentScore,
                    walletAddress: user.walletAddress,
                    business: user.business,
                },
                token,
                refreshToken,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyWallet = verifyWallet;
const requestProfileChange = async (req, res, next) => {
    try {
        const { firstName, lastName, profilePictureUrl } = req.body;
        // Create a pending request
        const request = await database_1.prisma.profileChangeRequest.create({
            data: {
                userId: req.user.id,
                requestedChanges: { firstName, lastName, profilePictureUrl },
                status: 'PENDING',
            }
        });
        res.json({
            success: true,
            message: 'Profile change request submitted for admin approval',
            data: { request },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.requestProfileChange = requestProfileChange;
const getProfileChangeStatus = async (req, res, next) => {
    try {
        const requests = await database_1.prisma.profileChangeRequest.findMany({
            where: { userId: req.user.id, status: 'PENDING' },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: {
                hasPendingRequest: requests.length > 0,
                requests
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProfileChangeStatus = getProfileChangeStatus;
//# sourceMappingURL=auth.controller.js.map