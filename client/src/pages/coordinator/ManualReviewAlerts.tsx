import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/api';

interface Receipt {
  id: string;
  transactionRef: string;
  amount: number;
  currency: string;
  receiverId: string;
  bank: string | null;
  confidence: number;
  imageBase64: string | null;
  screenshotUrl: string | null;
  intentId: string | null;
  createdAt: string;
}

interface PendingPayout {
  id: string;
  firstName: string;
  lastName: string;
  payoutMethod: 'WALLET' | 'BANK_ESFCA';
  payoutAccountRef: string;
}

/**
 * Coordinator safety-net alerts: low-confidence (<85%) receipts and unverified
 * payout routes. Renders nothing for users without coordinator/admin access.
 */
export default function ManualReviewAlerts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [allowed, setAllowed] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        apiClient.get('/payments/manual-review-queue'),
        apiClient.get('/payout-verification/pending'),
      ]);
      setReceipts(r.data?.data?.queue || []);
      setPayouts(p.data?.data || []);
    } catch (e: any) {
      if (e.response?.status === 403) setAllowed(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (!allowed) return null;
  const total = receipts.length + payouts.length;

  const approveReceipt = async (id: string) => {
    await apiClient.post('/payments/manual-approve', { receiptId: id, notes: 'Approved from Coordinator Dashboard' });
    setPreview(null);
    load();
  };
  const approvePayout = async (id: string) => {
    await apiClient.post(`/payout-verification/${id}/approve`);
    load();
  };

  const imgSrc = (r: Receipt) =>
    r.screenshotUrl || (r.imageBase64 && !r.imageBase64.startsWith('test:') ? `data:image/jpeg;base64,${r.imageBase64}` : null);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-amber-500 text-white shadow-lg px-4 py-3 font-semibold"
        aria-label="Manual review alerts"
      >
        🧾 Review {total > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 text-xs">{total}</span>}
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-96 max-h-[70vh] overflow-y-auto rounded-xl bg-white shadow-2xl border p-4 space-y-4 text-sm">
          <section>
            <h3 className="font-bold mb-2">Receipts below 85% confidence ({receipts.length})</h3>
            {receipts.length === 0 && <p className="text-gray-500">Nothing to review.</p>}
            {receipts.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 mb-2">
                <div className="flex justify-between">
                  <span>{r.currency} {r.amount.toLocaleString()}</span>
                  <span className="text-amber-600">{Math.round(r.confidence * 100)}%</span>
                </div>
                <div className="text-xs text-gray-500">To {r.receiverId} · Ref {r.transactionRef}</div>
                <div className="flex gap-2 mt-2">
                  <button className="underline" onClick={() => setPreview(r)}>View screenshot</button>
                  <button className="ml-auto rounded bg-emerald-600 text-white px-3 py-1" onClick={() => approveReceipt(r.id)}>Approve</button>
                </div>
              </div>
            ))}
          </section>
          <section>
            <h3 className="font-bold mb-2">Payout routes awaiting verification ({payouts.length})</h3>
            {payouts.length === 0 && <p className="text-gray-500">Nothing to verify.</p>}
            {payouts.map((u) => (
              <div key={u.id} className="border rounded-lg p-3 mb-2 flex items-center">
                <div>
                  <div>{u.firstName} {u.lastName}</div>
                  <div className="text-xs text-gray-500">{u.payoutMethod === 'BANK_ESFCA' ? 'ESFCA' : 'Wallet'} · {u.payoutAccountRef}</div>
                </div>
                <button className="ml-auto rounded bg-emerald-600 text-white px-3 py-1" onClick={() => approvePayout(u.id)}>Verify</button>
              </div>
            ))}
          </section>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {imgSrc(preview) ? (
              <img src={imgSrc(preview)!} alt="Payment receipt" className="w-full rounded" />
            ) : (
              <p className="text-gray-500">No image stored for this receipt.</p>
            )}
            <div className="flex gap-2 mt-3">
              <button className="flex-1 border rounded py-2" onClick={() => setPreview(null)}>Close</button>
              <button className="flex-1 rounded bg-emerald-600 text-white py-2" onClick={() => approveReceipt(preview.id)}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

