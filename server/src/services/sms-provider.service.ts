import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/encryption';
import twilio from 'twilio';
import { CustomError } from '../middleware/errorHandler';

/**
 * Bring-your-own SMS provider credentials.
 *
 * WHY THIS EXISTS
 * ---------------
 * Reselling SMS means Pabandi pays roughly $0.005 a message, and the cost lands on our
 * margin: at 5,000 messages that is about $25 against a $49 subscription. Connecting the
 * merchant's own provider makes it their bill and our cost of goods zero.
 *
 * This is the model already used for Square, where the money never touches Pabandi at
 * all — the platform charges a subscription and takes its fee separately rather than
 * touching the transaction.
 *
 * THREE RULES THIS MODULE ENFORCES
 * ---------------------------------
 * 1. FAIL CLOSED ON ENCRYPTION. `square-connection.service.protectToken` stores the
 *    secret RAW when ENCRYPTION_KEY is missing, warning rather than failing. Repeating
 *    that here would put a credential that can spend money into the database in
 *    plaintext, so instead: refuse to save, and say why.
 *
 * 2. VERIFY BEFORE SAVING. A merchant who pastes a mistyped auth token would otherwise
 *    see "connected" and then find every reminder silently failing — the same dead
 *    affordance as the Save button that started this work. The credential is checked
 *    against the provider first, and a failure is stored with its reason.
 *
 * 3. THE SECRET NEVER LEAVES. `credentials` is written encrypted and never selected
 *    into any response. Only `provider`, `fromNumber`, `status` and `lastVerifiedAt`
 *    are returned — the from-number is safe because it appears on every outbound
 *    message anyway.
 */

export type SmsProvider = 'TWILIO' | 'VONAGE';

export interface PublicProviderView {
  provider: SmsProvider;
  fromNumber: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  lastError: string | null;
  lastVerifiedAt: Date | null;
  connectedAt: Date;
}

interface StoredCredentials {
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  apiSecret?: string;
  fromNumber: string;
}

/** Throws unless secrets can actually be encrypted, rather than storing them raw. */
function assertEncryptionAvailable(): void {
  if (!String(process.env.ENCRYPTION_KEY || '').trim()) {
    throw new CustomError(
      'Server cannot store provider credentials: encryption is not configured. ' +
        'Contact support — your key has not been saved anywhere.',
      503,
    );
  }
}

/** Only ever the safe fields. Used by every response that mentions a connection. */
export function toPublicView(row: {
  provider: string;
  fromNumber: string;
  status: string;
  lastError: string | null;
  lastVerifiedAt: Date | null;
  createdAt: Date;
}): PublicProviderView {
  return {
    provider: row.provider as SmsProvider,
    fromNumber: row.fromNumber,
    status: row.status as PublicProviderView['status'],
    lastError: row.lastError,
    lastVerifiedAt: row.lastVerifiedAt,
    connectedAt: row.createdAt,
  };
}

export async function getProvider(businessId: string): Promise<PublicProviderView | null> {
  const row = await prisma.businessSmsProvider.findUnique({ where: { businessId } });
  return row ? toPublicView(row) : null;
}

/**
 * Check a credential against the provider WITHOUT saving anything.
 *
 * For Twilio the cheapest honest check is fetching the account: it proves the SID/token
 * pair works and costs nothing. It does not prove the from-number is theirs, which is
 * why sending still fails loudly at send time if it is not.
 */
