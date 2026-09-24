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
exports.getProfileChangeStatus = exports.requestProfileChange = exports.verifyWallet = exports.getNonce = exports.updateProfile = exports.getTrustAttestation = exports.updatePassword = exports.resetPassword = exports.forgotPassword = exports.verifyPhone = exports.sendVerificationCode = exports.verifyLoginCode = exports.requestLoginCode = exports.verifyEmail = exports.refreshToken = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const encryption_1 = require("../utils/encryption");
const osint_service_1 = require("../services/osint.service");
const odoo_service_1 = require("../services/odoo.service");
const notification_service_1 = require("../services/notification.service");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isValidSolanaAddress = (address) => typeof address === 'string' && SOLANA_ADDRESS_REGEX.test(address.trim());
const createWalletNonce = () => `${Date.now()}_${crypto_1.default.randomBytes(24).toString('hex')}`;
// Email helper functions (inline since no email util)
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const sendVerificationEmail = async (email, code, firstName) => {
    return notification_service_1.notificationService.sendVerificationEmail(email, code, firstName);
};
const isEmailConfigured = () => {
    return !!process.env.SENDGRID_API_KEY || !!process.env.MAILGUN_API_KEY;
};
const register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, phone, role, refCode, code } = req.body;
        // If code is provided, verify it first (code-based registration flow)
        if (code) {
            const user = await database_1.prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(400).json({ success: false, message: 'Invalid registration link' });
            }
            if (!user.verificationCode || !user.verificationCodeExpires) {
                return res.status(400).json({ success: false, message: 'No verification code found. Please start over.' });
            }
            if (new Date() > user.verificationCodeExpires) {
                return res.status(400).json({ success: false, message: 'Verification code expired. Please start over.' });
            }
            if (code !== user.verificationCode) {
                return res.status(400).json({ success: false, message: 'Invalid verification code' });
            }
            // Verify password complexity
            const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
            if (!passwordRegex.test(password)) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)'
                });
            }
            // Hash password
            const passwordHash = await bcrypt_1.default.hash(password, 12);
            // Update user with password and complete registration
            const updatedUser = await database_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    firstName,
                    lastName,
                    phone,
                    role: role === 'BUSINESS_OWNER' ? client_1.UserRole.BUSINESS_OWNER : client_1.UserRole.CUSTOMER,
                    verificationCode: null,
                    verificationCodeExpires: null,
                    isEmailVerified: true,
                    ...(req.body.businessName && role === 'BUSINESS_OWNER' && {
                        business: {
                            create: {
                                name: req.body.businessName,
                                category: 'RESTAURANT',
                                address: 'Global',
                                phone: phone || '',
                                email: email,
                                googlePlaceId: req.body.googlePlaceId,
                            }
                        }
                    }),
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
            // Generate tokens
            const token = jsonwebtoken_1.default.sign({ id: updatedUser.id, email: updatedUser.email, role: updatedUser.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            const refreshToken = jsonwebtoken_1.default.sign({ id: updatedUser.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
            logger_1.logger.info(`User completed registration via code: ${updatedUser.email}`);
            return res.status(201).json({
                success: true,
                message: 'Registration completed successfully',
                data: {
                    user: updatedUser,
                    token,
                    refreshToken,
                },
            });
        }
        // Standard registration flow (without code)
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
        const passwordHash = await bcrypt_1.default.hash(password, 12);
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
        // Generate email verification code and send it
        const verificationCode = generateVerificationCode();
        const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { verificationCode, verificationCodeExpires },
        });
        sendVerificationEmail(email, verificationCode, firstName).catch(err => {
            logger_1.logger.error('Failed to send verification email:', err);
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
        const isValidPassword = await bcrypt_1.default.compare(password, user.passwordHash);
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
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Verification code is required' });
        }
        const user = await database_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.isEmailVerified) {
            return res.json({ success: true, message: 'Email already verified' });
        }
        if (!user.verificationCode || !user.verificationCodeExpires) {
            return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
        }
        if (new Date() > user.verificationCodeExpires) {
            return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
        }
        if (code !== user.verificationCode) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                verificationCode: null,
                verificationCodeExpires: null,
            },
        });
        res.json({ success: true, message: 'Email verified successfully' });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyEmail = verifyEmail;
