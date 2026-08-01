import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { tokens } from '../design-system';
import api from '../services/api';

export default function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      (async () => {
        try {
          const response = await api.get(`/checkout/session/${sessionId}`);
          if (!cancelled && response.data?.success) {
            const s = response.data.data?.status;
            if (s) setStatus(s);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
        <p className="text-white/70">Checking checkout status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#121212] p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <XCircleIcon className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="font-headline text-2xl font-bold text-white">Checkout cancelled</h1>
        <p className="mt-2 text-sm text-zinc-400">This payment was not completed. You can return to the merchant to try again.</p>
        {status && <p className="mt-2 text-xs text-zinc-500">Session status: {status}</p>}
        <Link to="/" className="mt-6 inline-block rounded-xl bg-zinc-900 px-5 py-3 font-bold text-white hover:bg-zinc-800">Back to Home</Link>
      </div>
    </div>
  );
}
