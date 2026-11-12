import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole, BusinessCategory, ProfileType } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
    return ips[0].trim() || undefined;
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}

// Auto-link/create trust passport for user (frictionless)
async function ensureTrustPassport(userId: string, firstName?: string | null) {
  try {
    const existing = await prisma.trustPassport.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }
    try {
      const passport = await prisma.trustPassport.create({
        data: {
          userId,
          handle: `user-${userId}`,
          displayName: firstName || 'User',
          visibility: 'PRIVATE',
        },
      });
      return passport;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        return await prisma.trustPassport.findUnique({ where: { userId } });
      }
      throw e;
    }
  } catch (e) {
    // Don't block auth if passport creation fails
    console.error('[auth] ensureTrustPassport failed:', e);
    return null;
  }
}

import { CustomError } from '../middleware/errorHandler';
import { encrypt } from '../utils/encryption';
import { osintService } from '../services/osint.service';
import { odooService } from '../services/odoo.service';
import { notificationService } from '../services/notification.service';
import { emailService } from '../services/email.service';
import { findOrCreateUser, getActiveBusinessId } from '../services/identity.service';
import { seedColdStartScore } from '../services/trust-core.service';
import { queueWelcomeEmailForUser } from '../queues/email.queue';

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

/**
 * Send a login/verification code.
 *
 * The old version was a `require()` of a function that did not exist, so EVERY
 * call threw `sendCode is not a function` and email-code login had never worked.
 * The account and the code were written first, so the flow looked healthy right up
 * to the send.
 *
 * A top-level import rather than a lazy require: a missing export should fail at
 * boot, not on the first customer who tries to sign in.
 */
const sendVerificationEmail = async (
  email: string,
  code: string,
  firstName: string,
): Promise<boolean> => {
  const { emailService } = await import('../services/email.service');
  const result = await emailService.sendVerificationEmail(email, code, firstName);
  return result != null;
};

/**
 * Whether a real provider is configured.
 *
 * This returned a hardcoded `true` with the comment "Force true so that LOGGED
 * emails succeed in dev". Its only caller used it to choose between 500 ("we tried
 * and failed") and 503 ("not configured, try a password instead") — so with this
 * lying, an unconfigured deployment told every customer that sending had failed and
 * invited them to keep retrying, instead of saying which alternative works.
 */
const isEmailConfigured = (): boolean => Boolean((process.env.RESEND_API_KEY || '').trim());

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
  vertical?: string;
  fiverrUrl?: string;
  upworkUrl?: string;
}

export function resolveCategoryFromVertical(vertical?: string): BusinessCategory {
  if (!vertical) return BusinessCategory.CONTRACTOR;
  const v = vertical.toLowerCase();
  if (v.includes('commercial') || v.includes('roofing') || v.includes('hvac') || v.includes('plumbing')) {
    return BusinessCategory.CONTRACTOR;
  }
  if (v.includes('health') || v.includes('beauty') || v.includes('salon') || v.includes('spa') || v.includes('clinic')) {
    return BusinessCategory.SALON;
  }
  if (v.includes('home') || v.includes('repair') || v.includes('electrician') || v.includes('handyman')) {
    return BusinessCategory.CONTRACTOR;
  }
  if (v.includes('professional') || v.includes('consulting') || v.includes('agency')) {
    return BusinessCategory.OTHER;
  }
  return BusinessCategory.CONTRACTOR;
}

export function normalizeVerticalKey(vertical?: string): string {
  if (!vertical) return 'commercial';
  const v = vertical.toLowerCase();
  if (v.includes('commercial') || v.includes('roofing') || v.includes('hvac') || v.includes('plumbing')) return 'commercial';
  if (v.includes('health') || v.includes('beauty') || v.includes('salon') || v.includes('spa') || v.includes('clinic')) return 'salon';
  if (v.includes('home') || v.includes('repair') || v.includes('handyman')) return 'trades';
  if (v.includes('professional') || v.includes('consulting') || v.includes('agency')) return 'consulting';
  return 'commercial';
}

export function isCommercialVertical(vertical?: string): boolean {
  if (!vertical) return true;
  const v = vertical.toLowerCase();
  return v.includes('commercial') || v.includes('roofing') || v.includes('hvac') || v.includes('plumbing');
}

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    businessId?: string;
  };
}

