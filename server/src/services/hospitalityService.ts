import crypto from 'crypto';
import { logger } from '../utils/logger';
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
      apiKey: data.apiKey, // TODO: encrypt at rest
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

    // In production: call PabandiEscrow smart contract via blockchainService
    // await blockchainService.createHospitalityEscrow({
    //   reservationId: booking.pmsReservationId,
    //   businessAddress: property.walletAddress,
    //   depositAmount: booking.depositAmount,
    //   currency: booking.currency,
    // });

    logger.info(`[Hospitality] Escrow OPEN for ${booking.pmsReservationId}`);
  }

  private async onCheckout(
    booking: HospitalityBooking,
    property: ConnectedProperty
  ): Promise<void> {
    logger.info(
      `[Hospitality] CHECKOUT: Releasing escrow → property for booking ${booking.pmsReservationId}`
    );

    // In production: call escrow.releaseToBusinesss()
    // await blockchainService.releaseHospitalityEscrow(booking.pmsReservationId);

    // Mint $PAB loyalty reward to guest (50 PAB per night)
    const pabReward = booking.nights * PAB_REWARD_PER_NIGHT;
    logger.info(
      `[Hospitality] Minting ${pabReward} $PAB to guest ${booking.guestEmail} ` +
      `(${booking.nights} nights × ${PAB_REWARD_PER_NIGHT} PAB)`
    );

    // In production: await blockchainService.mintPabReward(guestWallet, pabReward, booking.pmsReservationId);
  }

  private async onCancellation(
    booking: HospitalityBooking,
    property: ConnectedProperty
  ): Promise<void> {
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / 3_600_000;

    // Default policy: refund if cancelled >24h before check-in, forfeit if <24h
    if (hoursUntilCheckIn >= 24) {
      logger.info(
        `[Hospitality] CANCELLED (>24h notice): Full refund for booking ${booking.pmsReservationId}`
      );
      // In production: await blockchainService.refundHospitalityEscrow(booking.pmsReservationId);
    } else {
      logger.info(
        `[Hospitality] CANCELLED (<24h notice): Late-cancel forfeit for booking ${booking.pmsReservationId}`
      );
      // In production: await blockchainService.forfeitHospitalityNoShow(booking.pmsReservationId);
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
    // In production: await blockchainService.forfeitHospitalityNoShow(booking.pmsReservationId);
  }

  // ─── Normalizers ──────────────────────────────────────────────────────────

  private normalizeBeds24Event(
    raw: any,
    property: ConnectedProperty
  ): { action: string; booking: HospitalityBooking } | null {
    // Beds24 v2 webhook body: https://api.beds24.com/v2/#/Webhooks
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
    // Cloudbeds webhook: https://developers.cloudbeds.com/api/webhooks
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

  // ─── Utilities ────────────────────────────────────────────────────────────

  private calcNights(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 1;
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.round(ms / 86_400_000));
  }

  private async registerWebhookWithPms(property: ConnectedProperty): Promise<void> {
    // In production: call PMS API to register our webhook URL
    // e.g., POST https://api.beds24.com/v2/settings/webhooks
    // with { url: `https://api.pabandi.com/api/hospitality/${property.provider}/webhook`, token: property.signingSecret }
    logger.info(
      `[Hospitality] Webhook registration queued for ${property.provider} property "${property.propertyName}"`
    );
  }
}

export const hospitalityService = new HospitalityService();
