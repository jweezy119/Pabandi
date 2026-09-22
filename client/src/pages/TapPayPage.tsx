import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { tapService } from '../services/api';
import QRCodeLib from 'qrcode';
import { tokens } from '../design-system';

type PaymentStatus = 'idle' | 'processing' | 'verified' | 'error';

const SOLANA_USDC_LINK = (recipient: string, amount: string | number, memo = '') =>
  `solana:${recipient}?amount=${amount}${memo ? `&memo=${encodeURIComponent(memo)}` : ''}`;

export default function TapPayPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [searchParams] = useSearchParams();

  const amount = useMemo(() => parseFloat(searchParams.get('amount') || '0'), [searchParams]);
  const currency = useMemo(() => (searchParams.get('currency') || 'USDC').toUpperCase(), [searchParams]);
  const intentId = searchParams.get('intent') || undefined;

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [intent, setIntent] = useState<any>(null);
  const [signature, setSignature] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [blinkJson, setBlinkJson] = useState<any>(null);
  const [merchant, setMerchant] = useState<{ id: string; name: string; category?: string | null } | null>(null);

  useEffect(() => {
    if (!sellerId) return;
    let active = true;
    tapService.getMerchant(sellerId)
      .then(res => {
        const data = (res.data?.data || res.data) as any;
        if (active && data?.success && data?.data?.id) setMerchant(data.data);
      })
      .catch(() => { if (active) setMerchant(null); });
    return () => { active = false; };
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId || !amount || amount <= 0) {
      setError('Missing required payment parameters in the URL.');
      setStatus('error');
    }
  }, [sellerId, amount]);

  useEffect(() => {
    const currentUrl = window.location.href;
    let active = true;
    QRCodeLib.toDataURL(currentUrl, { width: 512, margin: 2, color: { dark: 'var(--warm-ink)', light: 'white' } })
      .then((url: string) => { if (active) setQrDataUrl(url); })
      .catch(() => { if (active) setQrDataUrl(''); });

    fetch(`/.well-known/blinks.json?sellerId=${encodeURIComponent(sellerId || '')}`, { headers: { Accept: 'application/json' } })
      .then(res => res.ok ? res.json() : Promise.resolve(null))
      .then(data => { if (active) setBlinkJson(data); })
      .catch(() => { if (active) setBlinkJson(null); });

    return () => { active = false; };
  }, [sellerId, amount, intentId]);

  const handleCreateIntent = async () => {
    if (!sellerId || !amount) return;
    setStatus('processing');
    setError('');
    setVerifyResult(null);
    try {
      const res = await tapService.createIntent({ sellerId, amount, currency, memo: `Tap payment for ${sellerId}` });
      setIntent((res.data?.data || res.data));
      setStatus('idle');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create payment intent');
      setStatus('error');
    }
  };

  const handleVerifyIntent = async () => {
    if (!intentId || !sellerId || !amount) {
      setError('Create or save an intent before verifying.');
      setStatus('error');
      return;
    }
    setStatus('processing');
    setError('');
    setVerifyResult(null);
    setSignature('');
    try {
      const res = await tapService.getMerchant(sellerId);
      const data = (res.data?.data || res.data) as any;
      setVerifyResult({ ...res.data, ...data });
      setStatus('verified');
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.message || 'Verification request failed');
    }
  };

  const openWalletDeepLink = () => {
    if (!sellerId || !amount) return;
    const link = SOLANA_USDC_LINK(sellerId, amount.toFixed(currency === 'SOL' ? 4 : 2), `Tap payment to ${sellerId}`);
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const isReady = sellerId && amount > 0;

  return (
    <div style={{ background: tokens.color.background, minHeight: '100vh', color: tokens.color.text }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-black text-[var(--warm-ink)] mb-2">Tap Checkout</h1>
        <p className="text-sm text-[var(--soft-stone)] mb-1">
          Merchant:{' '}
          <span className="font-mono text-[var(--sky-wash)] break-all">
            {merchant?.name || sellerId || ':sellerId'}
          </span>
        </p>
        <p className="text-sm text-[var(--soft-stone)] mb-6">
          Seller link:{' '}
          <span className="font-mono text-[var(--sky-wash)] break-all">
            https://tap.pabandi.com/s/{sellerId || ':sellerId'}
          </span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[var(--warm-ink)] rounded-2xl p-5 shadow-sm border border-[white15]">
            <h3 className="text-xs font-bold text-[var(--soft-stone)] uppercase tracking-wide mb-3">Tap QR</h3>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Tap payment QR" className="w-full rounded-xl bg-white" />
            ) : (
              <div className="w-full aspect-square rounded-xl bg-[var(--cream)] border border-[white15] flex items-center justify-center text-xs text-[var(--soft-stone)]">
                Generating QR…
              </div>
            )}
            <p className="text-[10px] text-[var(--soft-stone)] mt-2">Scan to open this checkout link in any wallet.</p>
          </div>

          <div className="bg-[var(--warm-ink)] rounded-2xl p-5 shadow-sm border border-[white15]">
            <h3 className="text-xs font-bold text-[var(--soft-stone)] uppercase tracking-wide mb-3">Solana Action</h3>
            {blinkJson ? (
              <pre className="text-[11px] text-[var(--soft-stone)] font-mono whitespace-pre-wrap break-all">{JSON.stringify(blinkJson, null, 2)}</pre>
            ) : (
              <p className="text-xs text-[var(--soft-stone)]">No Action metadata found for this seller.</p>
            )}
            <a
              href={`/actions/tap-pay/${sellerId || ':sellerId'}?amount=${amount}&currency=${currency}`}
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[var(--sky-wash)] hover:text-sky-300"
            >
              Open Action JSON ↗
            </a>
          </div>
        </div>

        <div className="bg-[var(--warm-ink)] rounded-2xl p-6 shadow-sm border border-[white15] space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[var(--soft-stone)] uppercase tracking-wide mb-2">Payment preview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[var(--cream)] border border-[white15]">
                <p className="text-xs text-[var(--soft-stone)]">Seller</p>
                <p className="text-sm font-bold text-[var(--warm-ink)] break-all">{sellerId || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--cream)] border border-[white15]">
                <p className="text-xs text-[var(--soft-stone)]">Amount</p>
                <p className="text-sm font-bold text-[var(--warm-ink)]">
                  {amount} {currency}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--cream)] border border-[white15]">
                <p className="text-xs text-[var(--soft-stone)]">Intent</p>
                <p className="text-sm font-bold text-[var(--warm-ink)] break-all">{intent?.id || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--cream)] border border-[white15]">
                <p className="text-xs text-[var(--soft-stone)]">Status</p>
                <p className="text-sm font-bold text-[var(--warm-ink)] capitalize">{status || 'idle'}</p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="p-4 rounded-xl bg-[var(--terracotta)]/10 border border-red-500/25 text-[var(--terracotta)] text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={openWalletDeepLink}
              disabled={!isReady}
              className="px-5 py-2.5 bg-[var(--warm-sand)] hover:bg-[var(--warm-sand)] disabled:opacity-50 text-[var(--warm-ink)] rounded-xl text-sm font-semibold transition-colors border border-[rgba(191,179,163,0.3)]"
            >
              Open Wallet
            </button>
            <button
              onClick={handleCreateIntent}
              disabled={!isReady || status === 'processing'}
              className="px-5 py-2.5 bg-[var(--sky-wash)] hover:bg-sky-400 disabled:opacity-50 text-[var(--warm-ink)] rounded-xl text-sm font-semibold transition-colors"
            >
              {status === 'processing' ? 'Working...' : 'Create Intent'}
            </button>
            <button
              onClick={handleVerifyIntent}
              disabled={!isReady || status === 'processing'}
              className="px-5 py-2.5 bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] hover:from-[var(--clay)] hover:to-[var(--dusty-rose)] disabled:opacity-50 text-[var(--warm-ink)] rounded-xl text-sm font-semibold transition-colors"
            >
              {status === 'processing' ? 'Working...' : 'Verify Payment'}
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[var(--soft-stone)]">Status blocks</h4>
            <div className="p-4 rounded-xl border border-[white15] bg-[var(--warm-ink)] text-xs font-mono text-[var(--soft-stone)]">
              <p>query: {new URL(window.location.href).search}</p>
              <p>amount: {amount}</p>
              <p>currency: {currency}</p>
              <p>sellerId: {sellerId}</p>
              <p>status: {status}</p>
            </div>
            {intent ? (
              <div className="p-4 rounded-xl border border-[white15] bg-[var(--warm-ink)]">
                <p className="text-xs font-bold text-[var(--warm-ink)] mb-1">Intent response</p>
                <pre className="text-xs text-[var(--soft-stone)] whitespace-pre-wrap break-all">
                  {JSON.stringify(intent, null, 2)}
                </pre>
              </div>
            ) : null}
            {verifyResult ? (
              <div className="p-4 rounded-xl border border-[white15] bg-[var(--warm-ink)]">
                <p className="text-xs font-bold text-[var(--warm-ink)] mb-1">Verify response</p>
                <pre className="text-xs text-[var(--soft-stone)] whitespace-pre-wrap break-all">
                  {JSON.stringify(verifyResult, null, 2)}
                </pre>
              </div>
            ) : null}
            {signature ? (
              <div className="p-4 rounded-xl border border-[white15] bg-[var(--warm-ink)]">
                <p className="text-xs font-bold text-[var(--warm-ink)] mb-1">Signature</p>
                <p className="text-xs text-[var(--soft-stone)] break-all">{signature}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-[white15] bg-[var(--warm-ink)] text-xs text-[var(--soft-stone)]">
          <p className="font-bold text-[var(--soft-stone)] mb-1">Verification notes</p>
          <p>Complete the payment in your wallet. Pabandi verifies the on-chain intent and confirms checkout for this seller.</p>
        </div>
      </div>
    </div>
  );
}
