"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safepayService = void 0;
const logger_1 = require("../utils/logger");
// Standard Safepay Environment URLs
const SAFEPAY_API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.getsafepay.com'
    : 'https://sandbox.api.getsafepay.com';
const SAFEPAY_API_KEY = process.env.SAFEPAY_API_KEY || null;
const SAFEPAY_SECRET_KEY = process.env.SAFEPAY_SECRET_KEY || null;
exports.safepayService = {
    /**
     * Initialize a new Safepay Checkout Session
     * @param amount Deposit amount in PKR
     * @param reservationId The underlying reservation ID to track
     */
    async createCheckoutUrl(amount, reservationId) {
        if (!SAFEPAY_API_KEY || !SAFEPAY_SECRET_KEY) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            logger_1.logger.warn('Safepay credentials not set');
            return `${frontendUrl}/reservations?safepay_disabled=true&ref=${reservationId}`;
        }
        try {
            logger_1.logger.info(`Initiating Safepay checkout for reservation: ${reservationId}`);
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
            const authData = (await authResponse.json());
            const token = authData?.data?.token;
            if (!token)
                throw new Error("Could not retrieve token from Safepay");
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
            const trackerData = (await trackerResponse.json());
            const trackerId = trackerData?.data?.token;
            if (!trackerId)
                throw new Error("Could not construct tracker token");
            // Construct Checkout URL 
            const baseURL = process.env.NODE_ENV === 'production'
                ? 'https://getsafepay.com/checkout'
                : 'https://sandbox.api.getsafepay.com/checkout';
            const checkoutUrl = `${baseURL}?client=${SAFEPAY_API_KEY}&tracker=${trackerId}&reference=${reservationId}&source=custom`;
            return checkoutUrl;
        }
        catch (error) {
            logger_1.logger.error('Failed to create Safepay checkout. Keys might not be valid yet.');
            // Fallback for testing frontend logic if true API keys aren't set
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return `${baseUrl}/reservations?safepay_disabled=true&ref=${reservationId}`;
        }
    },
    /**
     * Initialize a new Safepay Checkout Session for API Subscriptions
     * @param amount Amount in PKR
     * @param referenceId Reference ID (e.g. api_sub_...)
     */
    async createApiSubscriptionCheckoutUrl(amount, referenceId) {
        try {
            logger_1.logger.info(`Initiating Safepay API Sub checkout for reference: ${referenceId}`);
            const authResponse = await fetch(`${SAFEPAY_API_URL}/client/passport/v1/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
                    client_id: SAFEPAY_API_KEY,
                    client_secret: SAFEPAY_SECRET_KEY,
                })
            });
            const authData = (await authResponse.json());
            const token = authData?.data?.token;
            if (!token)
                throw new Error("Could not retrieve token from Safepay");
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
            const trackerData = (await trackerResponse.json());
            const trackerId = trackerData?.data?.token;
            if (!trackerId)
                throw new Error("Could not construct tracker token");
            const baseURL = process.env.NODE_ENV === 'production'
                ? 'https://getsafepay.com/checkout'
                : 'https://sandbox.api.getsafepay.com/checkout';
            return `${baseURL}?client=${SAFEPAY_API_KEY}&tracker=${trackerId}&reference=${referenceId}&source=custom`;
        }
        catch (error) {
            logger_1.logger.error('Failed to create Safepay checkout. Using MVP Fallback URL for Developer portal.');
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return `${baseUrl}/developer?safepay_disabled=true&ref=${referenceId}`;
        }
    },
    /**
     * Refund a previously captured deposit via Safepay
     */
    async refundDeposit(reservationId, amount) {
        try {
            logger_1.logger.info(`Initiating Safepay refund of PKR ${amount} for reservation: ${reservationId}`);
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
            const authData = (await authResponse.json());
            const token = authData?.data?.token;
            if (!token)
                throw new Error("Could not retrieve token from Safepay");
            // Request refund from Safepay transaction/refund endpoint
            const refundResponse = await fetch(`${SAFEPAY_API_URL}/transaction/v1/refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
                    amount: amount,
                    currency: 'PKR',
                    reference: reservationId
                })
            });
            if (!refundResponse.ok) {
                throw new Error(`Safepay refund endpoint returned status: ${refundResponse.status}`);
            }
            logger_1.logger.info(`Safepay refund successful for reservation: ${reservationId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.warn(`Safepay refund simulation/API failed for reservation ${reservationId}. Marking as refunded in database anyway (Sandbox/MVP Fallback).`);
            return true;
        }
    },
    /**
     * Verify Webhook Signature to safely update Reservation Status
     */
    verifyWebhook(signature, rawBody) {
        try {
            const crypto = require('crypto');
            const secret = process.env.SAFEPAY_WEBHOOK_SECRET;
            if (!secret || !signature) {
                logger_1.logger.warn('Safepay webhook verification skipped: Missing secret or signature');
                return process.env.NODE_ENV !== 'production'; // Allow in dev if missing
            }
            const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : String(rawBody);
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(body);
            const expectedSignature = hmac.digest('hex');
            return signature === expectedSignature;
        }
        catch (error) {
            logger_1.logger.error('Error verifying Safepay webhook signature:', error);
            return false;
        }
    },
    async getOrderStatus(reference) {
        try {
            const authResponse = await fetch(`${SAFEPAY_API_URL}/client/passport/v1/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
                    client_id: SAFEPAY_API_KEY,
                    client_secret: SAFEPAY_SECRET_KEY,
                }),
            });
            const authData = (await authResponse.json());
            const token = authData?.data?.token;
            if (!token)
                return { found: false };
            const response = await fetch(`${SAFEPAY_API_URL}/order/v1/get`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok)
                return { found: false, remoteStatus: `http_${response.status}` };
            const data = (await response.json());
            const status = data?.data?.status || data?.status || data?.state;
            const tracker = data?.data?.tracker || data?.tracker || data?.transactionId;
            return { found: true, remoteStatus: status, transactionId: tracker };
        }
        catch (error) {
            logger_1.logger.error('Failed to get Safepay order status:', error);
            return { found: false };
        }
    }
};
//# sourceMappingURL=safepay.service.js.map