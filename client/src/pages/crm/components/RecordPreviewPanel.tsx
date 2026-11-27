import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClayDrawer } from '../../../components/primitives/ClayDrawer';
import { getAuthToken } from '../../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';

interface Preview {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  status?: string | null;
  stage?: string | null;
  reliabilityScore?: number | null;
  totalJobs?: number | null;
  totalSpent?: number | null;
  customData?: Record<string, unknown> | null;
}

/** Fast read-only side panel for a record, opened from a list row without
 * losing the current filters/scroll position. Twenty uses this pattern heavily. */
export function ClientPreviewPanel({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const [client, setClient] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/v1/crm/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled) setClient(body?.data ?? body ?? null); })
      .catch(() => { if (!cancelled) setClient(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  const custom = client?.customData && typeof client.customData === 'object' ? client.customData : {};

  return (
    <ClayDrawer isOpen={Boolean(clientId)} onClose={onClose} title="Client preview" width="420px">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading && <p className="text-sm text-[var(--soft-stone)]">Loading…</p>}
        {!loading && !client && <p className="text-sm text-[var(--dusty-rose)]">Could not load this client.</p>}
        {client && (
          <>
            <div>
              <h3 className="text-xl font-bold text-[var(--warm-ink)]">{client.name}</h3>
              <p className="text-sm text-[var(--soft-stone)]">{client.company || 'No company on file'}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Email" value={client.email} />
              <Row label="Phone" value={client.phone} />
              <Row label="Address" value={client.address} />
              <Row label="Status" value={client.status} />
              <Row label="Stage" value={client.stage} />
              <Row label="Trust score" value={client.reliabilityScore != null ? `${client.reliabilityScore}%` : null} />
              <Row label="Jobs" value={client.totalJobs != null ? String(client.totalJobs) : null} />
              <Row label="Lifetime value" value={client.totalSpent != null ? `$${Number(client.totalSpent).toLocaleString()}` : null} />
              {Object.entries(custom).map(([key, value]) => (
                <Row key={key} label={key.replace(/([A-Z])/g, ' $1')} value={String(value ?? '')} />
              ))}
            </dl>
            <Link
              to={`/contact/clients/${client.id}`}
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--clay)] px-4 text-sm font-semibold text-[var(--pab-on-accent)] touch-target"
            >
              Open full record
            </Link>
          </>
        )}
      </div>
    </ClayDrawer>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--warm-sand)]/40 pb-2">
      <dt className="text-[var(--soft-stone)] capitalize">{label}</dt>
      <dd className="text-right text-[var(--warm-ink)] break-words">{value || '—'}</dd>
    </div>
  );
}
