import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

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
