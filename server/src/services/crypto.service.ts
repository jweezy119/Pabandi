import crypto from 'crypto';
import { logger } from '../utils/logger';

class CryptoService {
  private currentSalt: string;
  private saltDate: string;

  constructor() {
    this.currentSalt = this.generateSalt();
    this.saltDate = new Date().toISOString().split('T')[0];
    
    // In a real multi-instance backend, this would be stored in Redis
    // and rotated by a cron job globally at midnight UTC.
    setInterval(() => this.checkRotation(), 1000 * 60 * 60); // Check every hour
  }

  private generateSalt(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private checkRotation() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.saltDate) {
      this.currentSalt = this.generateSalt();
      this.saltDate = today;
      logger.info(`[Crypto] Rotated daily HMAC salt for ${today}`);
    }
  }

  public getPublicSalt(): string {
    return this.currentSalt;
  }

  /**
   * Used by backend processes (like webhooks) to hash raw PII
   * using the current active salt, matching the SDK's behavior.
   */
  public hmacHash(data: string): string {
    return crypto
      .createHmac('sha256', this.currentSalt)
      .update(data)
      .digest('hex');
  }
}

export const cryptoService = new CryptoService();
