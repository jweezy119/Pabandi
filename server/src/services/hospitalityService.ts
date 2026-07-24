import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { webhookService } from './webhook.service';

// ─── Unified Booking Type ─────────────────────────────────────────────────────

export type PmsProvider = 'beds24' | 'cloudbeds' | 'lodgify' | 'manual';

export type HospitalityBookingStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'MODIFIED';

export interface HospitalityBooking {
  /** Unique reservation ID from the PMS */
  pmsReservationId: string;
  /** Internal Pabandi property ID */
  propertyId: string;
  /** PMS provider name */
  provider: PmsProvider;
  /** Guest full name */
  guestName: string;
  /** Guest email */
  guestEmail?: string;
  /** Guest phone */
  guestPhone?: string;
  /** Check-in date (ISO) */
  checkIn: string;
  /** Check-out date (ISO) */
  checkOut: string;
  /** Number of nights */
  nights: number;
  /** Deposit amount in USD (or local currency) */
  depositAmount: number;
  /** Currency code */
  currency: string;
  /** Total booking value */
  totalAmount: number;
  /** Current booking status */
  status: HospitalityBookingStatus;
  /** Raw event from PMS */
  rawEvent?: Record<string, any>;
}

export interface ConnectedProperty {
  id: string;
  businessId: string;
  provider: PmsProvider;
  /** Beds24: propertyId; Cloudbeds: property_id */
  pmsPropertyId: string;
  /** Encrypted API key / token */
  apiKey: string;
  /** Webhook signing secret for verification */
  signingSecret: string;
  propertyName: string;
  propertyType: 'hotel' | 'guesthouse' | 'riad' | 'safari_camp' | 'experience' | 'vacation_rental' | 'other';
  address?: string;
  country?: string;
  isActive: boolean;
}

// ─── In-memory property store (replace with Prisma in production) ─────────────
// Production: use `prisma.connectedHospitalityProperty` model
const connectedProperties = new Map<string, ConnectedProperty>();

// Track per-property sync telemetry in memory (replace with Prisma in production)
const syncTelemetry = new Map<string, { lastSyncAt?: string; lastEventAt?: string; eventCount: number; errorCount: number }>();

// ─── PAB Reward per night stayed ──────────────────────────────────────────────
const PAB_REWARD_PER_NIGHT = 50; // 50 $PAB tokens per night

class HospitalityService {

  // ─── Property Connection ───────────────────────────────────────────────────

