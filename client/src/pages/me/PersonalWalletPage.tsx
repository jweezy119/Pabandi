import { useEffect, useState } from 'react';

export default function PersonalWalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/wallet/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          setWallet(await res.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchWallet();
  }, []);

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--warm-ink)]">My Wallet</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">USDC Balance</div>
          <div className="text-2xl font-bold text-[var(--sage)]">${wallet?.data?.usdcBalance || 0}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">PAB Balance</div>
          <div className="text-2xl font-bold text-[var(--clay)]">{wallet?.data?.pabBalance || 0}</div>
        </div>
      </div>
      {wallet?.data?.address && (
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">Deposit Address</div>
          <div className="text-sm font-mono text-[var(--warm-ink)] break-all">{wallet.data.address}</div>
        </div>
      )}
    </div>
  );
}
