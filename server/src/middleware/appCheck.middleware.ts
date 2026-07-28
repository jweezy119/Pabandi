import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

export const requireAppCheck = async (req: Request, res: Response, next: NextFunction) => {
  // Allow OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return next();
  }

  if (process.env.SKIP_APP_CHECK === 'true') {
    return next();
  }

  // TEMPORARY FIX: App Check token logic was disabled on the frontend 
  // to prevent hangs, so we must also bypass it on the backend globally
  // otherwise all API calls (search, maps, etc.) will fail with 401.
  return next();

  // Bypass App Check for OAuth redirect and callback routes because browser
  // redirects (window.location.href) cannot attach custom headers.
  const oauthPaths = ['/auth/google', '/auth/facebook', '/auth/twitter', '/auth/linkedin', '/auth/tiktok'];
  if (oauthPaths.some(path => req.originalUrl.includes(path))) {
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
