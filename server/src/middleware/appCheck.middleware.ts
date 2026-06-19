import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

export const requireAppCheck = async (req: Request, res: Response, next: NextFunction) => {
  // Allow OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return next();
  }

  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    logger.warn(`Unauthorized request: Missing App Check token from ${req.ip}`);
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: App Check token is missing.',
      code: 'app-check/missing-token'
    });
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    
    // Optionally you can attach the claims to the request if you need to use them
    // req.appCheckClaims = appCheckClaims;

    return next();
  } catch (error) {
    logger.error('Failed to verify App Check token:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid App Check token.',
      code: 'app-check/invalid-token'
    });
  }
};