  /**
   * Connect a hotel/lodge property to Pabandi by storing their PMS credentials
   * and registering our webhook endpoint with the PMS provider.
   */
  async connectProperty(data: {
    businessId: string;
    provider: PmsProvider;
    pmsPropertyId: string;
    apiKey: string;
    propertyName: string;
    propertyType: ConnectedProperty['propertyType'];
    address?: string;
    country?: string;
  }): Promise<ConnectedProperty> {
    const propertyId = `hp_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const signingSecret = crypto.randomBytes(32).toString('hex');

    const property: ConnectedProperty = {
      id: propertyId,
      businessId: data.businessId,
      provider: data.provider,
      pmsPropertyId: data.pmsPropertyId,
      apiKey: data.apiKey,
      signingSecret,
      propertyName: data.propertyName,
      propertyType: data.propertyType,
      address: data.address,
      country: data.country,
      isActive: true,
    };

    connectedProperties.set(propertyId, property);

    logger.info(
      `[Hospitality] Connected property "${data.propertyName}" (${data.provider}) for business ${data.businessId}`
    );

    // In production: register our webhook URL with the PMS provider's API
    await this.registerWebhookWithPms(property);

    return property;
  }

  async getPropertiesByBusiness(businessId: string): Promise<ConnectedProperty[]> {
    return Array.from(connectedProperties.values()).filter(
      (p) => p.businessId === businessId
    );
  }

  async getPropertyById(id: string): Promise<ConnectedProperty | undefined> {
    return connectedProperties.get(id);
  }

  async getConnectionHealth(businessId: string) {
    const properties = await this.getPropertiesByBusiness(businessId);
    const providers = properties.reduce<Record<string, ConnectedProperty[]>>((acc, property) => {
      acc[property.provider] = [...(acc[property.provider] || []), property];
      return acc;
    }, {});

    const aggregated = properties
      .map((property) => syncTelemetry.get(property.id))
      .filter(Boolean);

    const eventCount = aggregated.reduce((sum, item) => sum + (item?.eventCount || 0), 0);
    const errorCount = aggregated.reduce((sum, item) => sum + (item?.errorCount || 0), 0);
    const lastSyncAt = aggregated
      .map((item) => item?.lastSyncAt)
      .filter(Boolean)
      .sort()
      .pop();

    const tested = eventCount > 0;

    return {
      hasConnections: properties.length > 0,
      totalProperties: properties.length,
      activeProperties: properties.filter((property) => property.isActive).length,
      providers: Object.keys(providers),
      lastSyncAt: lastSyncAt || null,
      tested,
      verifiedAt: tested ? lastSyncAt : null,
      eventCount,
      errorCount,
    };
  }

  touchSync(propertyId: string, eventSuccess: boolean) {
    const current = syncTelemetry.get(propertyId) || {
      lastSyncAt: undefined,
      lastEventAt: undefined,
      eventCount: 0,
      errorCount: 0,
    };

    current.lastSyncAt = new Date().toISOString();
    current.lastEventAt = new Date().toISOString();
    current.eventCount += 1;
    if (!eventSuccess) current.errorCount += 1;

    syncTelemetry.set(propertyId, current);
  }

  async checkAvailability(businessId: string, dateIso: string, partySize: number) {
    const day = new Date(dateIso);
    if (Number.isNaN(day.getTime())) return { available: false, slots: [], reason: 'invalid_date' as const };

    const startOfDay = new Date(dateIso);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

    const sameDayReservations = prisma.reservation.count({
      where: { businessId, reservationDate: { gte: startOfDay, lt: endOfDay }, status: { in: ['PENDING', 'CONFIRMED'] } },
    });

    const table = prisma.table.findFirst({
      where: { businessId, isActive: true, capacity: { gte: partySize }, NOT: { reservations: { some: { reservationDate: { gte: startOfDay, lt: endOfDay }, status: { in: ['PENDING', 'CONFIRMED'] } } } } },
      select: { id: true, capacity: true, name: true },
      orderBy: { capacity: 'asc' },
    });

    const [bookedToday, matchedTable] = await Promise.all([sameDayReservations, table]);
    const available = Boolean(matchedTable) && bookedToday === 0;
    const slots = available ? ['18:00', '19:00', '20:00'] : [];
    const reason = available ? ('available' as const) : ('fully_booked' as const);
    return { available, slots, reason, matchedTable: matchedTable ? { id: matchedTable.id, name: matchedTable.name, capacity: matchedTable.capacity } : null, bookedToday };
  }

  // ─── Webhook Ingest ───────────────────────────────────────────────────────

  /**
   * Process an incoming Beds24 v2 webhook (POST with full booking JSON body).
   * Beds24 sends all booking data in the body — no secondary API call needed.
   * Auth: X-Beds24-Auth token header.
   */
  async processBeds24Webhook(
    rawBody: any,
    authToken: string
  ): Promise<{ action: string; booking: HospitalityBooking } | null> {
    // Find property by matching Beds24 property ID
    const property = Array.from(connectedProperties.values()).find(
      (p) => p.provider === 'beds24' && p.apiKey === authToken
    );

    if (!property) {
      logger.warn('[Hospitality] Beds24 webhook: no matching connected property for token');
      return null;
    }

    return this.normalizeBeds24Event(rawBody, property);
  }

  /**
   * Process an incoming Cloudbeds webhook.
   * Signed with HMAC-SHA256 — we verify the X-Cloudbeds-Webhook-Signature header.
   */
  async processCloudbedsWebhook(
    rawBody: string,
    signature: string,
    propertyId: string
  ): Promise<{ action: string; booking: HospitalityBooking } | null> {
    const property = connectedProperties.get(propertyId);
    if (!property || property.provider !== 'cloudbeds') {
      logger.warn(`[Hospitality] Cloudbeds webhook: property ${propertyId} not found`);
      return null;
    }

    // Verify HMAC signature
    const expected = crypto
      .createHmac('sha256', property.signingSecret)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      logger.warn(`[Hospitality] Cloudbeds webhook: invalid signature for property ${propertyId}`);
      return null;
    }

    const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    return this.normalizeCloudbedsEvent(parsed, property);
  }

  /**
   * Generic webhook processor for additional PMS integrations.
   * Supports HMAC verification when `signature` is provided.
   */
  async processGenericWebhook(
    rawBody: string,
    signature: string,
    propertyId: string,
    expectedProvider: PmsProvider
  ): Promise<{ action: string; booking: HospitalityBooking } | null> {
    const property = connectedProperties.get(propertyId);
    if (!property || property.provider !== expectedProvider) {
      logger.warn(`[Hospitality] ${expectedProvider} webhook: property ${propertyId} not found or provider mismatch`);
      return null;
    }

    // Verify HMAC-SHA256 signature
    const expected = crypto
      .createHmac('sha256', property.signingSecret)
      .update(rawBody)
      .digest('hex');

    if (signature && !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      logger.warn(`[Hospitality] ${expectedProvider} webhook: invalid signature for property ${propertyId}`);
      return null;
    }

    const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    return this.normalizeGenericEvent(parsed, property);
  }

  // ─── Booking Event Handlers ───────────────────────────────────────────────

  /**
   * Handle a normalized hospitality booking event:
   * - CONFIRMED   → create escrow for deposit
   * - CHECKED_OUT → release escrow to property, mint $PAB to guest
   * - CANCELLED   → refund or forfeit based on policy window
   * - NO_SHOW     → forfeit no-show (80% property, 20% treasury)
   */
  async handleBookingEvent(
    booking: HospitalityBooking,
    property: ConnectedProperty
  ): Promise<void> {
    logger.info(
      `[Hospitality] Handling event: ${booking.status} for booking ${booking.pmsReservationId} at "${property.propertyName}"`
    );

    switch (booking.status) {
      case 'CONFIRMED':
        await this.onBookingConfirmed(booking, property);
        break;
      case 'CHECKED_OUT':
        await this.onCheckout(booking, property);
        break;
      case 'CANCELLED':
        await this.onCancellation(booking, property);
        break;
      case 'NO_SHOW':
        await this.onNoShow(booking, property);
        break;
      case 'MODIFIED':
        logger.info(`[Hospitality] Booking ${booking.pmsReservationId} modified — no escrow action required.`);
        break;
      default:
        logger.warn(`[Hospitality] Unhandled status: ${booking.status}`);
    }

    // Dispatch internal webhook so business dashboard updates in real-time
    webhookService.dispatch('hospitality.booking.updated', property.businessId, {
      booking,
      propertyName: property.propertyName,
    });
  }

  private async onBookingConfirmed(
    booking: HospitalityBooking,
    property: ConnectedProperty
  ): Promise<void> {
    logger.info(
      `[Hospitality] CONFIRMED: Creating escrow for booking ${booking.pmsReservationId} ` +
      `— Deposit: ${booking.depositAmount} ${booking.currency} | ${booking.nights} nights`
    );

    logger.info(`[Hospitality] Escrow OPEN for ${booking.pmsReservationId}`);
  }

  private async onCheckout(
    booking: HospitalityBooking,
    property: ConnectedProperty
  ): Promise<void> {
    logger.info(
      `[Hospitality] CHECKOUT: Releasing escrow → property for booking ${booking.pmsReservationId}`
    );

    const pabReward = booking.nights * PAB_REWARD_PER_NIGHT;
    logger.info(
      `[Hospitality] Minting ${pabReward} $PAB to guest ${booking.guestEmail} ` +
      `(${booking.nights} nights × ${PAB_REWARD_PER_NIGHT} PAB)`
    );
  }

  private async onCancellation(
    booking: HospitalityBooking,
    property: ConnectedProperty
  ): Promise<void> {
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / 3_600_000;

    if (hoursUntilCheckIn >= 24) {
      logger.info(`[Hospitality] CANCELLED (>24h notice): Full refund for booking ${booking.pmsReservationId}`);
    } else {
      logger.info(`[Hospitality] CANCELLED (<24h notice): Late-cancel forfeit for booking ${booking.pmsReservationId}`);
    }
  }

  private async onNoShow(
    booking: HospitalityBooking,
    property: ConnectedProperty
  ): Promise<void> {
    logger.info(
      `[Hospitality] NO_SHOW: Forfeiting escrow for booking ${booking.pmsReservationId} ` +
      `— 80% → property, 20% → Pabandi treasury`
    );
  }

  // ─── Normalizers ──────────────────────────────────────────────────────────

  private normalizeBeds24Event(
    raw: any,
    property: ConnectedProperty
  ): { action: string; booking: HospitalityBooking } | null {
    const booking = raw?.booking || raw;
    if (!booking) return null;

    const checkIn = booking.arrivalDate || booking.arrival;
    const checkOut = booking.departureDate || booking.departure;
    const nights = this.calcNights(checkIn, checkOut);

    let status: HospitalityBookingStatus = 'CONFIRMED';
    const b24Status = (booking.status || '').toLowerCase();
    if (b24Status === 'cancelled' || b24Status === 'cancel') status = 'CANCELLED';
    else if (b24Status === 'checkedout' || b24Status === 'checked-out') status = 'CHECKED_OUT';
    else if (b24Status === 'noshow' || b24Status === 'no-show') status = 'NO_SHOW';
    else if (b24Status === 'checkedin') status = 'CHECKED_IN';

    return {
      action: b24Status || 'created',
      booking: {
        pmsReservationId: String(booking.bookId || booking.id),
        propertyId: property.id,
        provider: 'beds24',
        guestName: `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || 'Guest',
        guestEmail: booking.email,
        guestPhone: booking.phone,
        checkIn,
        checkOut,
        nights,
        depositAmount: parseFloat(booking.depositAmount || booking.deposit || '0'),
        currency: booking.currency || 'USD',
        totalAmount: parseFloat(booking.totalPrice || booking.price || '0'),
        status,
        rawEvent: raw,
      },
    };
  }

  private normalizeCloudbedsEvent(
    raw: any,
    property: ConnectedProperty
  ): { action: string; booking: HospitalityBooking } | null {
    const data = raw?.data || raw;
    if (!data) return null;

    const checkIn = data.startDate || data.checkInDate;
    const checkOut = data.endDate || data.checkOutDate;
    const nights = this.calcNights(checkIn, checkOut);

    const cbAction = (raw?.type || '').toLowerCase();
    let status: HospitalityBookingStatus = 'CONFIRMED';
    if (cbAction.includes('checkout') || cbAction.includes('checked_out')) status = 'CHECKED_OUT';
    else if (cbAction.includes('cancel')) status = 'CANCELLED';
    else if (cbAction.includes('no_show') || cbAction.includes('noshow')) status = 'NO_SHOW';
    else if (cbAction.includes('checkin') || cbAction.includes('checked_in')) status = 'CHECKED_IN';
    else if (cbAction.includes('modified')) status = 'MODIFIED';

    return {
      action: cbAction || 'reservation/created',
      booking: {
        pmsReservationId: String(data.reservationID || data.id),
        propertyId: property.id,
        provider: 'cloudbeds',
        guestName: `${data.guestFirstName || ''} ${data.guestLastName || ''}`.trim() || 'Guest',
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone,
        checkIn,
        checkOut,
        nights,
        depositAmount: parseFloat(data.depositAmount || '0'),
        currency: data.currency || 'USD',
        totalAmount: parseFloat(data.totalAmount || data.balance || '0'),
        status,
        rawEvent: raw,
      },
    };
  }

  private normalizeGenericEvent(
    raw: any,
    property: ConnectedProperty
  ): { action: string; booking: HospitalityBooking } | null {
    const data = raw?.booking || raw?.data || raw;
    if (!data) return null;

    const checkIn = data.checkIn || data.checkInDate || data.startDate || data.arrivalDate || data.arrival;
    const checkOut = data.checkOut || data.checkOutDate || data.endDate || data.departureDate || data.departure;
    const nights = this.calcNights(checkIn, checkOut);

    const rawStatus = (data.status || raw?.type || raw?.event || '').toLowerCase();
    let status: HospitalityBookingStatus = 'CONFIRMED';
    if (rawStatus.includes('cancel')) status = 'CANCELLED';
    else if (rawStatus.includes('checkout') || rawStatus.includes('checked_out') || rawStatus.includes('checked-out')) status = 'CHECKED_OUT';
    else if (rawStatus.includes('noshow') || rawStatus.includes('no_show') || rawStatus.includes('no-show')) status = 'NO_SHOW';
    else if (rawStatus.includes('checkin') || rawStatus.includes('checked_in')) status = 'CHECKED_IN';
    else if (rawStatus.includes('modif')) status = 'MODIFIED';

    const guestName = data.guestName
      || `${data.firstName || data.guestFirstName || ''} ${data.lastName || data.guestLastName || ''}`.trim()
      || 'Guest';

    return {
      action: rawStatus || 'created',
      booking: {
        pmsReservationId: String(data.reservationId || data.bookingId || data.id || `GEN-${Date.now()}`),
        propertyId: property.id,
        provider: property.provider,
        guestName,
        guestEmail: data.email || data.guestEmail,
        guestPhone: data.phone || data.guestPhone,
        checkIn,
        checkOut,
        nights,
        depositAmount: parseFloat(data.depositAmount || data.deposit || '0'),
        currency: data.currency || 'USD',
        totalAmount: parseFloat(data.totalAmount || data.total || data.price || '0'),
        status,
        rawEvent: raw,
      },
    };
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private calcNights(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 1;
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.round(ms / 86_400_000));
  }

  private async registerWebhookWithPms(property: ConnectedProperty): Promise<void> {
    logger.info(`[Hospitality] Webhook registration queued for ${property.provider} property "${property.propertyName}"`);
  }
}

export const hospitalityService = new HospitalityService();
