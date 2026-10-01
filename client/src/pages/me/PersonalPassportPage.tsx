import { useEffect, useState } from 'react';
import { getAuthToken } from '../../utils/authToken';

export default function PersonalPassportPage() {
  const [passport, setPassport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPassport = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/trust-passport/me`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPassport(data.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPassport();
  }, []);

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--warm-ink)]">My Trust Passport</h1>
      
      {!passport ? (
        <div className="p-8 text-center rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <p className="text-[var(--soft-stone)]">No passport yet. It will be created automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
            <div className="text-xs text-[var(--soft-stone)] mb-1">Score</div>
            <div className="text-3xl font-bold text-[var(--clay)]">{passport.score || '—'}</div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
            <div className="text-xs text-[var(--soft-stone)] mb-1">Level</div>
            <div className="text-3xl font-bold text-[var(--sage)]">{passport.level || '—'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