export async function verifyCredentials(
  provider: SmsProvider,
  creds: Omit<StoredCredentials, 'fromNumber'>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    if (provider === 'TWILIO') {
      if (!creds.accountSid || !creds.authToken) {
        return { ok: false, reason: 'Twilio needs an Account SID and an Auth Token' };
      }
      const client = twilio(creds.accountSid, creds.authToken);
      await client.api.v2010.accounts(creds.accountSid).fetch();
      return { ok: true };
    }

    if (provider === 'VONAGE') {
      if (!creds.apiKey || !creds.apiSecret) {
        return { ok: false, reason: 'Vonage needs an API key and an API secret' };
      }
      // Vonage's REST API is a JWT flow; the sandbox account endpoint is the simplest
      // proof the pair is live.
      const res = await fetch('https://rest.nexmo.com/account/getBalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64')}`,
        },
      });
      if (res.ok) return { ok: true };
      const body = await res.text();
      return { ok: false, reason: `Vonage rejected the credentials (${res.status}): ${body.slice(0, 120)}` };
    }

    return { ok: false, reason: `Unsupported provider ${provider}` };
  } catch (err: any) {
    // Twilio raises on a bad token; the message is safe to show and is the single most
    // useful thing we can tell a merchant who pasted the wrong thing.
    const reason = err?.message ? String(err.message).slice(0, 200) : 'verification failed';
    return { ok: false, reason };
  }
}

/**
 * Verify, then store.
 *
 * A failed verification is still recorded, with its reason, and the connection is marked
 * FAILED. Recording it means the settings page can explain what is wrong instead of
 * showing nothing; storing an unverified credential encrypted is not a risk because the
 * send path refuses to use anything that is not VERIFIED.
 */
export async function connectProvider(
  businessId: string,
  input: { provider: SmsProvider; fromNumber: string; credentials: Omit<StoredCredentials, 'fromNumber'> },
): Promise<PublicProviderView> {
  assertEncryptionAvailable();

  // Validate the provider BEFORE anything is written.
  //
  // `verifyCredentials` returns `{ ok: false, reason: 'Unsupported provider …' }`, which
  // would have been stored as a FAILED row — persisting a configuration we can never
  // use, and leaving the settings page showing a connection that cannot work. The route
  // validates this too; doing it here as well means a caller reaching the service
  // directly (a script, the channel router) cannot create the same junk row.
  if (input.provider !== 'TWILIO' && input.provider !== 'VONAGE') {
    throw new CustomError(`Unsupported SMS provider: ${String(input.provider)}`, 400);
  }

  const fromNumber = String(input.fromNumber || '').trim();
  if (!fromNumber) {
    throw new CustomError('A sending number is required', 400);
  }

  const verdict = await verifyCredentials(input.provider, input.credentials);

  const encrypted = encrypt(JSON.stringify({ ...input.credentials, fromNumber }));

  const row = await prisma.businessSmsProvider.upsert({
    where: { businessId },
    create: {
      businessId,
      provider: input.provider,
      credentials: encrypted,
      fromNumber,
      status: verdict.ok ? 'VERIFIED' : 'FAILED',
      lastError: verdict.ok ? null : verdict.reason,
      lastVerifiedAt: verdict.ok ? new Date() : null,
    },
    update: {
      provider: input.provider,
      credentials: encrypted,
      fromNumber,
      status: verdict.ok ? 'VERIFIED' : 'FAILED',
      lastError: verdict.ok ? null : verdict.reason,
      lastVerifiedAt: verdict.ok ? new Date() : null,
    },
  });

  if (!verdict.ok) {
    logger.warn(`[sms] provider verification failed for business ${businessId}: ${verdict.reason}`);
  }
  return toPublicView(row);
}

/** Re-run verification against the stored credential. */
export async function reverify(businessId: string): Promise<PublicProviderView> {
  const row = await prisma.businessSmsProvider.findUnique({ where: { businessId } });
  if (!row) throw new CustomError('No SMS provider is connected', 404);

  const creds = JSON.parse(decrypt(row.credentials)) as StoredCredentials;
  const verdict = await verifyCredentials(row.provider as SmsProvider, creds);

  const updated = await prisma.businessSmsProvider.update({
    where: { businessId },
    data: {
      status: verdict.ok ? 'VERIFIED' : 'FAILED',
      lastError: verdict.ok ? null : verdict.reason,
      lastVerifiedAt: verdict.ok ? new Date() : null,
    },
  });
  return toPublicView(updated);
}

/**
 * Remove the connection and the stored secret.
 *
 * Deleting the row rather than blanking the credential, so the ciphertext does not sit
 * in the database after a disconnect.
 */
export async function disconnectProvider(businessId: string): Promise<void> {
  await prisma.businessSmsProvider.deleteMany({ where: { businessId } });
}

/**
 * Decrypted credentials for the send path. Server-side only.
 *
 * Throws rather than returning null, so a caller cannot accidentally fall back to the
 * platform's shared credentials — which would bill Pabandi for a merchant's messages.
 */
export async function requireCredentials(
  businessId: string,
): Promise<{ provider: SmsProvider; creds: StoredCredentials }> {
  const row = await prisma.businessSmsProvider.findUnique({ where: { businessId } });
  if (!row) {
    throw new CustomError(
      'No SMS provider is connected. Add your Twilio or Vonage credentials in Settings to send SMS.',
      409,
    );
  }
  if (row.status !== 'VERIFIED') {
    throw new CustomError(
      row.lastError
        ? `Your SMS provider is not connected: ${row.lastError}`
        : 'Your SMS provider has not been verified yet.',
      409,
    );
  }
  return {
    provider: row.provider as SmsProvider,
    creds: JSON.parse(decrypt(row.credentials)) as StoredCredentials,
  };
}