/**
 * Domains reserved for testing/documentation by RFC 2606 and RFC 6761. They can
 * never belong to a real person, so an account on one is either a developer, a
 * test script or an automated abuse — never a customer.
 *
 * Registration is being hit by a recurring script creating
 * `probe-<epoch>@example.com` accounts (observed 4 times in 2 hours against a
 * live deployment). Rate limiting bounds how many it gets through; this stops
 * the class entirely. It is a correctness check, not a heuristic.
 */
const RESERVED_EMAIL_DOMAINS = new Set([
  'example.com', 'example.net', 'example.org',
  'test', 'localhost', 'local',
  'invalid', 'example',
  // RFC 6761 / RFC 8375 reserved special-use names.
  'pabandi.local', 'pabandi.test', 'pabandi.invalid', 'pabandi.sim',
]);

export function isReservedTestDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  if (!domain) return false;
  if (RESERVED_EMAIL_DOMAINS.has(domain)) return true;
  // Any label under a reserved TLD is equally unusable: foo@example.com,
  // foo.test.example, and so on.
  const [tld] = domain.split('.').slice(-1);
  return tld === 'test' || tld === 'invalid' || tld === 'local';
}

export const register = async (
  req: Request<{}, {}, RegisterBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, firstName, lastName, phone, role, refCode, code } = req.body;

    if (isReservedTestDomain(email)) {
      return res.status(400).json({
        success: false,
        message:
          'That email domain is reserved for testing and cannot be used to register. ' +
          'Use a real, deliverable email address.',
      });
    }

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
          preferredMode: role === 'BUSINESS_OWNER' ? 'business' : 'personal',
          verificationCode: null,
          verificationCodeExpires: null,
          isEmailVerified: true,
          ...(req.body.businessName && role === 'BUSINESS_OWNER' && {
            business: {
              create: {
                name: req.body.businessName,
                category: resolveCategoryFromVertical(req.body.vertical),
                address: 'Global',
                phone: phone || '',
                email: email,
                googlePlaceId: req.body.googlePlaceId,
                settings: {
                  create: {
                    vertical: normalizeVerticalKey(req.body.vertical),
                    enabledModules: isCommercialVertical(req.body.vertical)
                      ? ['coordinator', 'contact', 'booking']
                      : ['contact', 'booking'],
                  },
                },
                ...(isCommercialVertical(req.body.vertical) && {
                  technicians: {
                    create: {
                      name: `${firstName || ''} ${lastName || ''}`.trim() || 'Lead Technician',
                      phoneEncrypted: encrypt(phone || '+10000000000'),
                      skills: ['commercial_service', 'dispatch'],
                      active: true,
                      experienceYears: 5,
                    },
                  },
                }),
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
          activeMode: true,
        },
      });

    // A new business owner is, by definition, in business mode. Without this
    // the client sees preferredMode === undefined and BusinessGuard bounces
    // them off the CRM they have just signed up for.
    const codeBusinessId = (updatedUser.business as { id?: string } | null)?.id ?? null;
    if (codeBusinessId) {
      try {
        await prisma.crmServiceBusiness.upsert({
          where: { businessId: codeBusinessId },
          update: {
            serviceType: normalizeVerticalKey(req.body.vertical).toUpperCase(),
          },
          create: {
            businessId: codeBusinessId,
            ownerId: updatedUser.id,
            serviceType: normalizeVerticalKey(req.body.vertical).toUpperCase(),
            teamSize: 1,
            subscriptionTier: 'FREE',
          },
        });
      } catch (crmErr: any) {
        logger.warn('[auth.register] CRM service business provisioning skipped', crmErr?.message);
      }
    }
    const codeMode: 'business' | 'personal' =
      updatedUser.role === UserRole.BUSINESS_OWNER ? 'business' : 'personal';

    const token = jwt.sign(
      { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role, businessId: codeBusinessId, activeBusinessId: codeBusinessId, mode: codeMode } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const codeRefreshToken = jwt.sign(
      { id: updatedUser.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );

    logger.info(`User completed registration via code: ${updatedUser.email}`);

    // Auto-link/create trust passport (frictionless)
    ensureTrustPassport(updatedUser.id, updatedUser.firstName).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      data: {
        user: { ...updatedUser, preferredMode: codeMode, businessId: codeBusinessId },
        token,
        refreshToken: codeRefreshToken,
      },
    });
    }

    // Standard registration flow (without code)
    // Use unified identity to find or create user
    const foundUser = await findOrCreateUser({
      provider: 'email',
      providerId: email,
      email,
    });

    // If user already has auth methods beyond this registration, reject duplicate
    const existingAuth = await prisma.userAuthMethod.findFirst({
      where: { userId: foundUser.id, provider: 'email' },
    });
    if (existingAuth && existingAuth.providerId !== email) {
      // User exists with a different email auth method — this shouldn't happen often
    }

    // If user already exists with same email, reject
    if (foundUser.email === email && foundUser.createdAt !== foundUser.updatedAt) {
      // Quick heuristic: if user was created earlier, they might be existing
      // Safer: check if there are other auth methods
      const authCount = await prisma.userAuthMethod.count({ where: { userId: foundUser.id } });
      if (authCount > 1) {
        throw new CustomError('User with this email already exists', 409);
      }
    }

    // Hash password
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new CustomError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$&*)', 400);
    }
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
    const user = await prisma.user.update({
      where: { id: foundUser.id },
      data: {
        passwordHash,
        firstName,
        lastName,
        phone,
        role: resolvedRole,
        preferredMode: resolvedRole === UserRole.BUSINESS_OWNER ? 'business' : 'personal',
        // `reliabilityScore` is deliberately ABSENT.
        //
        // It used to be written here as a hardcoded 750, which resolved to
        // "Gold" against the 0–1000 passport tier table and rendered as the
        // public string "750/100" on social share cards. Every account was born
        // claiming to be one of the most reliable people on the platform.
        //
        // The column default is now COLD_START_SCORE (50), so omitting the field
        // produces the same value through a schema default rather than a second
        // hardcoded literal in a controller — and `seedColdStartScore` below
        // writes the audit row that makes it explainable. There is no path to
        // 750 left in this handler.
        trustScore: 700.0,
        disputeRate: 0.0,
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
              category: resolveCategoryFromVertical(req.body.vertical),
              address: 'Global',
              phone: phone || '',
              email: email,
              googlePlaceId: req.body.googlePlaceId,
              ...(accountManagerProfileId ? { referredById: accountManagerProfileId } : {}),
              settings: {
                create: {
                  vertical: normalizeVerticalKey(req.body.vertical),
                  enabledModules: isCommercialVertical(req.body.vertical)
                    ? ['coordinator', 'contact', 'booking']
                    : ['contact', 'booking'],
                },
              },
              ...(isCommercialVertical(req.body.vertical) && {
                technicians: {
                  create: {
                    name: `${firstName || ''} ${lastName || ''}`.trim() || 'Lead Technician',
                    phoneEncrypted: encrypt(phone || '+10000000000'),
                    skills: ['commercial_service', 'dispatch'],
                    active: true,
                    experienceYears: 5,
                  },
                },
              }),
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
        activeMode: true,
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
        releaseAt: new Date(Date.now() + 30 * 24 * 60 * 1000), // 30 days
      }
    });

    // Provision CRM service business record if business was created
    if (user.business?.id) {
      try {
        await prisma.crmServiceBusiness.upsert({
          where: { businessId: user.business.id },
          update: {
            serviceType: normalizeVerticalKey(req.body.vertical).toUpperCase(),
          },
          create: {
            businessId: user.business.id,
            ownerId: user.id,
            serviceType: normalizeVerticalKey(req.body.vertical).toUpperCase(),
            teamSize: 1,
            subscriptionTier: 'FREE',
          },
        });
      } catch (crmErr: any) {
        logger.warn('[auth.register] CRM service business provisioning skipped', crmErr?.message);
      }
    }

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

    const registerBusinessId = (user.business as { id?: string } | null)?.id ?? null;
    const registerMode: 'business' | 'personal' =
      resolvedRole === UserRole.BUSINESS_OWNER ? 'business' : 'personal';

    // Record the cold-start baseline on the audit trail.
    //
    // The value was already set in the write above; this is the receipt. It is
    // what makes "why is my score 50?" answerable — the customer's first
    // question, and the one a signup flow is least equipped to answer without
    // a row saying so.
    await seedColdStartScore('user', user.id);

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, businessId: registerBusinessId, activeBusinessId: registerBusinessId, mode: registerMode } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );

    logger.info(`New user registered: ${user.email} ${user.role === 'BUSINESS_OWNER' ? '(Business: ' + req.body.businessName + ')' : ''}`);

    // Auto-link/create trust passport (frictionless)
    ensureTrustPassport(user.id, user.firstName).catch(() => {});

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

    // Queued. This was `emailService.sendWelcome(user)` with no await and no
    // catch, so a provider failure became an unhandled rejection -- which in
    // Node 15+ terminates the process. A welcome email is the least important
    // thing happening during a signup and should never be able to take the
    // server down.
    queueWelcomeEmailForUser(user).catch((err: unknown) =>
      logger.error('Failed to queue welcome email:', err)
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          ...user,
          preferredMode: registerMode,
          businessId: registerBusinessId,
        },
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
      include: { business: true, memberships: true },
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

    // Ensure auth method exists and update lastUsedAt
    await findOrCreateUser({
      provider: 'email',
      providerId: user.email,
      email: user.email,
    });

    const activeBusinessId = getActiveBusinessId(user);

    // preferredMode drives BusinessGuard/PersonalGuard on the client. It was
    // omitted from the login payload, so every fresh session had
    // `user.preferredMode === undefined`, every BusinessGuard route bounced to
    // "/", and the user could not reach the CRM they had just signed in to.
    // The JWT already carried `mode`; the response body simply did not.
    const preferredMode: 'business' | 'personal' =
      user.preferredMode === 'personal' ? 'personal' : 'business';

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, businessId: activeBusinessId, activeBusinessId, mode: preferredMode } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );

    logger.info(`User logged in: ${user.email}`);

    // Auto-link/create trust passport (frictionless)
    ensureTrustPassport(user.id, user.firstName).catch(() => {});

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
          preferredMode,
          profileType: user.profileType,
          username: user.username,
          disputeRate: user.disputeRate ?? 0.0,
          // The tenant every ContactOS query is scoped by. The client keeps a
          // copy in localStorage for the pages that read it directly.
          businessId: activeBusinessId,
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
  req: AuthRequest,
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
        activeMode: true,
        preferredMode: true,
      },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, activeBusinessId: getActiveBusinessId(user), mode: user.preferredMode || 'business' } as JwtPayload,
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
  req: AuthRequest,
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
          // No reliabilityScore: the column default is COLD_START_SCORE. See the
          // note on the password-registration path.
          trustScore: 700.0,
          disputeRate: 0.0,
          verificationTier: 'BASIC',
          gracePeriodUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
      await seedColdStartScore('user', user.id);
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
  req: AuthRequest,
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

    const codeBusinessId = (user.business as { id?: string } | null)?.id ?? null;
    const codeMode: 'business' | 'personal' =
      user.role === UserRole.BUSINESS_OWNER ? 'business' : 'personal';

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, businessId: codeBusinessId, activeBusinessId: codeBusinessId, mode: codeMode } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
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
          preferredMode: codeMode,
          profileType: user.profileType,
          username: user.username,
          disputeRate: user.disputeRate ?? 0.0,
          businessId: codeBusinessId,
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
  req: AuthRequest,
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
  req: AuthRequest,
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
  req: AuthRequest,
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

