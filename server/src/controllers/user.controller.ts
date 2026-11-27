import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

/**
 * Get public profile for a user
 * Hides sensitive information like exact email, phone, and password hash.
 */
export const getPublicUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true, // We'll return just the initial on the frontend if needed, or format it here
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        reliabilityScore: true,
        trustScore: true,
        commerceScore: true,
        hospitalityScore: true,
        appointmentScore: true,
        freelanceScore: true,
        verificationTier: true,
        createdAt: true,
        // We do NOT return email, phone, passwordHash, fcmToken, etc.
        business: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            category: true,
            rating: true,
            reviewCount: true,
            city: true,
            coverImageUrl: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Format last name to just the initial for privacy
    const publicUser = {
      ...user,
      lastName: user.lastName ? `${user.lastName.charAt(0)}.` : '',
    };

    // Check for social connections (using the existence of the ID fields)
    const rawUser = await prisma.user.findUnique({
      where: { id },
      select: { googleId: true, facebookId: true }
    });

    const connectedSocials = [];
    if (rawUser?.googleId) connectedSocials.push('google');
    if (rawUser?.facebookId) connectedSocials.push('facebook');
    // For linkedin and x, if they exist on the model (assuming they might be added or we can query user properties if we add them)
    // For now we just return the ones we know exist on the schema
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          ...publicUser,
          connectedSocials
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching public user profile:', error);
    next(error);
  }
};

/**
 * Search users by name
 * Hides sensitive information.
 */
export const searchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { search } = req.query;
    
    if (!search || typeof search !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search term is required',
      });
    }

    const searchTerms = String(search)
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 0);

    const where: any = {};
    
    if (searchTerms.length > 0) {
      where.AND = searchTerms.map(term => ({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ]
      }));
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        reliabilityScore: true,
        trustScore: true,
        verificationTier: true,
        createdAt: true,
      },
      take: 20,
    });

    const formattedUsers = users.map(u => ({
      ...u,
      lastName: u.lastName ? `${u.lastName.charAt(0)}.` : '',
    }));

    return res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
      },
    });
  } catch (error) {
    logger.error('Error searching users:', error);
    next(error);
  }
};

/**
 * Delete user account with cascading anonymization (GDPR Art. 17 - Right to Erasure)
 * 
 * This performs a soft-delete / anonymization cascade:
 * - User record: anonymize PII (email, name, phone, social IDs), mark as deleted
 * - Related records: cascade delete or anonymize based on data type
 * - Financial records: retain for legal/tax compliance but anonymize PII
 * - Audit logs: retain but remove direct user identifiers
 */
