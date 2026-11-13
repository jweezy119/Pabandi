import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../services/api';

type Method = 'WALLET' | 'BANK_ESFCA';

interface PayoutStatus {
  payoutMethod: Method | null;
  payoutAccountRef: string | null;
  isPayoutVerified: boolean;
}

export default function VerifyPayoutPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [method, setMethod] = useState<Method>('WALLET');
  const [accountRef, setAccountRef] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.get('/payout-verification/status').then((r) => {
      const s = r.data?.data as PayoutStatus;
      setStatus(s);
      if (s?.payoutMethod) setMethod(s.payoutMethod);
      if (s?.payoutAccountRef) setAccountRef(s.payoutAccountRef);
    }).catch(() => {});
  }, []);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiClient.post('/payout-verification', { payoutMethod: method, accountRef });
      setStatus(r.data.data);
      setMsg({ ok: true, text: r.data.message });
    } catch (e: any) {
      setMsg({ ok: false, text: e.response?.data?.error || 'Could not submit payout details' });
    } finally {
      setBusy(false);
    }
  };

  const returnTo = params.get('return');

  return (
    <div className="max-w-lg mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">Verify your payout method</h1>
      <p className="text-sm text-gray-500">
        You need a verified payout route before accepting gigs. Choose a mobile wallet
        (JazzCash / Easypaisa / Raast) or an Exporters' Special Foreign Currency Account (ESFCA).
      </p>

      {status?.isPayoutVerified ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
          ✅ Payout verified ({status.payoutMethod === 'BANK_ESFCA' ? 'Bank ESFCA' : 'Wallet'}).
          {returnTo && (
            <button className="ml-3 underline" onClick={() => navigate(returnTo)}>Continue</button>
          )}
        </div>
      ) : status?.payoutMethod ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
          ⏳ Submitted — awaiting coordinator verification.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {(['WALLET', 'BANK_ESFCA'] as Method[]).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-lg border p-4 text-left ${method === m ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-gray-200'}`}
          >
            <div className="font-semibold">{m === 'WALLET' ? '📱 Mobile Wallet' : '🏦 Bank ESFCA'}</div>
            <div className="text-xs text-gray-500">
              {m === 'WALLET' ? 'JazzCash, Easypaisa, Raast ID' : 'Foreign-currency export account (IBAN)'}
            </div>
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-sm font-medium">{method === 'WALLET' ? 'Wallet number / Raast ID' : 'ESFCA IBAN'}</span>
        <input
          value={accountRef}
          onChange={(e) => setAccountRef(e.target.value)}
          placeholder={method === 'WALLET' ? '03XXXXXXXXX' : 'PK36SCBL0000001123456702'}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3"
        />
      </label>

      {msg && <p className={msg.ok ? 'text-green-700' : 'text-red-600'}>{msg.text}</p>}

      <button
        disabled={busy || !accountRef}
        onClick={submit}
        className="w-full rounded-lg bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit for verification'}
      </button>
    </div>
  );
}