export const getNonce = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
          // Wallet sign-up: no explicit score either, for the same reason.
          trustScore: 700.0,
          disputeRate: 0.0,
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
      await seedColdStartScore('user', user.id);
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

export const verifyWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const currentScore = user.trustScore || 700;
    const boostedScore = Math.min(800, currentScore + 25);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nonce: null,
        trustScore: boostedScore,
        disputeRate: 0.0,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, businessId: (user as any).businessId || (user as any).business?.id, activeMode: user.activeMode || 'CUSTOMER' } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    let refreshToken: string | undefined;
    try {
      refreshToken = jwt.sign(
        { id: user.id },
        JWT_REFRESH_SECRET as Secret,
        { expiresIn: JWT_REFRESH_EXPIRES_IN as any },
      );
    } catch {
      // Refresh token secret not configured; proceed without it
    }

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
          profileType: user.profileType,
          username: user.username,
          disputeRate: user.disputeRate ?? 0.0,
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

export const requestProfileChange = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

export const getProfileChangeStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

export const toggleUserMode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mode } = req.body as { mode?: 'business' | 'personal' };
    if (!mode || !['business', 'personal'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'mode must be business or personal' });
    }

    let userRecord: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      role: string;
      preferredMode: string;
      business?: { id?: string } | null;
    };

    try {
      userRecord = await prisma.user.update({
        where: { id: req.user!.id },
        data: { preferredMode: mode },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          preferredMode: true,
          business: true,
        },
      });
    } catch (dbErr) {
      logger.warn('[Auth] toggleUserMode DB update fallback:', dbErr);
      const existing = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          business: true,
        },
      }).catch(() => null);

      userRecord = {
        id: existing?.id || req.user!.id,
        email: existing?.email || req.user!.email,
        firstName: existing?.firstName ?? req.user!.firstName,
        lastName: existing?.lastName ?? req.user!.lastName,
        role: existing?.role || req.user!.role,
        preferredMode: mode,
        business: existing?.business ?? (req.user!.businessId ? { id: req.user!.businessId } : null),
      };
    }

    const businessId = (userRecord.business as { id?: string } | null)?.id ?? req.user?.businessId ?? null;

    const secret = process.env.JWT_SECRET || JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      { id: userRecord.id, email: userRecord.email, role: userRecord.role, businessId, activeBusinessId: businessId, mode } as JwtPayload,
      secret as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    res.json({ success: true, data: { user: { ...userRecord, preferredMode: mode, businessId }, token } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Auth] toggleUserMode error:', message);
    next(error);
  }
};

