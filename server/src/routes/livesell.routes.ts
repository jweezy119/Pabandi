import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { liveSellerService } from '../services/live-seller.service';
import { LiveSellerPlatform } from '@prisma/client';
import { fail, ok } from '../utils/apiResponse';

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
    if (!biz) return fail(res, 'Business profile not found', 400);
    const integrations = await liveSellerService.listForBusiness(biz.id);
    return ok(res, integrations);
  } catch (e) {
    console.error('Failed to list integrations', e);
    return fail(res, 'Failed to list integrations', 500);
  }
});

router.get('/:platform/state', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return fail(res, 'Business profile not found', 400);
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const state = await liveSellerService.getShowState(biz.id, platform);
    return ok(res, state);
  } catch (e) {
    console.error('Failed to load show state', e);
    return fail(res, 'Failed to load show state', 500);
  }
});

router.patch('/:platform/state', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return fail(res, 'Business profile not found', 400);
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const state = await liveSellerService.upsertShowState(biz.id, platform, req.body || {});
    return ok(res, state);
  } catch (e) {
    console.error('Failed to update show state', e);
    return fail(res, 'Failed to update show state', 500);
  }
});

router.get('/:platform/catalog', async (req: any, res) => {
  try {
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    return ok(res, { platform, items: [] });
  } catch (e) {
    console.error('Failed to load catalog', e);
    return fail(res, 'Failed to load catalog', 500);
  }
});

router.post('/:platform/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return fail(res, 'Business profile not found', 400);
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const order = await liveSellerService.addOrder(biz.id, platform, req.body || {});
    return ok(res, order, 201);
  } catch (e) {
    console.error('Failed to add order', e);
    return fail(res, 'Failed to add order', 500);
  }
});

router.get('/:platform/schedule', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return fail(res, 'Business profile not found', 400);
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const schedule = await liveSellerService.getSchedule(biz.id, platform);
    return ok(res, schedule);
  } catch (e) {
    console.error('Failed to load schedule', e);
    return fail(res, 'Failed to load schedule', 500);
  }
});

router.post('/:platform/schedule', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return fail(res, 'Business profile not found', 400);
    const platform = req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform;
    const schedule = await liveSellerService.setSchedule(biz.id, platform, req.body?.schedule || []);
    return ok(res, schedule);
  } catch (e) {
    console.error('Failed to save schedule', e);
    return fail(res, 'Failed to save schedule', 500);
  }
});

router.get('/connect/:platform', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const platform = req.params.platform;
    if (!['tiktok-live', 'youtube-shopping', 'shopify-live', 'ebay-live', 'amazon-live', 'instagram-live', 'custom-web'].includes(platform)) {
      return fail(res, 'Unsupported platform', 400);
    }
    const biz = await requireBusiness(req, res);
    if (!biz) return fail(res, 'Business profile not found', 400);
    const token = stateToken(req.user!.id, biz.id, platform);

    if (platform === 'tiktok-live') {
      return passport.authenticate('tiktok', { state: token })(req, res, next);
    }
    if (platform === 'youtube-shopping') {
      return passport.authenticate('google', { state: token, scope: ['https://www.googleapis.com/auth/youtube.readonly'] })(req, res, next);
    }
    if (platform === 'shopify-live') {
      return fail(res, 'Shopify connect needs a Shopify OAuth strategy.', 400);
    }
    if (['ebay-live', 'amazon-live', 'instagram-live', 'custom-web'].includes(platform)) {
      return fail(res, 'Live-sell connect is not implemented for this platform yet', 400);
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
    return res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
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
    return res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
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
      scope: profile?.scope || null,
      shopId: profile?.shop || profile?.shopDomain || null,
      metadata: { rawProfile: profile },
    });
    res.redirect(`${FRONTEND_URL}/business?livesell_success=shopify-live`);
  } catch (e) {
    console.error('Shopify callback error', e);
    return res.redirect(`${FRONTEND_URL}/business?livesell_error=callback_failed`);
  }
});

router.delete('/:platform', authenticate, async (req: AuthRequest, res) => {
  try {
    const biz = await requireBusiness(req, res);
    if (!biz) return fail(res, 'Business profile not found', 400);
    await liveSellerService.disconnect(biz.id, req.params.platform.toUpperCase().replace('-', '_') as LiveSellerPlatform);
    return ok(res, { message: 'Integration disconnected' });
  } catch (e) {
    console.error('Failed to disconnect integration', e);
    return fail(res, 'Failed to disconnect integration', 500);
  }
});

export default router;
