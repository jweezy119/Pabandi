import { Router, Request, Response } from 'express';
import { oauthService } from '../services/oauth.service';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/v1/oauth/authorize
 * Validates the client and redirect_uri.
 * Expected to be called by the frontend to fetch client info before showing consent.
 */
router.get('/authorize', async (req: Request, res: Response) => {
  try {
    const { client_id, redirect_uri, response_type } = req.query;

    if (!client_id || !redirect_uri) {
      return res.status(400).json({ error: 'Missing client_id or redirect_uri' });
    }

    if (response_type !== 'code') {
      return res.status(400).json({ error: 'Unsupported response_type. Only "code" is supported.' });
    }

    const client = await oauthService.validateClientAndRedirect(client_id as string, redirect_uri as string);

    return res.json({
      client: {
        name: client.name,
        logoUrl: client.logoUrl,
        clientId: client.clientId
      }
    });
  } catch (error: any) {
    logger.error(`[OAuth] Authorize Validation Error: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/oauth/authorize
 * User submits their consent. Generates the auth code.
 */
router.post('/authorize', authenticate, async (req: any, res: Response) => {
  try {
    const { client_id, redirect_uri, action } = req.body;
    const userId = req.user.id; // From requireAuth

    if (action !== 'approve') {
      // User denied
      return res.json({
        redirect_uri: `${redirect_uri}?error=access_denied&error_description=User denied access`
      });
    }

    const client = await oauthService.validateClientAndRedirect(client_id, redirect_uri);
    const code = await oauthService.generateAuthorizationCode(client.clientId, userId, redirect_uri);

    return res.json({
      redirect_uri: `${redirect_uri}?code=${code}`
    });
  } catch (error: any) {
    logger.error(`[OAuth] Authorize Submission Error: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/oauth/token
 * Exchanged authorization code for tokens.
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    if (!code || !redirect_uri || !client_id || !client_secret) {
      return res.status(400).json({ error: 'invalid_request' });
    }

    const tokens = await oauthService.exchangeCodeForToken(client_id, client_secret, code, redirect_uri);
    
    return res.json(tokens);
  } catch (error: any) {
    logger.error(`[OAuth] Token Error: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/oauth/userinfo
 * Returns Trust Passport data for the user. Requires Bearer token.
 */
router.get('/userinfo', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Bearer token' });
    }

    const accessToken = authHeader.split(' ')[1];
    const userInfo = await oauthService.getUserInfo(accessToken);

    return res.json(userInfo);
  } catch (error: any) {
    logger.error(`[OAuth] UserInfo Error: ${error.message}`);
    return res.status(401).json({ error: error.message });
  }
});

export default router;
