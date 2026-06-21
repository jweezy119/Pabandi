import { Request, Response } from 'express';
import { hospitalityService, PmsProvider } from '../services/hospitalityService';
import { logger } from '../utils/logger';

// ─── Webhook Receivers ────────────────────────────────────────────────────────

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
      // Handle async — respond immediately to PMS (required within 5s)
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
 * POST /api/hospitality/test-booking
 * Simulate a test booking event for development/demo purposes.
 */
export async function simulateBooking(req: Request, res: Response) {
  try {
    const propertyId = req.body.propertyId || req.query.propertyId;
    const property = await hospitalityService.getPropertyById(propertyId as string);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 3 * 86_400_000).toISOString().split('T')[0];

    const testBooking = {
      pmsReservationId: `TEST-${Date.now()}`,
      propertyId,
      provider: property.provider,
      guestName: 'Ahmad Test Guest',
      guestEmail: 'test@pabandi.io',
      guestPhone: '+923001234567',
      checkIn: tomorrow,
      checkOut: dayAfter,
      nights: 2,
      depositAmount: 50,
      currency: 'USD',
      totalAmount: 200,
      status: 'CONFIRMED' as const,
    };

    await hospitalityService.handleBookingEvent(testBooking, property);

    return res.json({
      success: true,
      message: 'Test booking event processed successfully',
      booking: testBooking,
    });
  } catch (err: any) {
    logger.error('[Hospitality] simulateBooking error:', err);
    res.status(500).json({ error: 'Failed to simulate booking' });
  }
}
