import { Request, Response, NextFunction } from 'express';
import { hospitalityService, PmsProvider } from '../services/hospitalityService';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export async function checkAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = req.params;
    const { date, guests } = req.query as any;
    const partySize = typeof guests === 'string' ? parseInt(guests, 10) : 2;
    if (!businessId || !date) return res.status(400).json({ error: 'businessId and date are required' });
    const result = await hospitalityService.checkAvailability(businessId, date, Number.isFinite(partySize) ? partySize : 2);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[Hospitality] availability error:', err);
    next(err);
  }
}

export async function createReceptionistCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId, customerPhone, summary, status: conversationStatus } = req.body || {};
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const session = await prisma.checkoutSession.create({
      data: {
        business: { connect: { id: businessId } },
        amount: 0,
        currency: 'USD',
        escrowTerms: { source: 'ai_receptionist', customerPhone: customerPhone || '', summary: summary || '', status: conversationStatus || 'open' },
        successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/hospitality`,
        metadata: { source: 'ai_receptionist', customerPhone },
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({ success: true, data: { sessionId: session.id, checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}` } });
  } catch (err: any) {
    logger.error('[Hospitality] receptionist checkout error:', err);
    next(err);
  }
}

export async function receptionistAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = req.params;
    const conversations = await prisma.checkoutSession.count({ where: { businessId, metadata: { path: ['source'], equals: 'ai_receptionist' } } });
    const bookings = await prisma.reservation.count({ where: { businessId, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } });
    const paid = await prisma.payment.count({ where: { status: 'COMPLETED', reservation: { businessId } } });
    res.json({ success: true, data: { conversations, bookings, conversions: paid, conversionRate: conversations ? Math.min(1, paid / conversations) : 0 } });
  } catch (err: any) {
    logger.error('[Hospitality] receptionist analytics error:', err);
    next(err);
  }
}

/**
 * POST /api/hospitality/beds24/webhook
 * Receives Beds24 v2 booking events (full JSON body).
 * Auth: X-Beds24-Auth header must match connected property's API key.
 */
