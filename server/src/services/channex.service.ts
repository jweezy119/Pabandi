import axios from 'axios';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// Use production Channex endpoint for live operations
const CHANNEX_API_URL = 'https://app.channex.io/api/v1';
const API_KEY = process.env.CHANNEX_API_KEY;

const channexClient = axios.create({
  baseURL: CHANNEX_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'user-api-key': API_KEY || '',
  },
});

export const channexService = {
  /**
   * Provision a property on Channex when a Host enables Channel Manager
   */
  async provisionProperty(businessId: string): Promise<string> {
    try {
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business) throw new Error('Business not found');

      if (!API_KEY) {
        throw new Error('Channel Manager integration is not configured on the server');
      }

      // Create Property Payload for Channex
      const payload = {
        property: {
          title: business.name || 'Untitled Property',
          currency: 'USD',
          timezone: business.timezone || 'UTC',
          country: business.country || 'US',
          city: business.city || 'Unknown',
          address: business.address || 'Unknown',
          zip_code: business.postalCode || '00000',
        },
      };

      const propertyResponse = await channexClient.post('/properties', payload);
      const channexPropertyId = propertyResponse.data.data?.id;
      if (!channexPropertyId) {
        throw new Error('Channex did not return a property id');
      }

      // Also create a default Room Type for this property in Channex
      await channexClient.post('/room_types', {
        room_type: {
          property_id: channexPropertyId,
          title: 'Entire Property',
          count_of_rooms: 1,
          occupancy: 2,
        },
      });

      // Save to our DB
      await prisma.business.update({
        where: { id: businessId },
        data: { channexPropertyId },
      });

      return channexPropertyId;
    } catch (error: any) {
      const message = error.response?.data?.errors || error.response?.data?.message || error.message;
      logger.error(`Channex Provision Error: ${message}`);
      throw new Error(message || 'Failed to provision property on Channex');
    }
  },

  /**
   * Push a reservation from Pabandi to Channex to block calendar on Airbnb
   */
  async pushBooking(reservationId: string) {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { business: true, customer: true },
      });
      if (!reservation) {
        throw new Error('Reservation not found for Channex sync');
      }

      const business = reservation.business;
      if (!business.channexPropertyId) {
        throw new Error('Business is not connected to Channex');
      }

      if (!API_KEY) {
        throw new Error('Channel Manager integration is not configured on the server');
      }

      // We need to fetch the room type ID for this property
      const roomsResponse = await channexClient.get(`/room_types?filter[property_id]=${business.channexPropertyId}`);
      const roomId = roomsResponse.data.data[0]?.id;

      if (!roomId) {
        throw new Error('No room types found for property');
      }

      const payload = {
        booking: {
          property_id: business.channexPropertyId,
          room_type_id: roomId,
          arrival_date: reservation.reservationDate.toISOString().split('T')[0],
          departure_date: reservation.checkOutDate ? reservation.checkOutDate.toISOString().split('T')[0] : reservation.reservationDate.toISOString().split('T')[0],
          status: 'new',
          customer: {
            name: reservation.customerName,
            surname: 'Guest',
            mail: reservation.customerEmail || 'no-email@pabandi.com',
            phone: reservation.customerPhone,
          },
          occupancy: {
            adults: reservation.numberOfGuests,
          },
        },
      };

      const response = await channexClient.post('/bookings', payload);
      const channexBookingId = response.data.data?.id;

      if (!channexBookingId) {
        throw new Error('Channex did not return a booking id');
      }

      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { channexBookingId },
      });

      logger.info(`Successfully pushed booking ${reservation.id} to Channex (${channexBookingId})`);

    } catch (error: any) {
      logger.error(`Channex Push Booking Error: ${error.response?.data?.errors || error.message}`);
    }
  },
  
  /**
   * Cancel a booking on Channex
   */
  async cancelBooking(reservationId: string) {
      try {
        const reservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { business: true }
        });
        if (!reservation || !reservation.channexBookingId) return;
  
        if (!API_KEY || reservation.channexBookingId.startsWith('chx_mock')) {
          logger.info(`Mock cancelling booking ${reservationId} on Channex...`);
          return;
        }
  
        await channexClient.post(`/bookings/${reservation.channexBookingId}/cancel`);
        logger.info(`Successfully cancelled booking ${reservation.channexBookingId} on Channex`);
      } catch (error: any) {
        logger.error(`Channex Cancel Booking Error: ${error.response?.data?.errors || error.message}`);
      }
    }
};
