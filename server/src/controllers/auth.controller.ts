import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { UserRole } from '@prisma/client';
import type { Secret, JwtPayload } from 'jsonwebtoken';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { odooService } from '../services/odoo.service';
import { osintService } from '../services/osint.service';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: string;
  businessName?: string;
  googlePlaceId?: string;
  fiverrUrl?: string;
  upworkUrl?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { encrypt } from '../utils/encryption';

export const register = async (
  req: Request<{}, {}, RegisterBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

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

    // Fire off async OSINT checks (background)
    osintService.queueOSINTChecks(user.id, user.business?.id).catch(err => {
      logger.error('Background OSINT check failed', err);
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
    // In production, implement email verification logic
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { isEmailVerified: true },
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: { user },
    });
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
    const { walletAddress } = req.body;
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new CustomError('Invalid wallet address', 400);
    }

    const nonce = Date.now() + '_' + crypto.randomBytes(32).toString('hex');
    let user = await prisma.user.findUnique({ where: { walletAddress: walletAddress.toLowerCase() } });

    if (!user) {
      // Create stub user
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          email: `${walletAddress.toLowerCase()}@web3.pabandi.local`, // placeholder
          firstName: 'Web3',
          lastName: 'User',
          passwordHash,
          walletAddress: walletAddress.toLowerCase(),
          nonce
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { nonce }
      });
    }

    res.json({ success: true, data: { nonce: user.nonce } });
  } catch (error) {
    next(error);
  }
};

export const verifyWallet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new CustomError('Invalid wallet address', 400);
    }
    
    if (!signature || !/^0x[a-fA-F0-9]{130}$/.test(signature)) {
      throw new CustomError('Invalid signature format', 400);
    }

    const user = await prisma.user.findUnique({ 
      where: { walletAddress: walletAddress.toLowerCase() }, 
      include: { business: true } 
    });
    
    if (!user || !user.nonce) {
      throw new CustomError('Nonce not found. Please request a new nonce.', 400);
    }

    // Check expiration (5 minutes)
    const [timestampStr] = user.nonce.split('_');
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
      throw new CustomError('Nonce expired. Please request a new one.', 400);
    }

    const { ethers } = await import('ethers');
    const message = `Welcome to Pabandi!\n\nClick to sign in and accept the Pabandi Terms of Service: https://pabandi.app/tos\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${walletAddress}\n\nNonce:\n${user.nonce}`;
    
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new CustomError('Signature verification failed', 401);
    }

    // Clear nonce to prevent replay attacks
    await prisma.user.update({
      where: { id: user.id },
      data: { nonce: null }
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

    logger.info(`User logged in via wallet: ${user.walletAddress}`);

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
  } catch (error) {
    next(error);
  }
};