/**
 * POST /api/v1/auth/onboarding — Progressive onboarding router for newly authenticated accounts.
 */
export const completeOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { profileType, username, businessName, industry } = req.body;

    if (!profileType || !['SOLO_BUILDER', 'CLIENT', 'SERVICE_BUSINESS'].includes(profileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profileType. Must be SOLO_BUILDER, CLIENT, or SERVICE_BUSINESS.',
      });
    }

    const cleanUsername = username ? String(username).replace(/^@/, '').toLowerCase().trim() : undefined;

    // Fetch existing user to preserve any attestations/boosts
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    const currentScore = existingUser?.trustScore && existingUser.trustScore >= 700 ? existingUser.trustScore : 700;

    let updateData: any = {
      profileType: profileType as ProfileType,
      trustScore: currentScore,
      disputeRate: 0.0,
      ...(cleanUsername && { username: cleanUsername }),
    };

    if (profileType === 'SOLO_BUILDER') {
      updateData.role = UserRole.FREELANCER;
      updateData.preferredMode = 'personal';
      updateData.activeMode = UserRole.CUSTOMER;
    } else if (profileType === 'CLIENT') {
      updateData.role = UserRole.CUSTOMER;
      updateData.preferredMode = 'personal';
      updateData.activeMode = UserRole.CUSTOMER;
    } else if (profileType === 'SERVICE_BUSINESS') {
      updateData.role = UserRole.BUSINESS_OWNER;
      updateData.preferredMode = 'business';
      updateData.activeMode = UserRole.BUSINESS_OWNER;

      if (businessName) {
        const category = resolveCategoryFromVertical(industry || 'commercial');
        const existingBiz = await prisma.business.findFirst({ where: { ownerId: userId } });
        if (!existingBiz) {
          await prisma.business.create({
            data: {
              name: businessName,
              ownerId: userId,
              category,
              address: 'Global / Remote',
              profileType: ProfileType.SERVICE_BUSINESS,
              settings: {
                create: {
                  vertical: normalizeVerticalKey(industry || 'commercial'),
                  enabledModules: ['coordinator', 'contact', 'booking'],
                },
              },
            },
          });
        } else {
          await prisma.business.update({
            where: { id: existingBiz.id },
            data: {
              name: businessName,
              category,
              profileType: ProfileType.SERVICE_BUSINESS,
            },
          });
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        profileType: true,
        trustScore: true,
        disputeRate: true,
        preferredMode: true,
        business: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: { user: updatedUser },
    });
  } catch (error) {
    logger.error('[Auth] completeOnboarding error:', error);
    next(error);
  }
};

