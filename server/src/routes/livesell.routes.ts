import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { liveSellerService } from '../services/live-seller.service';
import { LiveSellerPlatform } from '@prisma/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function requireBusiness(req: AuthRequest, res: any) {
  const biz = await prisma.business.findFirst({ where: { ownerId: req.user!.id } });
  if (!biz) {
    res.locals = res.locals || {};
    res.locals.businessMissing = true;
    return null;
  }
  return biz;
}

function stateToken(userId: string, businessId: string, platform: string) {
  return jwt.sign({ userId, businessId, platform }, JWT_SECRET, { expiresIn: '15m' });
}

function decodeState(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; businessId: string; platform: string };
}

router.get('', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return res.status(400).json({ success: false, error: 'Business profile not found' });
    const integrations = await liveSellerService.listForBusiness(biz.id);
    res.json({ success: true, data: integrations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to list integrations' });
  }
});

router.get('/:platform/state', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return res.status(400).json({ success: false, error: 'Business profile not found' });
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const state = await liveSellerService.getShowState(biz.id, platform);
    res.json({ success: true, data: state });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to load show state' });
  }
});

router.patch('/:platform/state', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return res.status(400).json({ success: false, error: 'Business profile not found' });
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const state = await liveSellerService.upsertShowState(biz.id, platform, req.body || {});
    res.json({ success: true, data: state });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to update show state' });
  }
});

router.post('/:platform/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return res.status(400).json({ success: false, error: 'Business profile not found' });
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const order = await liveSellerService.addOrder(biz.id, platform, req.body || {});
    res.status(201).json({ success: true, data: order });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to add order' });
  }
});

router.get('/connect/:platform', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const platform = req.params.platform;
    if (!['tiktok-live', 'youtube-shopping', 'shopify-live'].includes(platform)) {
      return res.status(400).json({ success: false, error: 'Unsupported platform' });
    }
    const biz = await requireBusiness(req, res);
    if (!biz) return res.status(400).json({ success: false, error: 'Business profile not found' });
    const token = stateToken(req.user!.id, biz.id, platform);

    if (platform === 'tiktok-live') {
      return passport.authenticate('tiktok', { state: token })(req, res, next);
    }
    if (platform === 'youtube-shopping') {
      return passport.authenticate('google', { state: token, scope: ['https://www.googleapis.com/auth/youtube.readonly'] })(req, res, next);
    }
    if (platform === 'shopify-live') {
      return res.status(400).json({ success: false, error: 'Shopify connect needs a Shopify OAuth strategy.' });
    }
  } catch (e) {
    next(e);
  }
});

router.get('/callback/tiktok', passport.authenticate('tiktok', { session: false, failureRedirect: `${FRONTEND_URL}/business?livesell_error=callback_failed` }), async (req: any, res) => {
  try {
    const state = decodeState(req.query.state as string);
    const profile = req.user || req.authInfo;
    const platform = (state.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform);
    await liveSellerService.connect(state.businessId, {
      platform,
      accessToken: profile?.accessToken || req.accessToken || '',
      refreshToken: profile?.refreshToken || req.refreshToken || '',
      expiresAt: profile?.expiresAt ? new Date(profile.expiresAt) : undefined,
      scope: profile?.scope || null,
      metadata: { rawProfile: profile },
    });
    res.redirect(`${FRONTEND_URL}/business?livesell_success=${state.platform}`);
  } catch (e) {
    console.error('Live sell callback error', e);
    res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
  }
});

router.get('/callback/google', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/business?livesell_error=callback_failed` }), async (req: any, res) => {
  try {
    const state = decodeState(req.query.state as string);
    const profile = req.user || req.authInfo;
    await liveSellerService.connect(state.businessId, {
      platform: 'YOUTUBE_SHOPPING',
      accessToken: profile?.accessToken || req.accessToken || '',
      refreshToken: profile?.refreshToken || req.refreshToken || '',
      expiresAt: profile?.expiresAt ? new Date(profile.expiresAt) : undefined,
      scope: profile?.scope || null,
      metadata: { rawProfile: profile },
    });
    res.redirect(`${FRONTEND_URL}/business?livesell_success=youtube-shopping`);
  } catch (e) {
    console.error('YouTube callback error', e);
    res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
  }
});

router.get('/callback/shopify', passport.authenticate('shopify', { session: false, failureRedirect: `${FRONTEND_URL}/business?livesell_error=callback_failed` }), async (req: any, res) => {
  try {
    const state = decodeState(req.query.state as string);
    const profile = req.user || req.authInfo;
    await liveSellerService.connect(state.businessId, {
      platform: 'SHOPIFY_LIVE',
      accessToken: profile?.accessToken || req.accessToken || '',
      refreshToken: profile?.refreshToken || req.refreshToken || '',
      expiresAt: profile?.expiresAt ? new Date(profile.expiresAt) : undefined,
      shopId: profile?.shop || profile?.shopDomain || null,
      metadata: { rawProfile: profile },
    });
    res.redirect(`${FRONTEND_URL}/business?livesell_success=shopify-live`);
  } catch (e) {
    console.error('Shopify callback error', e);
    res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
  }
});

router.delete('/:platform', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return res.status(400).json({ success: false, error: 'Business profile not found' });
    await liveSellerService.disconnect(biz.id, req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform);
    res.json({ success: true, message: 'Integration disconnected' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to disconnect integration' });
  }
});

export default router;
