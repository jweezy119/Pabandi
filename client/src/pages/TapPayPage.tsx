import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { tapService } from '../services/api';
import QRCodeLib from 'qrcode';

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

  useEffect(() => {
    if (!sellerId || !amount || amount <= 0) {
      setError('Missing required payment parameters in the URL.');
      setStatus('error');
    }
  }, [sellerId, amount]);

  useEffect(() => {
    const currentUrl = window.location.href;
    let active = true;
    QRCodeLib.toDataURL(currentUrl, { width: 512, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
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

  const simulatePhantomPay = async () => {
    if (!intentId || !sellerId || !amount) {
      setError('Create an intent before paying.');
      setStatus('error');
      return;
    }
    setStatus('processing');
    setError('');
    setVerifyResult(null);
    const fakeSignature = `simulated_${intentId}_${Date.now()}`;
    setSignature(fakeSignature);
    try {
      const res = await tapService.verifyPayment({ signature: fakeSignature, sellerId, expectedAmount: amount, mint: undefined });
      setVerifyResult(res.data);
      setStatus(res.data?.success ? 'verified' : 'error');
      if (!res.data?.success) {
        setError(res.data?.message || 'Verification failed');
      }
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
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-black text-[#e8e8e8] mb-2">Tap Checkout</h1>
        <p className="text-sm text-[#757575] mb-1">
          Merchant:{' '}
          <span className="font-mono text-[#0ea5e9] break-all">
            {sellerId || ':sellerId'}
          </span>
        </p>
        <p className="text-sm text-[#757575] mb-6">
          Seller link:{' '}
          <span className="font-mono text-[#0ea5e9] break-all">
            https://tap.pabandi.com/s/{sellerId || ':sellerId'}
          </span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#181818] rounded-2xl p-5 shadow-sm border border-[#ffffff15]">
            <h3 className="text-xs font-bold text-[#9e9e9e] uppercase tracking-wide mb-3">Tap QR</h3>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Tap payment QR" className="w-full rounded-xl bg-white" />
            ) : (
              <div className="w-full aspect-square rounded-xl bg-[#252525] border border-[#ffffff15] flex items-center justify-center text-xs text-[#757575]">
                Generating QR…
              </div>
            )}
            <p className="text-[10px] text-[#757575] mt-2">Scan to open this checkout link in any wallet.</p>
          </div>

          <div className="bg-[#181818] rounded-2xl p-5 shadow-sm border border-[#ffffff15]">
            <h3 className="text-xs font-bold text-[#9e9e9e] uppercase tracking-wide mb-3">Solana Action</h3>
            {blinkJson ? (
              <pre className="text-[11px] text-[#9e9e9e] font-mono whitespace-pre-wrap break-all">{JSON.stringify(blinkJson, null, 2)}</pre>
            ) : (
              <p className="text-xs text-[#757575]">No Action metadata found for this seller.</p>
            )}
            <a
              href={`/actions/tap-pay/${sellerId || ':sellerId'}?amount=${amount}&currency=${currency}`}
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#0ea5e9] hover:text-sky-300"
            >
              Open Action JSON ↗
            </a>
          </div>
        </div>

        <div className="bg-[#181818] rounded-2xl p-6 shadow-sm border border-[#ffffff15] space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[#9e9e9e] uppercase tracking-wide mb-2">Payment preview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#252525] border border-[#ffffff15]">
                <p className="text-xs text-[#757575]">Seller</p>
                <p className="text-sm font-bold text-[#e8e8e8] break-all">{sellerId || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#252525] border border-[#ffffff15]">
                <p className="text-xs text-[#757575]">Amount</p>
                <p className="text-sm font-bold text-[#e8e8e8]">
                  {amount} {currency}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#252525] border border-[#ffffff15]">
                <p className="text-xs text-[#757575]">Intent</p>
                <p className="text-sm font-bold text-[#e8e8e8] break-all">{intent?.id || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#252525] border border-[#ffffff15]">
                <p className="text-xs text-[#757575]">Status</p>
                <p className="text-sm font-bold text-[#e8e8e8] capitalize">{status || 'idle'}</p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCreateIntent}
              disabled={!isReady || status === 'processing'}
              className="px-5 py-2.5 bg-[#0ea5e9] hover:bg-sky-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {status === 'processing' ? 'Working...' : 'Create Intent'}
            </button>
            <button
              onClick={simulatePhantomPay}
              disabled={!isReady || status === 'processing'}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Pay with Phantom
            </button>
            <button
              onClick={openWalletDeepLink}
              disabled={!isReady}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors border border-white/20"
            >
              Open Wallet
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[#9e9e9e]">Status blocks</h4>
            <div className="p-4 rounded-xl border border-[#ffffff15] bg-[#1a1a1a] text-xs font-mono text-[#9e9e9e]">
              <p>query: {new URL(window.location.href).search}</p>
              <p>amount: {amount}</p>
              <p>currency: {currency}</p>
              <p>sellerId: {sellerId}</p>
              <p>status: {status}</p>
            </div>
            {intent ? (
              <div className="p-4 rounded-xl border border-[#ffffff15] bg-[#1a1a1a]">
                <p className="text-xs font-bold text-[#e8e8e8] mb-1">Intent response</p>
                <pre className="text-xs text-[#9e9e9e] whitespace-pre-wrap break-all">
                  {JSON.stringify(intent, null, 2)}
                </pre>
              </div>
            ) : null}
            {verifyResult ? (
              <div className="p-4 rounded-xl border border-[#ffffff15] bg-[#1a1a1a]">
                <p className="text-xs font-bold text-[#e8e8e8] mb-1">Verify response</p>
                <pre className="text-xs text-[#9e9e9e] whitespace-pre-wrap break-all">
                  {JSON.stringify(verifyResult, null, 2)}
                </pre>
              </div>
            ) : null}
            {signature ? (
              <div className="p-4 rounded-xl border border-[#ffffff15] bg-[#1a1a1a]">
                <p className="text-xs font-bold text-[#e8e8e8] mb-1">Signature</p>
                <p className="text-xs text-[#9e9e9e] break-all">{signature}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-[#ffffff15] bg-[#141414] text-xs text-[#757575]">
          <p className="font-bold text-[#9e9e9e] mb-1">Demo flow notes</p>
          <p>This is a merchant Tap checkout preview. Create an intent, then simulate a Phantom-funded payment. No blockchain funds are used in this demo.</p>
        </div>
      </div>
    </div>
  );
}