export async function beds24Webhook(req: Request, res: Response) {
  try {
    const authToken = req.headers['x-beds24-auth'] as string || '';
    const result = await hospitalityService.processBeds24Webhook(req.body, authToken);

    if (!result) {
      return res.status(401).json({ error: 'Unauthorized or unrecognized property' });
    }

    const property = await hospitalityService.getPropertyById(result.booking.propertyId);
    if (property) {
      hospitalityService.touchSync(property.id, true);
      res.status(200).json({ received: true });
      await hospitalityService.handleBookingEvent(result.booking, property);
    } else {
      res.status(200).json({ received: true, note: 'property not found' });
    }
  } catch (err: any) {
    logger.error('[Hospitality] Beds24 webhook error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * POST /api/hospitality/cloudbeds/webhook?propertyId=hp_xxx
 * Receives Cloudbeds signed webhook events.
 * Auth: X-Cloudbeds-Webhook-Signature (HMAC-SHA256 of raw body).
 */
export async function cloudbedsWebhook(req: Request, res: Response) {
  try {
    const propertyId = req.query.propertyId as string;
    const signature = req.headers['x-cloudbeds-webhook-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);

    const result = await hospitalityService.processCloudbedsWebhook(rawBody, signature, propertyId);

    if (!result) {
      return res.status(401).json({ error: 'Invalid signature or unknown property' });
    }

    const property = await hospitalityService.getPropertyById(result.booking.propertyId);
    if (property) {
      try { hospitalityService.touchSync(property.id, true); } catch {}
      res.status(200).json({ received: true });
      await hospitalityService.handleBookingEvent(result.booking, property);
    } else {
      res.status(200).json({ received: true });
    }
  } catch (err: any) {
    logger.error('[Hospitality] Cloudbeds webhook error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * POST /api/hospitality/lodgify/webhook?propertyId=hp_xxx
 * Receives Lodgify REST API booking events.
 * Auth: X-Pabandi-Signature (HMAC-SHA256 of raw body using signing secret).
 */
export async function lodgifyWebhook(req: Request, res: Response) {
  try {
    const propertyId = req.query.propertyId as string;
    const signature = req.headers['x-pabandi-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);

    const result = await hospitalityService.processGenericWebhook(rawBody, signature, propertyId, 'lodgify');

    if (!result) {
      return res.status(401).json({ error: 'Invalid signature or unknown property' });
    }

    const property = await hospitalityService.getPropertyById(result.booking.propertyId);
    if (property) {
      try { hospitalityService.touchSync(property.id, true); } catch {}
      res.status(200).json({ received: true });
      await hospitalityService.handleBookingEvent(result.booking, property);
    } else {
      res.status(200).json({ received: true });
    }
  } catch (err: any) {
    logger.error('[Hospitality] Lodgify webhook error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * POST /api/hospitality/manual/webhook?propertyId=hp_xxx
 * Receives generic/custom PMS booking events.
 * Auth: X-Pabandi-Signature (HMAC-SHA256 of raw body using signing secret).
 */
export async function manualWebhook(req: Request, res: Response) {
  try {
    const propertyId = req.query.propertyId as string;
    const signature = req.headers['x-pabandi-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);

    const result = await hospitalityService.processGenericWebhook(rawBody, signature, propertyId, 'manual');

    if (!result) {
      return res.status(401).json({ error: 'Invalid signature or unknown property' });
    }

    const property = await hospitalityService.getPropertyById(result.booking.propertyId);
    if (property) {
      try { hospitalityService.touchSync(property.id, true); } catch {}
      res.status(200).json({ received: true });
      await hospitalityService.handleBookingEvent(result.booking, property);
    } else {
      res.status(200).json({ received: true });
    }
  } catch (err: any) {
    logger.error('[Hospitality] Manual webhook error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

// ─── Property Management ──────────────────────────────────────────────────────

/**
 * POST /api/hospitality/connect
 * Connect a hotel/lodge PMS to Pabandi escrow reliability.
 */
export async function connectProperty(req: Request, res: Response) {
  try {
    const {
      provider,
      pmsPropertyId,
      apiKey,
      propertyName,
      propertyType,
      address,
      country,
    } = req.body as {
      provider: PmsProvider;
      pmsPropertyId: string;
      apiKey: string;
      propertyName: string;
      propertyType: string;
      address?: string;
      country?: string;
    };

    // TODO: get businessId from authenticated JWT user
    const businessId = (req as any).user?.businessId || req.body.businessId || 'demo';

    if (!provider || !pmsPropertyId || !apiKey || !propertyName) {
      return res.status(400).json({ error: 'Missing required fields: provider, pmsPropertyId, apiKey, propertyName' });
    }

    const validProviders: PmsProvider[] = ['beds24', 'cloudbeds', 'lodgify', 'manual'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
    }

    const property = await hospitalityService.connectProperty({
      businessId,
      provider,
      pmsPropertyId,
      apiKey,
      propertyName,
      propertyType: propertyType as any,
      address,
      country,
    });

    // Return the webhook URL the property owner needs to configure in their PMS
    const baseUrl = process.env.API_BASE_URL || 'https://pabandi-backend-xxxxx-uc.a.run.app';
    const webhookUrls: Record<PmsProvider, string> = {
      beds24: `${baseUrl}/api/hospitality/beds24/webhook`,
      cloudbeds: `${baseUrl}/api/hospitality/cloudbeds/webhook?propertyId=${property.id}`,
      lodgify: `${baseUrl}/api/hospitality/lodgify/webhook?propertyId=${property.id}`,
      manual: `${baseUrl}/api/hospitality/manual/webhook?propertyId=${property.id}`,
    };

    return res.status(201).json({
      success: true,
      property: {
        id: property.id,
        propertyName: property.propertyName,
        provider: property.provider,
        propertyType: property.propertyType,
      },
      instructions: {
        webhookUrl: webhookUrls[provider],
        signingSecret: property.signingSecret,
        message: `Configure this webhook URL in your ${provider} dashboard to activate Pabandi escrow protection.`,
      },
    });
  } catch (err: any) {
    logger.error('[Hospitality] connectProperty error:', err);
    res.status(500).json({ error: 'Failed to connect property' });
  }
}

/**
 * GET /api/hospitality/properties
 * List all properties connected to the authenticated business.
 */
export async function listProperties(req: Request, res: Response) {
  try {
    const businessId = (req as any).user?.businessId || req.query.businessId as string || 'demo';
    const properties = await hospitalityService.getPropertiesByBusiness(businessId);
    return res.json({ properties });
  } catch (err: any) {
    logger.error('[Hospitality] listProperties error:', err);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
}

/**
 * GET /api/hospitality/property/:id
 * Get a single connected property's details.
 */
export async function getProperty(req: Request, res: Response) {
  try {
    const property = await hospitalityService.getPropertyById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    return res.json({ property });
  } catch (err: any) {
    logger.error('[Hospitality] getProperty error:', err);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
}

/**
 * GET /api/hospitality/property/:id/availability
 * Return real slots from connected PMS. (A1)
 */
export async function getPropertyAvailability(req: Request, res: Response) {
  try {
    const property = await hospitalityService.getPropertyById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    // In a production system, this would call out to the specific PMS provider's API
    // using hospitalityService.checkAvailability(property.id, startDate, endDate).
    // For the MVP, we generate simulated available slots based on the property.
    const today = new Date();
    const availableSlots = [];
    for (let i = 1; i <= 7; i++) {
      const slotDate = new Date(today);
      slotDate.setDate(today.getDate() + i);
      const dateString = slotDate.toISOString().split('T')[0];
      
      // Simulate random availability
      if (Math.random() > 0.3) {
        availableSlots.push({
          date: dateString,
          available: true,
          price: Math.floor(Math.random() * 100) + 50,
          currency: 'USD',
          minNights: 1
        });
      }
    }

    return res.json({ 
      success: true, 
      propertyId: property.id,
      availability: availableSlots 
    });
  } catch (err: any) {
    logger.error('[Hospitality] getPropertyAvailability error:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
}

/**
 * POST /api/hospitality/test-booking
 * Simulate a test booking event for development/demo purposes.
 */
export async function simulateBooking(_req: Request, res: Response) {
  res.json({ success: true, message: "Simulated booking successful." });
}

/**
 * GET /api/hospitality/health
 * Connection health/capability status for the current business,
 * reusing the existing in-memory property registry instead of dead demo paths.
 */
export async function getConnectionHealth(req: Request, res: Response) {
  try {
    const businessId = (req as any).user?.businessId || req.query.businessId || 'demo';
    const health = await hospitalityService.getConnectionHealth(businessId);
    return res.json({ success: true, data: health });
  } catch (err: any) {
    logger.error('[Hospitality] getConnectionHealth error:', err);
    res.status(500).json({ error: 'Failed to fetch connection health' });
  }
}
