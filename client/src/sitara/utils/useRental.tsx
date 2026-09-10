// Sitara OS — shared rental-vertical state.
// One call (GET /property-manager/dashboard) powers Units, Tenants, Leases,
// Maintenance. 404 = not enrolled yet → pages show a one-tap enroll gate.
import { useCallback, useEffect, useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';

export function useRental() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await sitaraApi.rentalDashboard();
      setData(d);
      setEnrolled(true);
    } catch (e: any) {
      if (e?.response?.status === 404) setEnrolled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = async (companyName: string) => {
    setEnrolling(true);
    try {
      await sitaraApi.rentalEnroll(companyName);
      await load();
    } finally {
      setEnrolling(false);
    }
  };

  return { data, loading, enrolled, enrolling, enroll, refresh: load };
}

export function RentalGate({ onEnroll, enrolling }: { onEnroll: (name: string) => void; enrolling: boolean }) {
  const [name, setName] = useState('');
  return (
    <div className="max-w-xl mx-auto py-12 text-center">
      <p className="text-5xl mb-4">🏢</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Start managing rentals</h1>
      <p className="text-slate-600 mb-6 text-sm">
        One-tap setup creates your property portfolio — units, tenants, leases, and maintenance, all live.
      </p>
      <div className="flex gap-2 max-w-sm mx-auto">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company or portfolio name"
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
        />
        <button
          onClick={() => void onEnroll(name || 'My Properties')}
          disabled={enrolling}
          className="px-5 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 shrink-0"
        >
          {enrolling ? '…' : 'Set up'}
        </button>
      </div>
    </div>
  );
}