// Public email code login: request code for any email (no auth required)
const requestLoginCode = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email required' });
        }
        let user = await database_1.prisma.user.findUnique({ where: { email } });
        const isNewUser = !user;
        if (isNewUser) {
            // Create a pending user record for email code login
            const passwordHash = await bcrypt_1.default.hash(crypto_1.default.randomBytes(32).toString('hex'), 12);
            user = await database_1.prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    firstName: 'User',
                    lastName: '',
                    role: client_1.UserRole.CUSTOMER,
                    reliabilityScore: 750,
                    trustScore: 50.0,
                    verificationTier: 'BASIC',
                    gracePeriodUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
                },
            });
        }
        // At this point, user is guaranteed to exist
        const userRecord = user;
        const verificationCode = generateVerificationCode();
        const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await database_1.prisma.user.update({
            where: { id: userRecord.id },
            data: { verificationCode, verificationCodeExpires },
        });
        const sent = await sendVerificationEmail(email, verificationCode, userRecord.firstName || 'User');
        if (!sent) {
            // sendEmail returns LOGGED (not SENT) when no provider is configured —
            // surface that honestly instead of claiming a code was mailed.
            const configured = isEmailConfigured();
            return res.status(configured ? 500 : 503).json({
                success: false,
                message: configured
                    ? 'Failed to send code. Please try again.'
                    : 'Email codes are temporarily unavailable. Please sign up or log in with your password instead.',
            });
        }
        res.json({ success: true, message: 'Code sent', isNewUser });
    }
    catch (error) {
        next(error);
    }
};
exports.requestLoginCode = requestLoginCode;
// Public email code login: verify code and login/register (no auth required)
const verifyLoginCode = async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'Email and code required' });
        }
        const user = await database_1.prisma.user.findUnique({
            where: { email },
            include: { business: true }
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid code' });
        }
        if (!user.verificationCode || !user.verificationCodeExpires) {
            return res.status(400).json({ success: false, message: 'No code found. Please request a new one.' });
        }
        if (new Date() > user.verificationCodeExpires) {
            return res.status(400).json({ success: false, message: 'Code expired. Please request a new one.' });
        }
        if (code !== user.verificationCode) {
            return res.status(400).json({ success: false, message: 'Invalid code' });
        }
        // Clear the verification code
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { verificationCode: null, verificationCodeExpires: null, isEmailVerified: true },
        });
        // Generate tokens
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        logger_1.logger.info(`User logged in via email code: ${user.email}`);
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
exports.verifyLoginCode = verifyLoginCode;
const sendVerificationCode = async (req, res, next) => {
    try {
        const user = await database_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.isEmailVerified) {
            return res.json({ success: true, message: 'Email already verified' });
        }
        const verificationCode = generateVerificationCode();
        const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { verificationCode, verificationCodeExpires },
        });
        const sent = await sendVerificationEmail(user.email, verificationCode, user.firstName);
        if (!sent) {
            return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
        }
        res.json({ success: true, message: 'Verification code sent to your email' });
    }
    catch (error) {
        next(error);
    }
};
exports.sendVerificationCode = sendVerificationCode;
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
        const passwordHash = await bcrypt_1.default.hash(password, 12);
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
        const isValid = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            throw new errorHandler_1.CustomError('Incorrect current password', 401);
        }
        // Enforce password complexity
        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            throw new errorHandler_1.CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 12);
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
        const walletAddressRaw = typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
        let walletAddress;
        try {
            walletAddress = new web3_js_1.PublicKey(walletAddressRaw).toString();
        }
        catch {
            throw new errorHandler_1.CustomError('Invalid Solana wallet address', 400);
        }
        const nonce = createWalletNonce();
        let user = await database_1.prisma.user.findUnique({ where: { walletAddress } });
        if (!user) {
            user = await database_1.prisma.user.create({
                data: {
                    email: `${walletAddress}@wallet.pabandi.local`,
                    firstName: 'Wallet',
                    lastName: 'User',
                    passwordHash: await bcrypt_1.default.hash(crypto_1.default.randomBytes(32).toString('hex'), 12),
                    walletAddress,
                    role: client_1.UserRole.CUSTOMER,
                    reliabilityScore: 750,
                    trustScore: 50.0,
                    verificationTier: 'BASIC',
                    gracePeriodUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
                    wallet: {
                        create: {
                            address: walletAddress,
                            balance: 0,
                            currency: 'PAB',
                        },
                    },
                },
            });
        }
        else {
            user = await database_1.prisma.user.update({
                where: { id: user.id },
                data: { nonce },
            });
        }
        return res.json({ success: true, data: { nonce: user.nonce, walletAddress } });
    }
    catch (error) {
        next(error);
    }
};
exports.getNonce = getNonce;
const verifyWallet = async (req, res, next) => {
    try {
        const walletAddressRaw = typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
        const signature = typeof req.body?.signature === 'string' ? req.body.signature.trim() : '';
        let walletAddress;
        try {
            walletAddress = new web3_js_1.PublicKey(walletAddressRaw).toString();
        }
        catch {
            throw new errorHandler_1.CustomError('Invalid Solana wallet address', 400);
        }
        if (!signature) {
            throw new errorHandler_1.CustomError('Wallet signature is required', 400);
        }
        const user = await database_1.prisma.user.findUnique({
            where: { walletAddress },
            include: { business: true, wallet: true },
        });
        if (!user || !user.nonce) {
            throw new errorHandler_1.CustomError('Nonce not found. Please request a new sign-in code.', 400);
        }
        const nonceParts = user.nonce.split('_');
        const timestamp = Number(nonceParts[0]);
        if (Number.isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
            await database_1.prisma.user.update({ where: { id: user.id }, data: { nonce: null } });
            throw new errorHandler_1.CustomError('Sign-in code expired. Please request a new one.', 400);
        }
        const message = `Welcome to Pabandi!\n\nClick to sign in and accept the Pabandi Terms of Service: https://pabandi.app/tos\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${walletAddress}\n\nNonce:\n${user.nonce}`;
        const nacl = await Promise.resolve().then(() => __importStar(require('tweetnacl')));
        const bs58 = await Promise.resolve().then(() => __importStar(require('bs58')));
        const signatureBytes = bs58.default.decode(signature);
        const isValid = nacl.sign.detached.verify(new TextEncoder().encode(message), signatureBytes, new web3_js_1.PublicKey(walletAddress).toBytes());
        if (!isValid) {
            throw new errorHandler_1.CustomError('Signature verification failed. Please try again.', 401);
        }
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { nonce: null },
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        logger_1.logger.info(`User logged in via wallet: ${walletAddress}`);
        return res.json({
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
                    walletAddress: user.walletAddress || walletAddress,
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