"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oauth_service_1 = require("../services/oauth.service");
const logger_1 = require("../utils/logger");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/oauth/authorize
 * Validates the client and redirect_uri.
 * Expected to be called by the frontend to fetch client info before showing consent.
 */
router.get('/authorize', async (req, res) => {
    try {
        const { client_id, redirect_uri, response_type } = req.query;
        if (!client_id || !redirect_uri) {
            return res.status(400).json({ error: 'Missing client_id or redirect_uri' });
        }
        if (response_type !== 'code') {
            return res.status(400).json({ error: 'Unsupported response_type. Only "code" is supported.' });
        }
        const client = await oauth_service_1.oauthService.validateClientAndRedirect(client_id, redirect_uri);
        return res.json({
            client: {
                name: client.name,
                logoUrl: client.logoUrl,
                clientId: client.clientId
            }
        });
    }
    catch (error) {
        logger_1.logger.error(`[OAuth] Authorize Validation Error: ${error.message}`);
        return res.status(400).json({ error: error.message });
    }
});
/**
 * POST /api/v1/oauth/authorize
 * User submits their consent. Generates the auth code.
 */
router.post('/authorize', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { client_id, redirect_uri, action } = req.body;
        const userId = req.user.id; // From requireAuth
        if (action !== 'approve') {
            // User denied
            return res.json({
                redirect_uri: `${redirect_uri}?error=access_denied&error_description=User denied access`
            });
        }
        const client = await oauth_service_1.oauthService.validateClientAndRedirect(client_id, redirect_uri);
        const code = await oauth_service_1.oauthService.generateAuthorizationCode(client.clientId, userId, redirect_uri);
        return res.json({
            redirect_uri: `${redirect_uri}?code=${code}`
        });
    }
    catch (error) {
        logger_1.logger.error(`[OAuth] Authorize Submission Error: ${error.message}`);
        return res.status(400).json({ error: error.message });
    }
});
/**
 * POST /api/v1/oauth/token
 * Exchanged authorization code for tokens.
 */
router.post('/token', async (req, res) => {
    try {
        const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;
        if (grant_type !== 'authorization_code') {
            return res.status(400).json({ error: 'unsupported_grant_type' });
        }
        if (!code || !redirect_uri || !client_id || !client_secret) {
            return res.status(400).json({ error: 'invalid_request' });
        }
        const tokens = await oauth_service_1.oauthService.exchangeCodeForToken(client_id, client_secret, code, redirect_uri);
        return res.json(tokens);
    }
    catch (error) {
        logger_1.logger.error(`[OAuth] Token Error: ${error.message}`);
        return res.status(400).json({ error: error.message });
    }
});
/**
 * GET /api/v1/oauth/userinfo
 * Returns Trust Passport data for the user. Requires Bearer token.
 */
router.get('/userinfo', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Bearer token' });
        }
        const accessToken = authHeader.split(' ')[1];
        const userInfo = await oauth_service_1.oauthService.getUserInfo(accessToken);
        return res.json(userInfo);
    }
    catch (error) {
        logger_1.logger.error(`[OAuth] UserInfo Error: ${error.message}`);
        return res.status(401).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=oauth.routes.js.map