export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  try {
    // Verify user exists - fetch with status for pending checks
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        business: true,
        payments: { select: { id: true, status: true } },
        payouts: { select: { id: true, status: true } },
        payoutRequests: { select: { id: true, status: true } },
        escrowsAsPayer: { select: { id: true, status: true } },
        escrowsAsPayee: { select: { id: true, status: true } },
        gigs: { select: { id: true } },
        trustPassport: true,
        disputesFiled: { select: { id: true } },
        disputesAgainst: { select: { id: true } },
        fiatPaymentsMade: { select: { id: true } },
        fiatPaymentsReceived: { select: { id: true } },
        cryptoPaymentsMade: { select: { id: true } },
        cryptoPaymentsReceived: { select: { id: true } },
        trustAuditTrails: { select: { id: true } },
        notifications: { select: { id: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check for active business ownership - must transfer or delete business first
    if (user.business) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account while owning an active business. Transfer ownership or delete the business first.',
        businessId: user.business.id,
      });
    }

    // Check for pending financial operations
    const pendingPayments = user.payments.filter(p => p.status === 'PENDING');
    const pendingPayouts = user.payouts.filter(p => p.status === 'PENDING');
    const pendingEscrows = [
      ...user.escrowsAsPayer.filter(e => e.status === 'PENDING'),
      ...user.escrowsAsPayee.filter(e => e.status === 'PENDING'),
    ];
    const pendingPayoutRequests = user.payoutRequests.filter(p => p.status === 'PENDING');

    if (pendingPayments.length > 0 || pendingPayouts.length > 0 || pendingEscrows.length > 0 || pendingPayoutRequests.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account with pending financial operations. Complete or cancel all pending payments, payouts, and escrows first.',
        pending: {
          payments: pendingPayments.length,
          payouts: pendingPayouts.length,
          escrows: pendingEscrows.length,
          payoutRequests: pendingPayoutRequests.length,
        },
      });
    }

    // Perform cascading anonymization in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Anonymize User record (retain for FK integrity but remove PII)
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@pabandi.deleted`,
          phone: null,
          passwordHash: 'DELETED',
          firstName: 'Deleted',
          lastName: 'User',
          companyName: null,
          profilePictureUrl: null,
          avatarUrl: null,
          bannerUrl: null,
          bio: null,
          tagline: null,
          location: null,
          websiteUrl: null,
          username: null,
          googleId: null,
          facebookId: null,
          githubId: null,
          telegramId: null,
          linkedinId: null,
          tiktokId: null,
          twitterId: null,
          walletAddress: null,
          stripeCustomerId: null,
          resetToken: null,
          resetTokenExpires: null,
          verificationCode: null,
          verificationCodeExpires: null,
          nonce: null,
          fcmToken: null,
          role: 'CUSTOMER', // Downgrade role
          isEmailVerified: false,
          isPhoneVerified: false,
          payoutMethod: null,
          payoutAccountRef: null,
          isPayoutVerified: false,
          payoutVerifiedAt: null,
          // Retain: createdAt, updatedAt, reliabilityScore, trustScore, scores, verificationTier
          // for audit trail integrity
        },
      });

      // 2. Delete or anonymize related records
      
      // Notifications - delete (transient)
      await tx.notification.deleteMany({
        where: { userId },
      });

      // TrustAuditTrails - retain for audit but anonymize userId reference
      // We keep them for score history but they're now linked to anonymized user

      // TrustPassport - if exists, anonymize
      if (user.trustPassport) {
        await tx.trustPassport.update({
          where: { id: user.trustPassport.id },
          data: {
            handle: `deleted_${userId}`,
            displayName: 'Deleted User',
            bio: null,
            walletAddress: null,
            socialLinks: Prisma.DbNull,
            portfolioItems: Prisma.DbNull,
            skills: Prisma.DbNull,
            location: null,
            websiteUrl: null,
            avatarUrl: null,
            coverImageUrl: null,
            userId: null, // Break link to user
            verifiedIdentity: false,
            verifiedAt: null,
          },
        });
      }

      // Disputes filed/against - retain for legal but remove userId reference
      await tx.dispute.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.dispute.updateMany({
        where: { reportedById: userId },
        data: { reportedById: null },
      });

      // Payments - retain for tax/legal but anonymize
      await tx.payment.updateMany({
        where: { userId },
        data: { 
          userId: userId, // Keep FK but user is now anonymized
          // gatewayResponse may contain PII - clear it
          gatewayResponse: Prisma.DbNull,
        },
      });

      // FiatPayments - retain for tax/legal
      await tx.fiatPayment.updateMany({
        where: { payerId: userId },
        data: { payerId: null },
      });
      // payeeId is required on FiatPayment, keep pointing to anonymized user
      await tx.fiatPayment.updateMany({
        where: { payeeId: userId },
        data: { payeeId: userId },
      });

      // CryptoPayments - retain for tax/legal
      await tx.cryptoPayment.updateMany({
        where: { payerId: userId },
        data: { payerId: null },
      });
      await tx.cryptoPayment.updateMany({
        where: { payeeId: userId },
        data: { payeeId: null },
      });

      // Payouts - retain for tax/legal
      await tx.payout.updateMany({
        where: { userId },
        data: { userId: userId }, // Keep FK to anonymized user
      });

      // PayoutRequests - delete if pending, retain if completed
      await tx.payoutRequest.updateMany({
        where: { userId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      // Escrows - retain for legal but remove user links where possible
      await tx.escrow.updateMany({
        where: { payerId: userId },
        data: { payerId: userId }, // Keep FK to anonymized user
      });
      await tx.escrow.updateMany({
        where: { payeeId: userId },
        data: { payeeId: userId }, // Keep FK to anonymized user
      });

      // Gigs - if user is client or freelancer, unassign
      await tx.gig.updateMany({
        where: { clientId: userId },
        data: { clientId: null },
      });
      await tx.gig.updateMany({
        where: { freelancerId: userId },
        data: { freelancerId: null, status: 'OPEN' },
      });

      // Bookings where user is client (via CrmClient)
      // Find CrmClients linked to this user via passport
      if (user.trustPassport) {
        await tx.crmClient.updateMany({
          where: { passportId: user.trustPassport.id },
          data: { passportId: null, marketingOptIn: false },
        });
      }

      // AgentApiKeys - revoke all
      await tx.agentApiKey.updateMany({
        where: { ownerUserId: userId },
        data: { revokedAt: new Date() },
      });

      // AgentActionAudits - retain for audit but userId now points to anonymized user

      // Ledger entries - retain for financial audit

      // Notifications already deleted above
    });

    logger.info(`Account deleted (anonymized) for user: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Account successfully deleted. Your personal data has been anonymized. Financial records retained for legal compliance.',
    });
  } catch (error) {
    logger.error('Error deleting account:', error);
    next(error);
  }
};

/**
 * Export all user data (GDPR Art. 20 - Right to Data Portability)
 * Returns a comprehensive JSON of all user data in a structured format
 */
export const exportUserData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        business: true,
        payments: true,
        payouts: true,
        payoutRequests: true,
        escrowsAsPayer: true,
        escrowsAsPayee: true,
        gigs: true,
        trustPassport: true,
        disputesFiled: true,
        disputesAgainst: true,
        fiatPaymentsMade: true,
        fiatPaymentsReceived: true,
        cryptoPaymentsMade: true,
        cryptoPaymentsReceived: true,
        trustAuditTrails: true,
        notifications: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Remove sensitive fields from export
    const { passwordHash, resetToken, resetTokenExpires, verificationCode, verificationCodeExpires, nonce, fcmToken, ...userData } = user;

    // Structure the export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: userData,
      // Include related data
      business: user.business,
      payments: user.payments,
      payouts: user.payouts,
      payoutRequests: user.payoutRequests,
      escrowsAsPayer: user.escrowsAsPayer,
      escrowsAsPayee: user.escrowsAsPayee,
      gigs: user.gigs,
      trustPassport: user.trustPassport,
      disputesFiled: user.disputesFiled,
      disputesAgainst: user.disputesAgainst,
      fiatPaymentsMade: user.fiatPaymentsMade,
      fiatPaymentsReceived: user.fiatPaymentsReceived,
      cryptoPaymentsMade: user.cryptoPaymentsMade,
      cryptoPaymentsReceived: user.cryptoPaymentsReceived,
      trustAuditTrails: user.trustAuditTrails,
      notifications: user.notifications,
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pabandi-user-data-${userId}-${new Date().toISOString().split('T')[0]}.json"`);

    return res.status(200).json(exportData);
  } catch (error) {
    logger.error('Error exporting user data:', error);
    next(error);
  }
};
