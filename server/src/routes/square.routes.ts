import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

// Square OAuth → location import (geo) + future payment rails.
// Setup: Square Developer Dashboard → create app → set redirect URL to
//   {API_URL}/api/v1/square/callback
//   then set SQUARE_APP_ID + SQUARE_APP_SECRET (+ optional SQUARE_ENV=sandbox).
// Without those env vars every endpoint reports unconfigured instead of failing.

const router = Router();

const SQUARE_APP_ID = process.env.SQUARE_APP_ID || '';
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET || '';
const SQUARE_ENV = (process.env.SQUARE_ENV || 'sandbox').toLowerCase();
const API_URL = process.env.API_URL || 'https://pabandi.onrender.com';
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://pabandi.com';
const REDIRECT_URI = `${API_URL}/api/v1/square/callback`;

const squareBase = () =>
  SQUARE_ENV === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';

const isConfigured = () => !!(SQUARE_APP_ID && SQUARE_APP_SECRET);

function protectToken(token: string): string {
  try {
    // Reuse the app's field encryption when available.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { encrypt } = require('../utils/encryption');
    if (process.env.ENCRYPTION_KEY && typeof encrypt === 'function') return encrypt(token);
  } catch {
    /* fall through to raw storage with a warning */
  }
  logger.warn('[square] ENCRYPTION_KEY not set — storing OAuth token unencrypted');
  return token;
}

function unprotectToken(stored: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { decrypt } = require('../utils/encryption');
    if (process.env.ENCRYPTION_KEY && typeof decrypt === 'function') {
      try {
        return decrypt(stored);
      } catch {
        return stored; // stored raw — use as-is
      }
    }
  } catch {
    /* fall through */
  }
  return stored;
}

async function ensureOwner(businessId: string, userId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerId: userId },
  });
  return business;
}

async function exchangeCode(code: string) {
  const res = await fetch(`${squareBase()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: SQUARE_APP_ID,
      client_secret: SQUARE_APP_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data: any = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.message || data?.error_description || 'Square token exchange failed');
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    merchant_id: string;
  };
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${squareBase()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: SQUARE_APP_ID,
      client_secret: SQUARE_APP_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data: any = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.message || 'Square token refresh failed');
  }
  return data;
}

async function fetchLocations(accessToken: string) {
  const res = await fetch(`${squareBase()}/v2/locations`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.detail || 'Square locations fetch failed');
  }
  return (data?.locations || []) as any[];
}

async function importLocations(businessId: string, locations: any[]) {
  const primary = locations.find((l: any) => l.status === 'ACTIVE') || locations[0];
  if (!primary) return null;
  const coords = primary.coordinates || {};
  await prisma.business.update({
    where: { id: businessId },
    data: {
      ...(coords.latitude != null ? { latitude: Number(coords.latitude) } : {}),
      ...(coords.longitude != null ? { longitude: Number(coords.longitude) } : {}),
      ...(primary.address ? {
        address: [
          primary.address.address_line_1,
          primary.address.locality,
          primary.address.administrative_district_level_1,
        ].filter(Boolean).join(', '),
        city: primary.address.locality || undefined,
        postalCode: primary.address.postal_code || undefined,
      } : {}),
    },
  });
  return { id: primary.id, name: primary.name };
}

// GET /api/v1/square/status?businessId=xxx
router.get('/status', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const conn = await prisma.squareConnection.findUnique({
      where: { businessId: String(businessId) },
      select: { merchantId: true, lastSyncedAt: true, squareLocationId: true, createdAt: true },
    });
    const business = conn
      ? await prisma.business.findUnique({
          where: { id: String(businessId), ownerId: req.user!.id },
          select: { id: true },
        })
      : null;
    res.json({
      success: true,
      data: {
        configured: isConfigured(),
        connected: !!conn && !!business,
        lastSyncedAt: conn?.lastSyncedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/square/connect?businessId=xxx → redirect to Square OAuth
router.get('/connect', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Square is not configured. Set SQUARE_APP_ID and SQUARE_APP_SECRET.',
      });
    }
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const business = await ensureOwner(String(businessId), req.user!.id);
    if (!business) return res.status(403).json({ error: 'Not your business' });

    const state = jwt.sign({ businessId, userId: req.user!.id }, process.env.JWT_SECRET || 'fallback', { expiresIn: '10m' });
    const url =
      `${squareBase()}/oauth2/authorize?` +
      new URLSearchParams({
        client_id: SQUARE_APP_ID,
        scope: 'MERCHANT_PROFILE_READ PAYMENTS_READ PAYMENTS_WRITE',
        redirect_uri: REDIRECT_URI,
        state,
      }).toString();
    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/square/callback?code=...&state=... (Square redirects here)
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/sitara/operator?square=error&message=${encodeURIComponent('Missing code')}`);
    }
    let businessId: string;
    let userId: string;
    try {
      const decoded: any = jwt.verify(state, process.env.JWT_SECRET || 'fallback');
      businessId = decoded.businessId;
      userId = decoded.userId;
    } catch (e) {
      return res.redirect(`${CLIENT_URL}/sitara/operator?square=error&message=${encodeURIComponent('Invalid state')}`);
    }
    const business = await ensureOwner(String(businessId), String(userId));
    if (!business) {
      return res.redirect(`${CLIENT_URL}/sitara/operator?square=error&message=${encodeURIComponent('Business not found')}`);
    }

    const tokens = await exchangeCode(code);
    const locations = await fetchLocations(tokens.access_token);
    const imported = await importLocations(business.id, locations);

    await prisma.squareConnection.upsert({
      where: { businessId: business.id },
      update: {
        merchantId: tokens.merchant_id,
        accessToken: protectToken(tokens.access_token),
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: tokens.expires_at ? new Date(tokens.expires_at) : undefined,
        squareLocationId: imported?.id,
        lastSyncedAt: new Date(),
      },
      create: {
        businessId: business.id,
        merchantId: tokens.merchant_id,
        accessToken: protectToken(tokens.access_token),
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expires_at ? new Date(tokens.expires_at) : undefined,
        squareLocationId: imported?.id,
        lastSyncedAt: new Date(),
      },
    });

    logger.info(`[square] Connected business ${business.id}, imported ${locations.length} location(s)`);
    res.redirect(
      `${CLIENT_URL}/sitara/operator?square=connected&locations=${locations.length}&business=${business.id}`
    );
  } catch (e: any) {
    logger.error(`[square] OAuth callback failed: ${e.message}`);
    res.redirect(
      `${CLIENT_URL}/sitara/operator?square=error&message=${encodeURIComponent(e.message?.substring(0, 150) || 'Square connection failed')}`
    );
  }
});

