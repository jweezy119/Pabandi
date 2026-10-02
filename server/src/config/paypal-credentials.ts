/**
 * PayPal credential resolution.
 *
 * There are three unrelated things a PayPal app can be asked to do, and each
 * one wanted its own pair of credentials. They used to share
 * PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET, which meant:
 *
 *   - paypal.service.ts  → Orders v2 checkout (payments)
 *   - passport.ts       → PayPal *login* (OAuth strategy)
 *
 * Overwriting one pair to change the other silently broke the second at the
 * next container restart, with nothing in the logs saying why. They are now
 * separate variables, and each thing reads only its own.
 *
 * Which pair does what
 * --------------------
 * PAYPAL_LOGIN_*     Sign-in with PayPal. Isolated on purpose: it is the pair
 *                    most easily clobbered by accident, since "the PayPal
 *                    credentials" is ambiguous.
 *
 * PAYPAL_MERCHANT_*  Payments where Pabandi is the seller of record. Money
 *                    settles into Pabandi's own account. This is Option B,
 *                    which carries custody: refunds, chargebacks, and a
 *                    working-capital requirement. It is the default only
 *                    because it is what has always been configured.
 *
 * PAYPAL_PLATFORM_*  Payments on behalf of connected sellers, so the merchant
 *                    is paid and Pabandi never holds the funds. This is the
 *                    zero-capital path. Requires PayPal to have onboarded us
 *                    as a platform; the credential existing does not imply
 *                    approval.
 *
 * Preference order
 * ----------------
 * Merchant first, platform second. That is deliberate and it is the part most
 * worth being explicit about: choosing platform as the default would mean that
 * any deployment which had both configured would quietly take custody, which is
 * the outcome with the worst liability profile. If the intent is the
 * merchant-owned model, set PAYPAL_PAYMENT_ACCOUNT=platform explicitly rather
 * than relying on which credentials happen to be present.
 */

import { logger } from '../utils/logger';

export type PaypalAccountType = 'merchant' | 'platform';

function readPair(prefix: 'MERCHANT' | 'PLATFORM' | 'LOGIN'): { clientId: string; clientSecret: string } {
  return {
    clientId: (process.env[`PAYPAL_${prefix}_CLIENT_ID`] || '').trim(),
    clientSecret: (process.env[`PAYPAL_${prefix}_CLIENT_SECRET`] || '').trim(),
  };
}

function isComplete(pair: { clientId: string; clientSecret: string }): boolean {
  return Boolean(pair.clientId && pair.clientSecret);
}

export interface PaypalCredentials {
  account: PaypalAccountType;
  clientId: string;
  clientSecret: string;
}

/**
 * Which pair should handle payments.
 *
 * PAYPAL_PAYMENT_ACCOUNT forces it. Without it, merchant wins when present and
 * platform is the fallback, so an operator who has both set gets the
 * custody-carrying behaviour and has to opt in to the other.
 */
export function preferredPaymentAccount(): PaypalAccountType {
  const configured = (process.env.PAYPAL_PAYMENT_ACCOUNT || '').trim().toLowerCase();
  if (configured === 'platform' || configured === 'merchant') return configured;
  return isComplete(readPair('MERCHANT')) ? 'merchant' : 'platform';
}

/**
 * Credentials for the Orders v2 payment calls, or null when neither pair is
 * configured.
 *
 * A half-configured pair is treated as absent rather than attempted. Sending
 * `clientId:` with an empty secret produces an opaque 401 from PayPal that
 * reads like a permissions problem.
 */
export function paymentCredentials(): PaypalCredentials | null {
  const account = preferredPaymentAccount();
  const pair = readPair(account === 'platform' ? 'PLATFORM' : 'MERCHANT');
  if (isComplete(pair)) return { account, ...pair };

  warnMissingAccount(account);
  return null;
}

/**
 * Credentials for PayPal sign-in. Falls back to the legacy unsuffixed names so
 * an existing deployment keeps working after this change, but logs that it is
 * doing so — the whole point of the split is to stop those names being
 * ambiguous, and a silent fallback keeps that ambiguity alive.
 */
export function loginCredentials(): { clientId: string; clientSecret: string } | null {
  const pair = readPair('LOGIN');
  if (isComplete(pair)) return pair;

  const legacy = {
    clientId: (process.env.PAYPAL_CLIENT_ID || '').trim(),
    clientSecret: (process.env.PAYPAL_CLIENT_SECRET || '').trim(),
  };
  if (isComplete(legacy)) {
    logger.warn(
      '[PayPal] Using legacy PAYPAL_CLIENT_ID/SECRET for PayPal login. Set PAYPAL_LOGIN_CLIENT_ID/SECRET and unset the old names — while both exist, an edit to the old pair still silently changes sign-in.',
    );
    return legacy;
  }
  return null;
}

let warnedAccount: string | null = null;
function warnMissingAccount(account: PaypalAccountType): void {
  if (warnedAccount === account) return;
  warnedAccount = account;
  logger.warn(
    `[PayPal] No usable ${account} credentials. Expected PAYPAL_${account.toUpperCase()}_CLIENT_ID and PAYPAL_${account.toUpperCase()}_CLIENT_SECRET. Payments cannot be created until they are set.`,
  );
}

/** Webhook id from the dashboard. Distinct from any client id or secret. */
export function webhookId(): string {
  return (process.env.PAYPAL_WEBHOOK_ID || '').trim();
}

export function isLive(): boolean {
  return (process.env.PAYPAL_ENV || (process.env.NODE_ENV === 'production' ? 'live' : 'sandbox')).toLowerCase() === 'live';
}

export function apiBaseUrl(): string {
  return isLive() ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}