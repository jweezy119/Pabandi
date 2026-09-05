import { Router, Request, Response } from 'express';
import { socialIntegrationService } from '../services/socialIntegration.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL MEDIA INTEGRATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Connect social account (OAuth URL)
router.get('/connect/:platform', authenticate, async (req: any, res: Response) => {
  try {
    const { platform } = req.params;
    const redirectUri = `${process.env.API_URL}/api/v1/social/callback/${platform}`;
    const url = await socialIntegrationService.getOAuthUrl(platform, redirectUri);
    res.json({ success: true, data: { url, platform } });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get OAuth URL' });
  }
});

// OAuth callback
router.get('/callback/:platform', authenticate, async (req: any, res: Response) => {
  try {
    const { platform } = req.params;
    const { code } = req.query;
    const redirectUri = `${process.env.API_URL}/api/v1/social/callback/${platform}`;
    const result = await socialIntegrationService.handleOAuthCallback(platform, code as string, redirectUri);
    // Redirect to frontend with success
    res.redirect(`${process.env.CLIENT_URL}/social/connected?platform=${platform}&success=true`);
  } catch (e: any) {
    res.redirect(`${process.env.CLIENT_URL}/social/error`);
  }
});

// Connect account (manual token entry for testing)
router.post('/connect-account', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { platform, accessToken, username } = req.body;
    const account = await socialIntegrationService.connectSocialAccount(userId, platform, {
      accessToken,
      username,
    });
    res.status(201).json({ success: true, data: account });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to connect account' });
  }
});

// Get connected accounts
router.get('/accounts', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const accounts = await socialIntegrationService.getSocialAccounts(userId);
    res.json({ success: true, data: accounts });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load social accounts' });
  }
});

// Disconnect account
router.delete('/accounts/:platform', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await socialIntegrationService.disconnectSocialAccount(userId, req.params.platform);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SHARING
// ═══════════════════════════════════════════════════════════════════════════

// Share to social platform
router.post('/share', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { platform, content } = req.body;
    const result = await socialIntegrationService.shareToSocial(userId, platform, content);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to share' });
  }
});

// Generate deep links for a resource
router.post('/deeplink', authenticate, async (req: any, res: Response) => {
  try {
    const { type, id } = req.body;
    const links = await socialIntegrationService.generateDeepLink(type, id);
    res.json({ success: true, data: links });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to generate deep link' });
  }
});

// Generate entry QR code for venue/event
router.post('/entry-qr', authenticate, async (req: any, res: Response) => {
  try {
    const { venueId, eventId } = req.body;
    const qr = await socialIntegrationService.generateSocialEntryQR(venueId, eventId);
    res.json({ success: true, data: qr });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

// Get social stats for user
router.get('/stats', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const stats = await socialIntegrationService.getSocialStats(userId);
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
