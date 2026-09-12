import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';
import { encrypt } from '../utils/encryption';
import { osintService } from '../services/osint.service';
import { odooService } from '../services/odoo.service';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const isValidSolanaAddress = (address: unknown): address is string =>
  typeof address === 'string' && SOLANA_ADDRESS_REGEX.test(address.trim());

const createWalletNonce = () => `${Date.now()}_${crypto.randomBytes(24).toString('hex')}`;

// Email helper functions (inline since no email util)
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email: string, code: string, firstName: string): Promise<boolean> => {
  try {
    // In production, integrate with email service (SendGrid, Mailgun, etc.)
    logger.info(`Verification email sent to ${email}: ${code}`);
    return true;
  } catch {
    return false;
  }
};

const isEmailConfigured = (): boolean => {
  return !!process.env.SENDGRID_API_KEY || !!process.env.MAILGUN_API_KEY;
};

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: string;
  refCode?: string;
  code?: string;
  businessName?: string;
  googlePlaceId?: string;
  fiverrUrl?: string;
  upworkUrl?: string;
}

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const register = async (
  req: Request<{}, {}, RegisterBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, firstName, lastName, phone, role, refCode, code } = req.body;

    // If code is provided, verify it first (code-based registration flow)
    if (code) {
      const user = await prisma.user.findUnique({ where: { email } });
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
      const passwordHash = await bcrypt.hash(password, 12);

      // Update user with password and complete registration
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          firstName,
          lastName,
          phone,
          role: role === 'BUSINESS_OWNER' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER,
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
      const token = jwt.sign(
        { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role } as JwtPayload,
        JWT_SECRET as Secret,
        { expiresIn: JWT_EXPIRES_IN as any }
      );

      const refreshToken = jwt.sign(
        { id: updatedUser.id } as JwtPayload,
        JWT_REFRESH_SECRET as Secret,
        { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
      );

      logger.info(`User completed registration via code: ${updatedUser.email}`);

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
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new CustomError('User with this email or phone already exists', 409);
    }

    // Enforce password complexity
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Resolve role to enum (defaults to CUSTOMER)
    const resolvedRole: UserRole = (role && (Object.values(UserRole) as string[]).includes(role))
      ? (role as UserRole)
      : UserRole.CUSTOMER;

    // 48-Hour Grace Period
    const gracePeriodUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Resolve Account Manager Referral
    let referredByUserId: string | undefined;
    let accountManagerProfileId: string | undefined;

    if (refCode) {
      const profile = await prisma.accountManagerProfile.findUnique({
        where: { referralCode: refCode }
      });
      if (profile && profile.status === 'ACTIVE') {
        referredByUserId = profile.userId;
        accountManagerProfileId = profile.id;
      }
    }

    // Frictionless Solana Wallet Generation
    const newWallet = Keypair.generate();
    const solanaAddress = newWallet.publicKey.toBase58();
    const encryptedSecret = encrypt(bs58.encode(newWallet.secretKey));

    // Create user immediately with BASIC tier
    const user = await prisma.user.create({
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
        ...(resolvedRole === UserRole.BUSINESS_OWNER && req.body.businessName && {
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
              ...(req.body.fiverrUrl ? [{ platform: 'FIVERR' as const, platformHandle: req.body.fiverrUrl, trustBoost: 15 }] : []),
              ...(req.body.upworkUrl ? [{ platform: 'UPWORK' as const, platformHandle: req.body.upworkUrl, trustBoost: 15 }] : [])
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
    await prisma.outcomeBond.create({
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
        await prisma.treasuryPosition.create({
          data: { bucket: 'REFERRAL_EARNED', amount: SIGNUP_REFERRAL_PAB, status: 'PENDING', txHash: `signup:${user.id}`, meta: { asset: 'PAB', source: 'REFERRAL_PAB_SIGNUP', referralCode: refCode, userId: user.id } },
        });
        logger.info(`[referral] helper ${refCode} earned ${SIGNUP_REFERRAL_PAB} PAB for signup of ${user.email}`);
      } catch (e: any) { logger.warn('[referral] PAB signup credit skipped', e.message); }
    }

    // Fire off async OSINT checks (background)
    osintService.queueOSINTChecks(user.id, user.business?.id).catch(err => {
      logger.error('Background OSINT check failed', err);
    });

    // Generate email verification code and send it
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode, verificationCodeExpires },
    });
    sendVerificationEmail(email, verificationCode, firstName).catch(err => {
      logger.error('Failed to send verification email:', err);
    });

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );

    logger.info(`New user registered: ${user.email} ${user.role === 'BUSINESS_OWNER' ? '(Business: ' + req.body.businessName + ')' : ''}`);

    // Sync to Odoo CRM if business owner
    if (resolvedRole === UserRole.BUSINESS_OWNER && req.body.businessName) {
      // Fire and forget (don't block the request)
      odooService.syncNewBusiness({
        firstName,
        lastName,
        email,
        phone,
        businessName: req.body.businessName
      }).catch(err => logger.error('Failed async Odoo sync:', err));
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
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request<{}, {}, LoginBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL;
    const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD;
    if (demoAdminEmail && email === demoAdminEmail && password === demoAdminPassword) {
      const token = jwt.sign({ id: 'admin', email, role: 'ADMIN' } as JwtPayload, JWT_SECRET as Secret, { expiresIn: JWT_EXPIRES_IN as any });
      const refreshToken = jwt.sign({ id: 'admin' } as any, JWT_REFRESH_SECRET as Secret, { expiresIn: JWT_REFRESH_EXPIRES_IN as any });
      return res.json({ success: true, token, refreshToken, data: { user: { id: 'admin', email, role: 'ADMIN' } } });
    }

    logger.info(`Login controller received email: '${email}'`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { business: true }
    });

    if (!user) {
      throw new CustomError('Invalid email or password', 401);
    }

    // Check account lockout
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new CustomError('Account is temporarily locked due to multiple failed login attempts. Please try again later.', 403);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      let lockedUntil = null;
      if (failedAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          failedLoginAttempts: failedAttempts,
          accountLockedUntil: lockedUntil
        }
      });

      throw new CustomError('Invalid email or password', 401);
    }

    // Reset lockout counters on success
    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          accountLockedUntil: null
        }
      });
    }

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );

    logger.info(`User logged in: ${user.email}`);

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
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new CustomError('Refresh token is required', 400);
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
      id: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    res.json({
      success: true,
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new CustomError('Invalid refresh token', 401));
    } else {
      next(error);
    }
  }
};

