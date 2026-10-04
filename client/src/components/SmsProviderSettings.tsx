import React, { useCallback, useEffect, useState } from 'react';
import { Card } from './primitives/Card';
import { Button } from './primitives/Button';
import { smsSettingsService } from '../services/api';

/**
 * Bring-your-own SMS provider settings.
 *
 * WHY THIS IS A SEPARATE COMPONENT
 * -------------------------------
 * The previous attempt at this was `SMSSetup.tsx`, which posted to an endpoint that
 * stored nothing and replied "Credentials saved". It was unmounted, so nothing broke —
 * but it is the reason this one is written to a different rule: **the UI never claims a
 * state the server did not confirm.**
 *
 * Concretely:
 *   - "Connected" is shown only when the server says `status === 'VERIFIED'`. A FAILED
 *     connection shows the provider's own reason, because "Invalid username or password"
 *     is the only useful thing to tell someone who just pasted the wrong token.
 *   - The credential fields are NEVER pre-filled. They are write-only on the server, so
 *     there is nothing to pre-fill, and a form that appeared to hold a secret it did not
 *     have would be the same lie in a new place.
 *   - Disconnect confirms first, and says what it removes.
 *   - A failed request renders `role="alert"`. It does not `alert()`, and it does not
 *     leave a disabled button that looks broken.
 */

type Provider = 'TWILIO' | 'VONAGE';
type Status = 'PENDING' | 'VERIFIED' | 'FAILED';

interface ProviderView {
  provider: Provider;
  fromNumber: string;
  status: Status;
  lastError: string | null;
  lastVerifiedAt: string | null;
}

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]';

export function SmsProviderSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [connected, setConnected] = useState(false);
  const [view, setView] = useState<ProviderView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [provider, setProvider] = useState<Provider>('TWILIO');
  const [fromNumber, setFromNumber] = useState('');
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await smsSettingsService.get();
      const data = res.data?.data ?? res.data;
      setConnected(Boolean(data?.connected));
      setView(data?.provider ?? null);
      setLoadError(null);
    } catch (err: any) {
      // The status endpoint failing is not the same as "not connected", and reporting it
      // as such would show an empty form over a connection that exists.
      setLoadError(
        err?.response?.status === 403
          ? 'Finish setting up your business before connecting an SMS provider.'
          : 'Could not load your SMS provider settings. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    setNotice(null);

    try {
      const res = await smsSettingsService.connect({
        provider,
        fromNumber: fromNumber.trim(),
        ...(provider === 'TWILIO'
          ? { accountSid: accountSid.trim(), authToken: authToken.trim() }
          : { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }),
      });

      const data = res.data?.data ?? res.data;
      const next: ProviderView | null = data?.provider ?? null;
      setView(next);
      setConnected(data?.connected === true);

      if (data?.connected) {
        setNotice(`Connected. Reminders will send from ${next?.fromNumber}.`);
        // Clear the secret from component state the moment it is no longer needed.
        setAuthToken('');
        setApiSecret('');
        setAccountSid('');
        setApiKey('');
      } else {
        // The server stores the failure with the provider's reason; show that verbatim
        // rather than a generic apology.
        setActionError(next?.lastError || 'The provider did not accept those credentials.');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      setActionError(
        status === 503
          ? 'This server cannot store credentials securely yet, so nothing was saved. Contact support.'
          : err?.response?.data?.message || 'Could not save those credentials.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await smsSettingsService.verify();
      const data = res.data?.data ?? res.data;
      setView(data?.provider ?? null);
      setConnected(data?.connected === true);
      if (data?.connected) setNotice('Credential still works.');
      else setActionError(data?.provider?.lastError || 'Verification failed.');
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Could not verify those credentials.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        'Disconnect your SMS provider? Messages stop sending until you connect another one. Your stored credentials are deleted.',
      )
    ) {
      return;
    }
    setDisconnecting(true);
    setActionError(null);
    setNotice(null);
    try {
      await smsSettingsService.disconnect();
      setConnected(false);
      setView(null);
      setNotice('Provider disconnected and the stored credentials deleted.');
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Could not disconnect the provider.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card padding="lg">
        <p className="text-sm text-[var(--soft-stone)]">Loading SMS settings…</p>
      </Card>
    );
  }

  const verified = connected && view?.status === 'VERIFIED';

  return (
    <Card padding="lg" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">SMS Provider</h2>
        <p className="text-sm text-[var(--soft-stone)] mt-1">
          Connect your own Twilio or Vonage account. Messages are billed by your provider at
          your rate — Pabandi does not charge you per message.
        </p>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-[var(--terracotta)]">
          {loadError}
        </p>
      )}

      {/* ── Connected state ─────────────────────────────────────────────── */}
      {view && (
        <div
          className="rounded-xl p-4 border"
          style={{
            borderColor: verified ? 'var(--sage)' : 'var(--terracotta)',
            background: verified ? 'rgba(74,124,104,0.06)' : 'rgba(199,106,77,0.06)',
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-[var(--warm-ink)]">
                {view.provider === 'TWILIO' ? 'Twilio' : 'Vonage'} · {view.fromNumber}
              </p>
              <p className="text-xs text-[var(--soft-stone)] mt-1">
                {verified
                  ? `Verified${view.lastVerifiedAt ? ` ${new Date(view.lastVerifiedAt).toLocaleString()}` : ''}`
                  : 'Not verified'}
              </p>
              {!verified && view.lastError && (
                <p className="text-xs mt-2" style={{ color: 'var(--terracotta)' }}>
                  {view.lastError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" loading={verifying} onClick={handleVerify}>
                Re-verify
              </Button>
              <Button variant="danger" size="sm" loading={disconnecting} onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Connect / replace form ──────────────────────────────────────── */}
      <form onSubmit={handleConnect} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="sms-provider" className="text-sm font-semibold text-[var(--warm-ink)]">
              Provider
            </label>
            <select
              id="sms-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className={inputClass}
            >
              <option value="TWILIO">Twilio</option>
              <option value="VONAGE">Vonage</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="sms-from" className="text-sm font-semibold text-[var(--warm-ink)]">
              Sending number
            </label>
            <input
              id="sms-from"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="+15550100"
              required
              className={inputClass}
            />
          </div>
        </div>

        {provider === 'TWILIO' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="sms-sid" className="text-sm font-semibold text-[var(--warm-ink)]">
                Account SID
              </label>
              <input
                id="sms-sid"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                placeholder="AC…"
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sms-token" className="text-sm font-semibold text-[var(--warm-ink)]">
                Auth token
              </label>
              <input
                id="sms-token"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="sms-key" className="text-sm font-semibold text-[var(--warm-ink)]">
                API key
              </label>
              <input
                id="sms-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sms-secret" className="text-sm font-semibold text-[var(--warm-ink)]">
                API secret
              </label>
              <input
                id="sms-secret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </div>
          </div>
        )}

        <p className="text-xs text-[var(--soft-stone)]">
          Credentials are encrypted before storage and cannot be read back. We verify them
          against your provider before saving.
        </p>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {view ? 'Replace provider' : 'Connect provider'}
          </Button>
        </div>
      </form>

      {notice && (
        <p role="status" className="text-sm" style={{ color: 'var(--sage)' }}>
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm" style={{ color: 'var(--terracotta)' }}>
          {actionError}
        </p>
      )}
    </Card>
  );
}
