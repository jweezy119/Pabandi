import { useState, useEffect } from 'react';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { getAuthToken } from '../../../utils/authToken';

/**
 * The tenancy behind a CRM client.
 *
 * Most CRM clients are not tenants, so the common state is "no tenancy on file"
 * and this offers to create one. When there IS a tenancy it shows the facts the
 * CRM otherwise cannot see — which property, which lease, how much rent is
 * outstanding.
 *
 * Every figure here comes from the endpoint's response. Nothing is computed on the
 * client: a dashboard that derived its own totals would disagree with the
 * property records the first time a rounding rule differed.
 */

const API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1`;

function money(n: number | undefined) {
  return `$${Number(n || 0).toLocaleString()}`;
}

export function ClientPropertyPanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/crm/clients/${clientId}/property`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error('Could not load the tenancy');
      setData((await res.json()).data);
    } catch (e: any) {
      // Shown, not swallowed: a panel stuck on a spinner is indistinguishable
      // from a client with no tenancy, which is a different fact.
      setError(e?.message || 'Could not load the tenancy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const link = async () => {
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(`${API}/crm/clients/${clientId}/property`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Could not create the tenancy');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not create the tenancy');
    } finally {
      setLinking(false);
    }
  };

  if (loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[120px]" />;

  if (error) {
    return (
      <Card padding="lg">
        <p className="text-sm" style={{ color: 'var(--dusty-rose)' }}>{error}</p>
      </Card>
    );
  }

  if (!data?.isTenant) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-sm mb-4" style={{ color: 'var(--soft-stone)' }}>
          This client has no tenancy on file.
        </p>
        <Button variant="secondary" onClick={link} disabled={linking}>
          {linking ? 'Creating…' : 'Create tenancy'}
        </Button>
      </Card>
    );
  }

  const { tenant, leases = [], rent = {}, maintenance = [] } = data;
  const active = leases.find((l: any) => l.status === 'ACTIVE') || leases[0];

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h3 className="text-sm font-bold" style={{ color: 'var(--warm-ink)' }}>Tenancy</h3>
        <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
          {tenant?.property?.title || 'No property assigned'}
          {tenant?.property?.city ? ` — ${tenant.property.city}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl" style={{ background: 'var(--warm-sand)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--soft-stone)' }}>Rent</div>
          <div className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>
            {active ? money(active.rentAmount) : '—'}
          </div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: 'var(--warm-sand)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--soft-stone)' }}>Billed</div>
          <div className="text-lg font-bold" style={{ color: 'var(--sage)' }}>{money(rent.billed)}</div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: 'var(--warm-sand)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--soft-stone)' }}>Collected</div>
          <div className="text-lg font-bold" style={{ color: 'var(--sage)' }}>{money(rent.collected)}</div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: 'var(--warm-sand)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--soft-stone)' }}>Outstanding</div>
          <div
            className="text-lg font-bold"
            style={{ color: rent.outstanding > 0 ? 'var(--dusty-rose)' : 'var(--warm-ink)' }}
          >
            {money(rent.outstanding)}
          </div>
        </div>
      </div>

      {rent.overdueCount > 0 && (
        <p className="text-xs" style={{ color: 'var(--dusty-rose)' }}>
          {rent.overdueCount} overdue payment{rent.overdueCount === 1 ? '' : 's'}
        </p>
      )}

      {active?.endDate && (
        <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
          Lease {active.startDate ? `${new Date(active.startDate).toLocaleDateString()} – ` : ''}
          {new Date(active.endDate).toLocaleDateString()}
        </p>
      )}

      {maintenance.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--soft-stone)' }}>
            Maintenance raised
          </h4>
          <ul className="space-y-1">
            {maintenance.map((m: any) => (
              <li key={m.id} className="text-sm" style={{ color: 'var(--warm-ink)' }}>
                {m.title} <span className="text-xs" style={{ color: 'var(--soft-stone)' }}>· {m.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}