// POST /api/v1/square/sync { businessId } — re-pull locations
router.post('/sync', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const business = await ensureOwner(String(businessId), req.user!.id);
    if (!business) return res.status(403).json({ error: 'Not your business' });
    const conn = await prisma.squareConnection.findUnique({ where: { businessId: business.id } });
    if (!conn) return res.status(404).json({ error: 'Square not connected' });

    let accessToken = unprotectToken(conn.accessToken);
    if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date() && conn.refreshToken) {
      const refreshed: any = await refreshAccessToken(conn.refreshToken);
      accessToken = refreshed.access_token;
      await prisma.squareConnection.update({
        where: { businessId: business.id },
        data: {
          accessToken: protectToken(accessToken),
          tokenExpiresAt: refreshed.expires_at ? new Date(refreshed.expires_at) : undefined,
        },
      });
    }

    const locations = await fetchLocations(accessToken);
    const imported = await importLocations(business.id, locations);
    await prisma.squareConnection.update({
      where: { businessId: business.id },
      data: { lastSyncedAt: new Date(), squareLocationId: imported?.id },
    });
    res.json({ success: true, data: { count: locations.length, imported } });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/square/payment-link { businessId, amount, reservationId?, label? }
// Creates a Square-hosted checkout on the MERCHANT's own Square account —
// the business takes the payment on rails they already trust, Sitara tracks it.
router.post('/payment-link', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId, amount, reservationId, label } = req.body || {};
    if (!businessId || !amount) return res.status(400).json({ error: 'businessId and amount are required' });
    const business = await ensureOwner(String(businessId), req.user!.id);
    if (!business) return res.status(403).json({ error: 'Not your business' });
    const conn = await prisma.squareConnection.findUnique({ where: { businessId: business.id } });
    if (!conn) return res.status(404).json({ error: 'Square not connected' });

    let accessToken = unprotectToken(conn.accessToken);
    if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date() && conn.refreshToken) {
      const refreshed: any = await refreshAccessToken(conn.refreshToken);
      accessToken = refreshed.access_token;
      await prisma.squareConnection.update({
        where: { businessId: business.id },
        data: {
          accessToken: protectToken(accessToken),
          tokenExpiresAt: refreshed.expires_at ? new Date(refreshed.expires_at) : undefined,
        },
      });
    }

    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ error: 'Invalid amount' });

    // Location is required by Square — sync it if we never stored one.
    let locationId = conn.squareLocationId;
    if (!locationId) {
      const locations = await fetchLocations(accessToken);
      const primary = locations.find((l: any) => l.status === 'ACTIVE') || locations[0];
      locationId = primary?.id;
      if (locationId) {
        await prisma.squareConnection.update({
          where: { businessId: business.id },
          data: { squareLocationId: locationId, lastSyncedAt: new Date() },
        });
      }
    }
    if (!locationId) return res.status(400).json({ error: 'No Square location found for this business' });

    const resp = await fetch(`${squareBase()}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: `sitara-${reservationId || Date.now()}-${cents}`,
        order: {
          location_id: locationId,
          line_items: [
            {
              name: label || 'Sitara booking deposit',
              quantity: '1',
              base_price_money: { amount: cents, currency: 'USD' },
            },
          ],
          metadata: reservationId ? { sitaraReservationId: String(reservationId) } : undefined,
        },
        checkout_options: {
          redirect_url: `${CLIENT_URL}/sitara/my-bookings?pay=success&ref=${reservationId || ''}`,
          ask_for_shipping_address: false,
        },
      }),
    });
    const data: any = await resp.json();
    if (!resp.ok || !data?.payment_link?.url) {
      throw new Error(data?.errors?.[0]?.detail || 'Square payment link failed');
    }
    res.json({
      success: true,
      data: { url: data.payment_link.url, id: data.payment_link.id, orderId: data.payment_link.order_id },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
