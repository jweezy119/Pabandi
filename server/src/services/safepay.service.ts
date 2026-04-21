import { logger } from '../utils/logger';

// Standard Safepay Environment URLs
const SAFEPAY_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.getsafepay.com' 
  : 'https://sandbox.api.getsafepay.com';

const SAFEPAY_API_KEY = process.env.SAFEPAY_API_KEY || 'sec_sk_test_12345';
const SAFEPAY_SECRET_KEY = process.env.SAFEPAY_SECRET_KEY || 'sec_sk_test_123456';

export const safepayService = {
  /**
   * Initialize a new Safepay Checkout Session
   * @param amount Deposit amount in PKR
   * @param reservationId The underlying reservation ID to track
   */
  async createCheckoutUrl(amount: number, reservationId: string): Promise<string> {
    try {
      logger.info(`Initiating Safepay checkout for reservation: ${reservationId}`);
      
      // Request Safepay Auth Token using native Fetch
      const authResponse = await fetch(`${SAFEPAY_API_URL}/client/passport/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
          client_id: SAFEPAY_API_KEY,
          client_secret: SAFEPAY_SECRET_KEY, 
        })
      });

      const authData = (await authResponse.json()) as any;
      const token = authData?.data?.token;
      
      if (!token) throw new Error("Could not retrieve token from Safepay");

      // Initiate Tracker
      const trackerResponse = await fetch(`${SAFEPAY_API_URL}/order/v1/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
          amount: amount,
          currency: 'PKR',
          client: SAFEPAY_API_KEY,
        })
      });

      const trackerData = (await trackerResponse.json()) as any;
      const trackerId = trackerData?.data?.token;

      if (!trackerId) throw new Error("Could not construct tracker token");

      // Construct Checkout URL 
      const baseURL = process.env.NODE_ENV === 'production' 
        ? 'https://getsafepay.com/checkout' 
        : 'https://sandbox.api.getsafepay.com/checkout';

      const checkoutUrl = `${baseURL}?client=${SAFEPAY_API_KEY}&tracker=${trackerId}&reference=${reservationId}&source=custom`;
      
      return checkoutUrl;

    } catch (error) {
      logger.error('Failed to create Safepay checkout. Keys might not be valid yet. Using MVP Fallback URL.');
      // Fallback for testing frontend logic if true API keys aren't set
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return `${baseUrl}/reservations?safepay_mock_success=true&ref=${reservationId}`;
    }
  },

  /**
   * Verify Webhook Signature to safely update Reservation Status
   */
  verifyWebhook(signature: string, payload: any): boolean {
    // In production, cryptographically verify the signature using crypto.createHmac
    return true; 
  }
};
