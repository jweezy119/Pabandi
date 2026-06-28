import { logger } from '../utils/logger';

export interface TrustSignals {
  isDisposableEmail: boolean;
  isVoiceOrSmsNumber: boolean;
  riskDelta: number;
  reason: string;
}

export class TrustSignalService {
  private readonly disposableDomains = new Set([
    'mailinator.com',
    'trashmail.com',
    'tempmail.com',
    'guerrillamail.com',
    'yopmail.com',
    'sharklasers.com',
    '10minutemail.com',
    'minuteinbox.com',
    'temp-mail.org',
    'mailnesia.com',
  ]);

  async evaluateSignals({
    email,
    phone,
    deviceFingerprint,
  }: {
    email?: string | null;
    phone?: string | null;
    deviceFingerprint?: string | null;
  }): Promise<TrustSignals> {
    const reason: string[] = [];
    let riskDelta = 0;

    const domain = (email || '').split('@')[1]?.toLowerCase();
    if (domain && this.disposableDomains.has(domain)) {
      riskDelta += 15;
      reason.push('disposable-email');
    }

    if (phone) {
      const digits = phone.replace(/[^0-9]/g, '');
      if (digits.length < 7) {
        riskDelta += 10;
        reason.push('weak-phone-signal');
      }
    }

    if (!deviceFingerprint || deviceFingerprint.length < 12) {
      riskDelta += 5;
      reason.push('missing-device-fingerprint');
    }

    return {
      isDisposableEmail: reason.includes('disposable-email'),
      isVoiceOrSmsNumber: reason.includes('weak-phone-signal'),
      riskDelta: Math.max(-20, Math.min(20, riskDelta)),
      reason: reason.join(',') || 'clean-signals',
    };
  }
}

export const trustSignalService = new TrustSignalService();
