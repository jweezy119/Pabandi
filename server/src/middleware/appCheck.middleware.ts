import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

export const requireAppCheck = async (req: Request, res: Response, next: NextFunction) => {
  // Do NOT bypass App Check globally. Individual routes that cannot
  // attach custom headers (browser redirects etc.) must be exempted
  // explicitly below.

  // Bypass App Check for OAuth redirect and callback routes because browser
  // redirects (window.location.href) cannot attach custom headers.
  const oauthPaths = ['/auth/google', '/auth/facebook', '/auth/twitter', '/auth/linkedin', '/auth/tiktok'];
  if (oauthPaths.some(path => req.originalUrl.includes(path))) {
    return next();
  }

  // Allow local development without App Check when explicitly opted in.
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_APP_CHECK === 'true') {
    return next();
  }

  // Public read-only GET routes — these are safe to access without App Check
  // because they only return public business data (venue listings, freight load
  // board stats, maps geocoding). The frontend does not send App Check tokens,
  // so these routes would otherwise always fail.
  const publicGetPaths = ['/venues/search', '/freight/stats', '/freight/loads', '/maps/geocode', '/businesses'];
  if (req.method === 'GET' && publicGetPaths.some(path => req.originalUrl.includes(path))) {
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
    if (!admin.appCheck) {
      return res.status(500).json({ success: false, error: 'App Check is not configured.', code: 'app-check/not-configured' });
    }
    const appCheckClaims = await (admin.appCheck() as any).verifyToken(appCheckToken);
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
