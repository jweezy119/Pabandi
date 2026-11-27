import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * Record user consent (GDPR Art. 7)
 * POST /api/v1/consent
 */
export const recordConsent = async (
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
    const { type, version, granted, metadata } = req.body;

    if (!type || !version) {
      return res.status(400).json({
        success: false,
        message: 'type and version are required',
      });
    }

    const validTypes = ['marketing', 'analytics', 'functional', 'necessary', 'third_party_sharing'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid consent type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Upsert consent record
    const consent = await prisma.consent.upsert({
      where: {
        userId_type_version: {
          userId,
          type,
          version,
        },
      },
      create: {
        userId,
        type,
        version,
        granted: granted ?? true,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata,
      },
      update: {
        granted: granted ?? true,
        grantedAt: new Date(),
        withdrawnAt: granted === false ? new Date() : null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata,
      },
    });

    logger.info(`Consent recorded: user=${userId} type=${type} version=${version} granted=${granted ?? true}`);

    return res.status(201).json({
      success: true,
      data: consent,
    });
  } catch (error) {
    logger.error('Error recording consent:', error);
    next(error);
  }
};

/**
 * Get all consents for current user
 * GET /api/v1/consent
 */
export const getUserConsents = async (
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
    const consents = await prisma.consent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: consents,
    });
  } catch (error) {
    logger.error('Error fetching consents:', error);
    next(error);
  }
};

/**
 * Withdraw consent (GDPR Art. 7 - Right to withdraw)
 * POST /api/v1/consent/withdraw
 */
export const withdrawConsent = async (
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
    const { type, version } = req.body;

    if (!type || !version) {
      return res.status(400).json({
        success: false,
        message: 'type and version are required',
      });
    }

    // Find the consent record
    const consent = await prisma.consent.findUnique({
      where: {
        userId_type_version: {
          userId,
          type,
          version,
        },
      },
    });

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consent record not found',
      });
    }

    if (!consent.granted) {
      return res.status(400).json({
        success: false,
        message: 'Consent already withdrawn',
      });
    }

    // Update to withdrawn
    const updated = await prisma.consent.update({
      where: { id: consent.id },
      data: {
        granted: false,
        withdrawnAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    logger.info(`Consent withdrawn: user=${userId} type=${type} version=${version}`);

    return res.status(200).json({
      success: true,
      message: 'Consent successfully withdrawn',
      data: updated,
    });
  } catch (error) {
    logger.error('Error withdrawing consent:', error);
    next(error);
  }
};

/**
 * Withdraw all consents of a specific type
 * POST /api/v1/consent/withdraw-all
 */
export const withdrawAllConsents = async (
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
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'type is required',
      });
    }

    const result = await prisma.consent.updateMany({
      where: {
        userId,
        type,
        granted: true,
      },
      data: {
        granted: false,
        withdrawnAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    logger.info(`All consents withdrawn: user=${userId} type=${type} count=${result.count}`);

    return res.status(200).json({
      success: true,
      message: `Withdrew ${result.count} consent(s) for type: ${type}`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Error withdrawing all consents:', error);
    next(error);
  }
};

/**
 * Get consent status for a specific type (latest version)
 * GET /api/v1/consent/status/:type
 */
export const getConsentStatus = async (
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
    const { type } = req.params;

    const consent = await prisma.consent.findFirst({
      where: { userId, type },
      orderBy: { version: 'desc' },
    });

    if (!consent) {
      return res.status(200).json({
        success: true,
        data: {
          type,
          granted: false,
          version: null,
          message: 'No consent recorded for this type',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        type: consent.type,
        version: consent.version,
        granted: consent.granted,
        grantedAt: consent.grantedAt,
        withdrawnAt: consent.withdrawnAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching consent status:', error);
    next(error);
  }
};