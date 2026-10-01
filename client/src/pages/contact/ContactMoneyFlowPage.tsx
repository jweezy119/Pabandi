import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Card, Stat, ClaySkeletonCard } from '../../components/primitives';
import { getAuthToken } from '../../utils/authToken';

/**
 * Money Flow — the ContactOS tab for the shape of a business's money.
 *
 * Reads from GET /api/v1/reconciliation/money-flow. Every stat links into the
 * invoice list filtered to the matching status, so a number is always one
 * click from the invoices behind it.
 *
 * Palette: warm clay only, via the existing CSS variables and semantic
 * classes. No new colours.
 */

const API_BASE = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1`;

type RailRow = {
  railId: string;
  label: string;
  amount: number;
  invoiceCount: number;
  feeBps: number;
  feeNote: string;
  projectedFees: number;
  measured: boolean;
};

type MoneyFlow = {
  businessId: string;
  currency: string;
  expectedIncoming: { total: number; overdue: number; dueThisWeek: number; dueLater: number };
  receivedThisWeek: { total: number; count: number };
  outstanding: { total: number; count: number; oldestDaysPastDue: number | null };
  byRail: RailRow[];
  unattributed: { amount: number; invoiceCount: number };
  currencyExposure: { currency: string; receivable: number; received: number; net: number; invoiceCount: number }[];
  totalProjectedFees: number;
  links: Record<string, string>;
  generatedAt: string;
};

const money = (n: number, currency: string) =>
  `${currency === 'USD' ? '$' : `${currency} `}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ContactMoneyFlowPage() {
  const navigate = useNavigate();
  const businessId = useAuthStore((s) => (s.user as { businessId?: string } | undefined)?.businessId);
  const [data, setData] = useState<MoneyFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (businessId) params.set('businessId', businessId);
      const res = await fetch(`${API_BASE}/reconciliation/money-flow?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) throw new Error('Could not load money flow');
      const body = await res.json();
      setData(body.data as MoneyFlow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load money flow');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6 clay-fade">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ClaySkeletonCard />
          <ClaySkeletonCard />
          <ClaySkeletonCard />
        </div>
        <ClaySkeletonCard />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="clay-alert clay-alert--critical">
        <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{error ?? 'No money flow data.'}</p>
        <button onClick={load} className="text-sm mt-2 clay-filter-chip--active" style={{ color: 'white', backgroundColor: 'var(--clay)', padding: '4px 12px', borderRadius: '9999px' }}>
          Try again
        </button>
      </div>
    );
  }

  const { expectedIncoming, receivedThisWeek, outstanding, currency } = data;
  const isMultiCurrency = data.currencyExposure.length > 1;

  return (
    <div className="space-y-6 clay-fade">
      <div className="flex items-center justify-between clay-heading">
        <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Money Flow</h2>
        <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Headline stats. Each links into the filtered invoice list. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          icon="account_balance_wallet"
          label="Expected Incoming"
          value={money(expectedIncoming.total, currency)}
          color="clay"
          delay={0}
          onClick={() => navigate(data.links.expectedIncoming)}
        />
        <Stat
          icon="check_circle"
          label="Received This Week"
          value={money(receivedThisWeek.total, currency)}
          color="sage"
          delay={80}
          onClick={() => navigate(data.links.receivedThisWeek)}
        />
        <Stat
          icon="hourglass_top"
          label="Outstanding"
          value={money(outstanding.total, currency)}
          color="ochre"
          delay={160}
          onClick={() => navigate(data.links.outstanding)}
        />
      </div>

      {/* When money is expected. */}
      <Card>
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Expected Incoming</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate(data.links.overdue)}
            className="text-left p-3 rounded-xl clay-card--interactive"
            style={{ background: 'var(--cream)' }}
          >
            <p className="font-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--soft-stone)' }}>
              Overdue
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: expectedIncoming.overdue > 0 ? 'var(--terracotta)' : 'var(--warm-ink)', fontVariantNumeric: 'tabular-nums' }}>
              {money(expectedIncoming.overdue, currency)}
            </p>
            {outstanding.oldestDaysPastDue !== null && outstanding.oldestDaysPastDue > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--soft-stone)' }}>
                Oldest is {outstanding.oldestDaysPastDue} day{outstanding.oldestDaysPastDue === 1 ? '' : 's'} past due
              </p>
            )}
          </button>

          <div className="p-3 rounded-xl" style={{ background: 'var(--cream)' }}>
            <p className="font-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--soft-stone)' }}>
              Due This Week
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--warm-ink)', fontVariantNumeric: 'tabular-nums' }}>
              {money(expectedIncoming.dueThisWeek, currency)}
            </p>
          </div>

          <div className="p-3 rounded-xl" style={{ background: 'var(--cream)' }}>
            <p className="font-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--soft-stone)' }}>
              Due Later
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--warm-ink)', fontVariantNumeric: 'tabular-nums' }}>
              {money(expectedIncoming.dueLater, currency)}
            </p>
          </div>
        </div>
      </Card>

      {/* Per-rail volume and projected fees. */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: 'var(--warm-ink)' }}>By Rail</h3>
          <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
            Projected fees {money(data.totalProjectedFees, currency)}
          </p>
        </div>

        {data.byRail.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
            No rail-attributable invoices yet. Rail volume appears once payments are reconciled.
          </p>
        ) : (
          <div className="space-y-3">
            {data.byRail.map((rail) => {
              const share = expectedIncoming.total > 0 ? rail.amount / expectedIncoming.total : 0;
              return (
                <div key={rail.railId}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>
                      {rail.label}
                      <span className="ml-2 text-xs font-normal" style={{ color: 'var(--soft-stone)' }}>
                        {rail.invoiceCount} invoice{rail.invoiceCount === 1 ? '' : 's'}
                        {!rail.measured && ' · projected'}
                      </span>
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--warm-ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {money(rail.amount, currency)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--warm-sand)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, Math.round(share * 100))}%`,
                        background: rail.railId === 'solana' ? 'var(--sage)' : 'var(--clay)',
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                    {rail.feeNote} · projected fees {money(rail.projectedFees, currency)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {data.unattributed.invoiceCount > 0 && (
          <div className="clay-alert clay-alert--warning mt-4">
            <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>
              {money(data.unattributed.amount, currency)} across {data.unattributed.invoiceCount} invoice
              {data.unattributed.invoiceCount === 1 ? '' : 's'} could not be attributed to a rail. We report these
              separately rather than guessing, so the rail figures above stay trustworthy.
            </p>
          </div>
        )}
      </Card>

      {/* Currency exposure. Hidden for single-currency businesses, where it
          would just restate the totals. */}
      {isMultiCurrency && (
        <Card>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Currency Exposure</h3>
          <div className="space-y-2">
            {data.currencyExposure.map((row) => (
              <div key={row.currency} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--cream)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>{row.currency}</p>
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                    {money(row.receivable, row.currency)} receivable · {money(row.received, row.currency)} received
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: row.net >= 0 ? 'var(--sage)' : 'var(--terracotta)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.net >= 0 ? '+' : ''}{money(row.net, row.currency)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>net</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
