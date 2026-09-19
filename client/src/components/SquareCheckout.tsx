import { useState, useEffect, useCallback } from 'react';

interface SquareCheckoutProps {
  referenceId: string;
  amount: number;       // in dollars
  currency?: string;
  customerEmail?: string;
  note?: string;
  redirectUrl: string;
  cancelUrl: string;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
}

type PaymentStatus = 'idle' | 'creating' | 'pending' | 'confirming' | 'success' | 'error';

export default function SquareCheckout({
  referenceId,
  amount,
  currency = 'USD',
  customerEmail,
  note,
  redirectUrl,
  cancelUrl,
  onSuccess,
  onError,
}: SquareCheckoutProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createCheckout = useCallback(async () => {
    setStatus('creating');
    setError(null);
    try {
      const res = await fetch('/api/v1/square-checkout/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceId,
          amount,
          currency,
          customerEmail,
          note,
          redirectUrl,
          cancelUrl,
        }),
      });
      const json = await res.json();
      if (json.success && json.checkout?.url) {
        setPaymentId(json.checkout.id);
        setStatus('pending');
        // Redirect to Square hosted checkout
        window.location.href = json.checkout.url;
      } else {
        setError(json.error || 'Failed to create checkout');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setStatus('error');
    }
  }, [referenceId, amount, currency, customerEmail, note, redirectUrl, cancelUrl]);

  // Poll payment status after redirect returns
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentParam = urlParams.get('payment');
    const returnedPaymentId = urlParams.get('paymentId');

    if (paymentParam === 'success' && returnedPaymentId) {
      setPaymentId(returnedPaymentId);
      setStatus('confirming');
    }
  }, []);

  useEffect(() => {
    if (status !== 'confirming' || !paymentId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s max

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (!cancelled) {
          setError('Payment confirmation timed out');
          setStatus('error');
          onError?.('timeout');
        }
        return;
      }

      try {
        const res = await fetch(`/api/v1/square-checkout/payment/${paymentId}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          const state = json.payment?.status;
          if (state === 'COMPLETED') {
            setStatus('success');
            onSuccess?.(paymentId);
            return;
          }
        }
      } catch {
        // ignore poll errors, retry
      }

      if (!cancelled) {
        setTimeout(poll, 2000);
      }
    };

    setTimeout(poll, 2000);

    return () => { cancelled = true; };
  }, [status, paymentId, onSuccess, onError]);

  if (status === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="text-3xl mb-2">✓</div>
        <p className="text-sm font-medium text-green-900">Payment Confirmed!</p>
        <p className="text-xs text-green-700 mt-1">Your deposit is held in escrow until check-in.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm font-medium text-red-900 mb-2">Payment Failed</p>
        <p className="text-xs text-red-700">{error}</p>
        <button
          onClick={() => { setStatus('idle'); setError(null); }}
          className="mt-3 px-3 py-1.5 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (status === 'confirming') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm font-medium text-blue-900">Confirming Payment...</p>
        <p className="text-xs text-blue-700 mt-1">Please wait while we verify your payment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={createCheckout}
        disabled={status === 'creating'}
        className="w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <span className="text-lg">💳</span>
        {status === 'creating' ? 'Redirecting...' : `Pay with Card (Square) — $${amount.toFixed(2)}`}
      </button>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>🔒</span>
        <span>Secured by Square. Pabandi never sees your card details.</span>
      </div>
    </div>
  );
}