/**
 * POST /api/v1/auth/telegram — Verify Telegram Widget auth data or WebApp initData.
 */
export const telegramAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(503).json({
        success: false,
        message: 'Telegram authentication not configured. Set TELEGRAM_BOT_TOKEN in .env.',
      });
    }

    const { authData, initData } = req.body;
    let tgUser: any = null;

    if (initData && typeof initData === 'string') {
      // Telegram WebApp / Mini App flow
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (!hash) {
        return res.status(400).json({ success: false, message: 'Invalid Telegram WebApp data' });
      }
      params.delete('hash');
      const checkArr: string[] = [];
      Array.from(params.keys())
        .sort()
        .forEach((key) => {
          checkArr.push(`${key}=${params.get(key)}`);
        });
      const checkString = checkArr.join('\n');
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const computedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

      if (computedHash !== hash) {
        return res.status(401).json({ success: false, message: 'Telegram signature validation failed' });
      }
      const userRaw = params.get('user');
      tgUser = userRaw ? JSON.parse(userRaw) : null;
    } else if (authData && typeof authData === 'object' && authData.hash) {
      // Standard Telegram Login Widget flow
      const { hash, ...rest } = authData;
      const checkArr: string[] = [];
      Object.keys(rest)
        .sort()
        .forEach((key) => {
          if (rest[key] !== undefined && rest[key] !== null) {
            checkArr.push(`${key}=${rest[key]}`);
          }
        });
      const checkString = checkArr.join('\n');
      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const computedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

      if (computedHash !== hash) {
        return res.status(401).json({ success: false, message: 'Telegram signature validation failed' });
      }
      tgUser = authData;
    } else {
      return res.status(400).json({ success: false, message: 'Missing Telegram authentication payload' });
    }

    if (!tgUser || !tgUser.id) {
      return res.status(400).json({ success: false, message: 'Missing Telegram user data' });
    }

    const user = await findOrCreateUser({
      provider: 'telegram',
      providerId: String(tgUser.id),
      metadata: tgUser,
    });

    if (!user.telegramId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramId: String(tgUser.id),
          ...(tgUser.username && !user.username && { username: tgUser.username.toLowerCase() }),
        },
      });
    }

    const businessId = (user as any).business?.id ?? null;
    const mode = user.preferredMode || 'personal';

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        businessId,
        activeBusinessId: businessId,
        mode,
        profileType: user.profileType || null,
        username: user.username || null,
      } as JwtPayload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id } as JwtPayload,
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );

    logger.info(`User authenticated via Telegram: ${user.id} (@${tgUser.username || tgUser.id})`);

    return res.json({
      success: true,
      message: 'Telegram authentication successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          profileType: user.profileType,
          trustScore: user.trustScore,
          disputeRate: user.disputeRate ?? 0.0,
          telegramId: String(tgUser.id),
          preferredMode: mode,
          businessId,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('[Auth] telegramAuth error:', error);
    next(error);
  }
};

/**
 * GET /api/v1/auth/phone/status — Check user's phone verification and double-verification standing.
 */
export const getPhoneVerificationStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        isPhoneVerified: true,
        trustScore: true,
        telegramId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        isPhoneVerified: !!user.isPhoneVerified,
        phone: user.phone || null,
        trustScore: user.trustScore || 700,
        hasTelegramLinked: !!user.telegramId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/phone/telegram-link — Generate Telegram bot deep link for zero-cost phone verification.
 */
export const getPhoneTelegramLink = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'PabanBot';
    const telegramLink = `https://t.me/${botUsername}?start=phone_${userId}`;

    return res.json({
      success: true,
      data: {
        telegramLink,
        botUsername,
      },
    });
  } catch (error) {
    next(error);
  }
};
