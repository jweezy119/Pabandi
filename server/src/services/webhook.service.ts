import crypto from 'crypto';
import axios from 'axios';
import { WebhookEndpoint } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

class WebhookService {
  private MAX_RETRIES = 3;
  private RETRY_DELAY_MS = 2000;

  /**
   * Dispatches a webhook event to all subscribed active endpoints for a business.
   * @param eventName - The name of the event (e.g., 'reservation.created')
   * @param businessId - The business ID
   * @param payload - The data payload to send
   */
  public async dispatch(eventName: string, businessId: string, payload: any) {
    try {
      // Find all active endpoints for this business
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: {
          businessId,
          isActive: true,
        },
      });

      if (!endpoints.length) return;

      // Filter endpoints that are subscribed to this event
      const subscribedEndpoints = endpoints.filter((endpoint: WebhookEndpoint) =>
        endpoint.subscribedEvents.includes(eventName) || endpoint.subscribedEvents.includes('*')
      );

      if (!subscribedEndpoints.length) return;

      const body = JSON.stringify({
        event: eventName,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      // Dispatch to each subscribed endpoint
      for (const endpoint of subscribedEndpoints) {
        // Run asynchronously without awaiting so we don't block the main flow
        this.sendWithRetry(endpoint, body).catch((error) => {
          logger.error(`Webhook dispatch completely failed for ${endpoint.targetUrl}: ${error.message}`);
        });
      }
    } catch (error: any) {
      logger.error(`Error initiating webhook dispatch: ${error.message}`);
    }
  }

  private async sendWithRetry(endpoint: WebhookEndpoint, body: string, attempt: number = 1): Promise<void> {
    try {
      // Generate HMAC signature
      const signature = crypto
        .createHmac('sha256', endpoint.signingSecret)
        .update(body)
        .digest('hex');

      logger.info(`Sending webhook event to ${endpoint.targetUrl} (Attempt ${attempt})`);

      await axios.post(endpoint.targetUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          'x-pabandi-signature': signature,
        },
        timeout: 5000, // 5 second timeout per request
      });

      logger.info(`Successfully sent webhook to ${endpoint.targetUrl}`);
    } catch (error: any) {
      if (attempt < this.MAX_RETRIES) {
        logger.warn(
          `Webhook delivery to ${endpoint.targetUrl} failed on attempt ${attempt}. Retrying in ${this.RETRY_DELAY_MS}ms. Error: ${error.message}`
        );
        
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY_MS * attempt)); // Exponential backoff
        
        return this.sendWithRetry(endpoint, body, attempt + 1);
      } else {
        throw new Error(`Max retries reached (${this.MAX_RETRIES}). Final error: ${error.message}`);
      }
    }
  }
}

export const webhookService = new WebhookService();