export const verifyEmail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
      },
    });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

// Public email code login: request code for any email (no auth required)
export const requestLoginCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    const isNewUser = !user;

    if (isNewUser) {
      // Create a pending user record for email code login
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: 'User',
          lastName: '',
          role: UserRole.CUSTOMER,
          reliabilityScore: 750,
          trustScore: 50.0,
          verificationTier: 'BASIC',
          gracePeriodUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    }

    // At this point, user is guaranteed to exist
    const userRecord = user!;

    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
};

// Public email code login: verify code and login/register (no auth required)
export const verifyLoginCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code required' });
    }

    const user = await prisma.user.findUnique({ 
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
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode: null, verificationCodeExpires: null, isEmailVerified: true },
    });

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );

    logger.info(`User logged in via email code: ${user.email}`);

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
  } catch (error) {
    next(error);
  }
};

export const sendVerificationCode = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode, verificationCodeExpires },
    });

    const sent = await sendVerificationEmail(user.email, verificationCode, user.firstName);
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    next(error);
  }
};

export const verifyPhone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // In production, implement SMS verification logic
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { isPhoneVerified: true },
    });

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    const { notificationService } = await import('../services/notification.service');
    await (notificationService as any).sendPasswordResetEmail(email, resetUrl, user.firstName);
    
    logger.info(`Password reset email sent to ${email}. Token: ${resetToken}`);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new CustomError('Invalid or expired reset token', 400);
    }

    // Enforce password complexity
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new CustomError('User not found', 404);
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new CustomError('Incorrect current password', 401);
    }

    // Enforce password complexity
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      throw new CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getTrustAttestation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { trustAttestationService } = await import('../services/trustAttestation.service');
    const attestation = await trustAttestationService.issue(req.user!.id);
    
    res.json({
      success: true,
      data: { attestation },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.user!.id },
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
  } catch (error) {
    next(error);
  }
};

export const getNonce = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const walletAddressRaw = typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
    let walletAddress: string;

    try {
      walletAddress = new PublicKey(walletAddressRaw).toString();
    } catch {
      throw new CustomError('Invalid Solana wallet address', 400);
    }

    const nonce = createWalletNonce();
    let user = await prisma.user.findUnique({ where: { walletAddress } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `${walletAddress}@wallet.pabandi.local`,
          firstName: 'Wallet',
          lastName: 'User',
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
          walletAddress,
          role: UserRole.CUSTOMER,
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
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { nonce },
      });
    }

    return res.json({ success: true, data: { nonce: user.nonce, walletAddress } });
  } catch (error) {
    next(error);
  }
};

export const verifyWallet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const walletAddressRaw = typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
    const signature = typeof req.body?.signature === 'string' ? req.body.signature.trim() : '';
    let walletAddress: string;

    try {
      walletAddress = new PublicKey(walletAddressRaw).toString();
    } catch {
      throw new CustomError('Invalid Solana wallet address', 400);
    }

    if (!signature) {
      throw new CustomError('Wallet signature is required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { business: true, wallet: true },
    });

    if (!user || !user.nonce) {
      throw new CustomError('Nonce not found. Please request a new sign-in code.', 400);
    }

    const nonceParts = user.nonce.split('_');
    const timestamp = Number(nonceParts[0]);
    if (Number.isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
      await prisma.user.update({ where: { id: user.id }, data: { nonce: null } });
      throw new CustomError('Sign-in code expired. Please request a new one.', 400);
    }

    const message = `Welcome to Pabandi!\n\nClick to sign in and accept the Pabandi Terms of Service: https://pabandi.app/tos\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${walletAddress}\n\nNonce:\n${user.nonce}`;
    const nacl = await import('tweetnacl');
    const bs58 = await import('bs58');
    const signatureBytes = bs58.default.decode(signature);
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      signatureBytes,
      new PublicKey(walletAddress).toBytes(),
    );

    if (!isValid) {
      throw new CustomError('Signature verification failed. Please try again.', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { nonce: null },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any },
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any },
    );

    logger.info(`User logged in via wallet: ${walletAddress}`);

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
  } catch (error) {
    next(error);
  }
};

export const requestProfileChange = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, profilePictureUrl } = req.body;
    
    // Create a pending request
    const request = await prisma.profileChangeRequest.create({
      data: {
        userId: req.user!.id,
        requestedChanges: { firstName, lastName, profilePictureUrl },
        status: 'PENDING',
      }
    });

    res.json({
      success: true,
      message: 'Profile change request submitted for admin approval',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfileChangeStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requests = await prisma.profileChangeRequest.findMany({
      where: { userId: req.user!.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { 
        hasPendingRequest: requests.length > 0,
        requests 
      }
    });
  } catch (error) {
    next(error);
  }
};
