import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  businessOsService,
  type ModuleCatalogueDto,
  type ModuleStatus,
  type PulseDto,
} from '../../services/api';
import {
  moduleById,
  sortedModules,
  terminologyFor,
  type ModuleId,
} from '../../config/businessModules';
import { tokens } from '../../design-system';

/**
 * BusinessWorkspaceShell
 *
 * The unified surface over the platform's layers. Instead of one CRM page that
 * grows a new tab every time a layer is added, the shell is driven by the module
 * registry: nav is generated from what the server says is installed, and a layer
 * the business switches on appears without a frontend change.
 *
 * Two states are kept deliberately distinct, because conflating them is how a
 * dashboard ends up lying:
 *
 *   • a module that is **not installed** → "Install" affordance
 *   • a module that is installed but **has no data** → "nothing here yet"
 *   • a module that **errored** → the totals are marked partial
 *
 * Collapsing any of these into "0" is what the old per-page `api()` wrappers
 * did, and it is why the previous dashboard was indistinguishable from a business
 * with no activity at all.
 */

const RANGE_OPTIONS = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '365d', label: '1y' },
];

export default function BusinessWorkspaceShell() {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [pulse, setPulse] = useState<PulseDto | null>(null);
  const [catalogue, setCatalogue] = useState<ModuleCatalogueDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyModule, setBusyModule] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Sequential rather than parallel: the module catalogue decides which
      // modules the pulse will report, and reading them together invites a race
      // where a freshly installed module is missing from the pulse.
      const mods = await businessOsService.modules();
      setCatalogue(mods.data);
      const p = await businessOsService.pulse({ range });
      setPulse(p.data);
    } catch (err: any) {
      // Read both `message` and `error`: the platform's canonical error shape is
      // `{ success, message }`, but some legacy routes still write `error`.
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const installed = useMemo(() => {
    const set = new Set<string>((catalogue?.modules ?? []).filter((m) => m.installed).map((m) => m.id));
    return set;
  }, [catalogue]);

  const available = useMemo(
    () => sortedModules().filter((m) => installed.has(m.id)),
    [installed]
  );

  const terms = terminologyFor(undefined);

  const toggle = async (key: string, install: boolean) => {
    setBusyModule(key);
    try {
      if (install) await businessOsService.installModule(key);
      else await businessOsService.uninstallModule(key);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusyModule(null);
    }
  };

  if (loading && !pulse) {
    return (
      <Centered>
        <Spinner />
        <Muted>Reading across modules…</Muted>
      </Centered>
    );
  }

  if (error && !pulse) {
    return (
      <Centered>
        <Text tone="danger" size="lg">
          {error}
        </Text>
        <Muted>
          A business must be enrolled before cross-layer reporting is available.
        </Muted>
        <Btn onClick={() => navigate('/crm')}>Go to CRM</Btn>
      </Centered>
    );
  }

  if (!pulse) return null;

  return (
    <Shell>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Header>
        <div>
          <Eyebrow>Business OS</Eyebrow>
          <Title>Unified pulse</Title>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </Header>

      {error && (
        <Banner tone="warning">
          Last refresh failed: {error} — figures below may be stale.
        </Banner>
      )}

      {/* ── Merged totals ──────────────────────────────────────────────── */}
      <TotalsGrid>
        <Metric
          label="Revenue"
          value={pulse.totals.revenue}
          currency={pulse.totals.currency}
          partial={pulse.totals.partial}
        />
        <Metric
          label="Cost"
          value={pulse.totals.cost}
          currency={pulse.totals.currency}
          partial={pulse.totals.partial}
        />
        <Metric
          label="Margin"
          value={pulse.totals.margin}
          currency={pulse.totals.currency}
          tone={pulse.totals.margin >= 0 ? 'success' : 'danger'}
          partial={pulse.totals.partial}
        />
        <Metric
          label="Outstanding"
          value={pulse.totals.outstanding}
          currency={pulse.totals.currency}
          partial={pulse.totals.partial}
        />
      </TotalsGrid>

      {pulse.totals.partial && (
        <Banner tone="warning">
          At least one module failed to respond. Totals above exclude it — treat
          them as a floor, not a total.
        </Banner>
      )}

      {/* ── Money that moved but is not revenue ────────────────────────── */}
      <Row>
        <FlowChip
          label="Capital raised"
          value={pulse.flows.capitalRaised}
          note="not revenue"
        />
        <FlowChip
          label="Settled payments"
          value={pulse.flows.settledPayments}
          note="already counted as revenue"
        />
      </Row>

      {/* ── Trust posture ──────────────────────────────────────────────── */}
      <Section title="Trust">
        {pulse.trust.available ? (
          <TrustPanel trust={pulse.trust} />
        ) : (
          <Muted>No trust passport issued for this owner yet.</Muted>
        )}
      </Section>

      {/* ── Modules ────────────────────────────────────────────────────── */}
      <Section
        title="Layers"
        action={
          <Muted>
            {available.length} of {sortedModules().length} active
          </Muted>
        }
      >
        <ModuleGrid>
          {sortedModules().map((descriptor) => {
            const report = pulse.modules.find((m) => m.id === descriptor.id);
            const isInstalled = installed.has(descriptor.id);
            return (
              <ModuleCard
                key={descriptor.id}
                id={descriptor.id}
                status={report?.status ?? (isInstalled ? 'ok' : 'unavailable')}
                reason={report?.reason}
                facts={report?.facts}
                busy={busyModule === descriptor.id}
                onOpen={() => navigate(descriptor.route)}
                onToggle={() => toggle(descriptor.key, !isInstalled)}
              />
            );
          })}
        </ModuleGrid>
      </Section>

      {/* ── Merged timeline ────────────────────────────────────────────── */}
      <Section title="Activity" action={<Muted>{pulse.timeline.length} events</Muted>}>
        {pulse.timeline.length === 0 ? (
          <Muted>Nothing recorded in this period.</Muted>
        ) : (
          <Timeline entries={pulse.timeline} />
        )}
      </Section>

      <Muted>
        {terms.customers} · {terms.engagements} · {terms.team}
      </Muted>
    </Shell>
  );
}

// ── Module card ───────────────────────────────────────────────────────────────

function ModuleCard({
  id,
  status,
  reason,
  facts,
  busy,
  onOpen,
  onToggle,
}: {
  id: ModuleId;
  status: ModuleStatus;
  reason?: string;
  facts?: PulseDto['modules'][number]['facts'];
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const descriptor = moduleById(id);
  if (!descriptor) return null;

  const accent = tokens.color[descriptor.accent] || tokens.color.textMuted;
  // Only the handful of counters worth surfacing on a tile. Everything else is
  // one click away, and showing 14 counters per card makes the grid unreadable.
  const highlights = facts
    ? Object.entries(facts.counts)
        .filter(([, v]) => v !== null && v !== 0)
        .slice(0, 4)
    : [];

  return (
    <Card accent={accent}>
      <CardHead>
        <Glyph accent={accent}>{descriptor.glyph}</Glyph>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CardTitle>{descriptor.label}</CardTitle>
          <StatusPill status={status} />
        </div>
      </CardHead>

      <Muted size="sm">{descriptor.blurb}</Muted>

      {status === 'ok' && highlights.length > 0 && (
        <Counters>
          {highlights.map(([k, v]) => (
            <Counter key={k} label={humanise(k)} value={v as number} />
          ))}
        </Counters>
      )}

      {status !== 'ok' && (
        <Reason tone={status === 'error' ? 'danger' : 'textMuted'}>
          {reason ?? status}
        </Reason>
      )}

      <CardActions>
        {status === 'ok' ? (
          <Btn variant="ghost" onClick={onOpen}>
            Open
          </Btn>
        ) : status === 'unavailable' ? (
          <Btn onClick={onToggle} disabled={busy}>
            {busy ? 'Installing…' : 'Install'}
          </Btn>
        ) : (
          <Btn variant="ghost" onClick={onToggle} disabled={busy}>
            Remove
          </Btn>
        )}
      </CardActions>
    </Card>
  );
}

// ── Trust panel ───────────────────────────────────────────────────────────────

function TrustPanel({ trust }: { trust: PulseDto['trust'] }) {
  return (
    <div>
      <Row style={{ marginBottom: tokens.space.md }}>
        <TrustStat label="Level" value={trust.level ?? '—'} />
        <TrustStat label="Overall" value={trust.overall ?? '—'} />
        <TrustStat label="Verified" value={trust.verified ? 'Yes' : 'No'} />
        {trust.fraudFlag && <TrustStat label="Fraud flag" value="Raised" tone="danger" />}
      </Row>

      {trust.scoped && (
        <>
          <Muted size="sm">
            Scoped scores are 0–1000 with 500 neutral. Always read them against
            the sample size — 900 from 2 transactions is not 900 from 400.
          </Muted>
          <ScopedList>
            {trust.scoped.map((s) => {
              const n = s.sampleSize ?? 0;
              // A score with no history is neutral, not bad. Rendering it as a
              // red bar would punish a new passport for being new.
              const tone =
                n === 0
                  ? tokens.color.textDim
                  : (s.score ?? 500) >= 650
                  ? tokens.color.success
                  : (s.score ?? 500) >= 450
                  ? tokens.color.warning
                  : tokens.color.danger;
              return (
                <ScopedRow key={s.dimension}>
                  <ScopedLabel>{s.dimension}</ScopedLabel>
                  <ScopedTrack>
                    <ScopedFill
                      tone={tone}
                      width={`${Math.max(0, Math.min(100, ((s.score ?? 500) / 1000) * 100))}%`}
                    />
                  </ScopedTrack>
                  <ScopedValue>
                    {s.score ?? '—'} <Muted size="sm">n={n}</Muted>
                  </ScopedValue>
                </ScopedRow>
              );
            })}
          </ScopedList>
        </>
      )}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ entries }: { entries: PulseDto['timeline'] }) {
  const byModule = new Map<string, number>();
  for (const e of entries) byModule.set(e.moduleId, (byModule.get(e.moduleId) ?? 0) + 1);

  return (
    <div>
      <Row style={{ marginBottom: tokens.space.sm }}>
        {[...byModule.entries()].map(([m, n]) => (
          <Muted key={m} size="sm">
            {m} · {n}
          </Muted>
        ))}
      </Row>
      <List>
        {entries.map((e, i) => (
          <ListItem key={`${e.moduleId}-${e.at}-${i}`}>
            <Dot />
            <div style={{ flex: 1, minWidth: 0 }}>
              <RowGap>
                <Tag>{e.moduleId}</Tag>
                <Muted size="sm">{formatWhen(e.at)}</Muted>
              </RowGap>
              <Text size="sm">{e.summary}</Text>
              {e.impact && (e.impact.amount || e.impact.trustDelta) && (
                <RowGap style={{ marginTop: 2 }}>
                  {e.impact.amount != null && (
                    <Text size="sm" tone="textMuted">
                      {e.impact.amount} {e.impact.currency}
                    </Text>
                  )}
                  {e.impact.trustDelta != null && (
                    <Text
                      size="sm"
                      tone={e.impact.trustDelta >= 0 ? 'success' : 'danger'}
                    >
                      trust {e.impact.trustDelta >= 0 ? '+' : ''}
                      {e.impact.trustDelta}
                    </Text>
                  )}
                </RowGap>
              )}
            </div>
          </ListItem>
        ))}
      </List>
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function RangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <RowGap>
      {RANGE_OPTIONS.map((o) => (
        <Chip key={o.value} active={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </RowGap>
  );
}

function Metric({
  label,
  value,
  currency,
  tone,
  partial,
}: {
  label: string;
  value: number;
  currency: string;
  tone?: 'success' | 'danger';
  partial?: boolean;
}) {
  return (
    <MetricCard>
      <Muted size="sm">{label}</Muted>
      <Text size="xl" tone={tone}>
        {formatMoney(value, currency)}
      </Text>
      {partial && <Muted size="sm">partial</Muted>}
    </MetricCard>
  );
}

function FlowChip({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Flow>
      <Muted size="sm">{label}</Muted>
      <Text>{formatMoney(value, 'USD')}</Text>
      <Muted size="sm">{note}</Muted>
    </Flow>
  );
}

function TrustStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <TrustBox>
      <Muted size="sm">{label}</Muted>
      <Text size="lg" tone={tone as any}>
        {value}
      </Text>
    </TrustBox>
  );
}

function StatusPill({ status }: { status: ModuleStatus }) {
  const tone =
    status === 'ok'
      ? tokens.color.success
      : status === 'error'
      ? tokens.color.danger
      : status === 'empty'
      ? tokens.color.textDim
      : tokens.color.textMuted;
  const label =
    status === 'ok' ? 'active' : status === 'empty' ? 'no data' : status === 'error' ? 'error' : 'not installed';
  return (
    <Pill tone={tone}>
      <DotSmall tone={tone} />
      {label}
    </Pill>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <CounterBox>
      <Text size="lg">{value}</Text>
      <Muted size="sm">{label}</Muted>
    </CounterBox>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: tokens.space.xl }}>
      <SectionHead>
        <Text size="lg">{title}</Text>
        {action}
      </SectionHead>
      {children}
    </section>
  );
}

function Banner({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  const color = tone === 'warning' ? tokens.color.warning : tokens.color.danger;
  return (
    <div
      style={{
        marginTop: tokens.space.md,
        padding: tokens.space.sm + 2,
        borderLeft: `3px solid ${color}`,
        background: `${color}14`,
        borderRadius: tokens.radius.sm,
      }}
    >
      <Text size="sm" tone={tone}>
        {children}
      </Text>
    </div>
  );
}

function Dot() {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: tokens.color.border,
        marginTop: 8,
        flexShrink: 0,
      }}
    />
  );
}

function DotSmall({ tone }: { tone: string }) {
  return (
    <span
      style={{ width: 6, height: 6, borderRadius: 999, background: tone, display: 'inline-block' }}
    />
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        border: `2px solid ${tokens.color.border}`,
        borderTopColor: tokens.color.primary,
        borderRadius: 999,
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

function humanise(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatMoney(value: number, currency: string) {
  const symbol = currency === 'USDC' ? '$' : currency === 'PKR' ? '₨' : '$';
  try {
    return `${symbol}${value.toLocaleString(undefined, {
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    })}`;
  } catch {
    return `${symbol}${value}`;
  }
}

// ── Primitives ────────────────────────────────────────────────────────────────

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      maxWidth: 1080,
      margin: '0 auto',
      padding: tokens.space.xl,
      color: tokens.color.text,
      fontFamily: tokens.font.body,
    }}
  >
    {children}
  </div>
);

const Header = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.space.md,
      flexWrap: 'wrap',
      marginBottom: tokens.space.lg,
    }}
  >
    {children}
  </div>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 11,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: tokens.color.textDim,
    }}
  >
    {children}
  </div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{children}</h1>
);

const SectionHead = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: tokens.space.sm,
    }}
  >
    {children}
  </div>
);

const Text = ({
  children,
  size = 'md',
  tone,
}: {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'success' | 'danger' | 'textMuted' | 'warning';
}) => {
  const map: Record<string, number> = { sm: 12, md: 14, lg: 17, xl: 22 };
  const colors: Record<string, string> = {
    success: tokens.color.success,
    danger: tokens.color.danger,
    warning: tokens.color.warning,
    textMuted: tokens.color.textMuted,
  };
  return (
    <span
      style={{
        fontSize: map[size],
        color: tone ? colors[tone] : tokens.color.text,
        lineHeight: 1.45,
      }}
    >
      {children}
    </span>
  );
};

const Muted = ({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' }) => (
  <span
    style={{
      fontSize: size === 'sm' ? 12 : 14,
      color: tokens.color.textMuted,
      lineHeight: 1.5,
      display: 'block',
    }}
  >
    {children}
  </span>
);

const Reason = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'danger' | 'textMuted';
}) => (
  <div style={{ marginTop: tokens.space.sm }}>
    <Text size="sm" tone={tone}>
      {children}
    </Text>
  </div>
);

const Row = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ display: 'flex', gap: tokens.space.md, flexWrap: 'wrap', ...style }}>
    {children}
  </div>
);

const RowGap = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: tokens.space.sm,
      flexWrap: 'wrap',
      ...style,
    }}
  >
    {children}
  </div>
);

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.space.md,
      color: tokens.color.text,
      fontFamily: tokens.font.body,
    }}
  >
    {children}
  </div>
);

const TotalsGrid = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: tokens.space.md,
    }}
  >
    {children}
  </div>
);

const ModuleGrid = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: tokens.space.md,
    }}
  >
    {children}
  </div>
);

const cardStyle: React.CSSProperties = {
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.lg,
  padding: tokens.space.lg,
};

const MetricCard = ({ children }: { children: React.ReactNode }) => (
  <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 4 }}>
    {children}
  </div>
);

const Card = ({ children, accent }: { children: React.ReactNode; accent: string }) => (
  <div style={{ ...cardStyle, borderTop: `2px solid ${accent}`, display: 'flex', flexDirection: 'column', gap: tokens.space.sm }}>
    {children}
  </div>
);

const CardHead = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space.sm }}>{children}</div>
);

const Glyph = ({ children, accent }: { children: React.ReactNode; accent: string }) => (
  <span
    style={{
      width: 32,
      height: 32,
      display: 'grid',
      placeItems: 'center',
      borderRadius: tokens.radius.md,
      background: `${accent}1f`,
      color: accent,
      fontSize: 16,
      flexShrink: 0,
    }}
  >
    {children}
  </span>
);

const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 15, fontWeight: 600 }}>{children}</div>
);

const CardActions = ({ children }: { children: React.ReactNode }) => (
  <div style={{ marginTop: 'auto', paddingTop: tokens.space.sm }}>{children}</div>
);

const Counters = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))',
      gap: tokens.space.sm,
      marginTop: tokens.space.sm,
    }}
  >
    {children}
  </div>
);

const CounterBox = ({ children }: { children: React.ReactNode }) => (
  <div>
    {children}
  </div>
);

const Flow = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      ...cardStyle,
      padding: tokens.space.md,
      flex: '1 1 180px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    {children}
  </div>
);

const TrustBox = ({ children }: { children: React.ReactNode }) => (
  <div style={{ flex: '1 1 100px' }}>{children}</div>
);

const ScopedList = ({ children }: { children: React.ReactNode }) => (
  <div style={{ marginTop: tokens.space.md, display: 'flex', flexDirection: 'column', gap: 6 }}>
    {children}
  </div>
);

const ScopedRow = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space.sm }}>
    {children}
  </div>
);

const ScopedLabel = ({ children }: { children: React.ReactNode }) => (
  <span style={{ width: 68, fontSize: 12, color: tokens.color.textMuted, textTransform: 'capitalize' }}>
    {children}
  </span>
);

const ScopedTrack = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      flex: 1,
      height: 6,
      background: tokens.color.surfaceContainer,
      borderRadius: 999,
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

const ScopedFill = ({ tone, width }: { tone: string; width: string }) => (
  <div style={{ height: '100%', width, background: tone, borderRadius: 999 }} />
);

const ScopedValue = ({ children }: { children: React.ReactNode }) => (
  <span style={{ width: 92, textAlign: 'right', fontSize: 12, color: tokens.color.text }}>
    {children}
  </span>
);

const List = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      border: `1px solid ${tokens.color.border}`,
      borderRadius: tokens.radius.lg,
      padding: tokens.space.md,
      maxHeight: 460,
      overflowY: 'auto',
    }}
  >
    {children}
  </div>
);

const ListItem = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      gap: tokens.space.sm,
      padding: '6px 0',
      borderBottom: `1px solid ${tokens.color.borderSubtle}`,
    }}
  >
    {children}
  </div>
);

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      fontSize: 10,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: tokens.color.textDim,
      border: `1px solid ${tokens.color.border}`,
      borderRadius: tokens.radius.sm,
      padding: '1px 5px',
    }}
  >
    {children}
  </span>
);

const Pill = ({ children, tone }: { children: React.ReactNode; tone: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
    <span style={{ fontSize: 11, color: tone }}>{children}</span>
  </div>
);

const Chip = ({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      fontSize: 12,
      padding: '4px 10px',
      borderRadius: tokens.radius.full,
      border: `1px solid ${active ? tokens.color.primary : tokens.color.border}`,
      background: active ? `${tokens.color.primary}1f` : 'transparent',
      color: active ? tokens.color.primary : tokens.color.textMuted,
      cursor: onClick ? 'pointer' : 'default',
    }}
  >
    {children}
  </button>
);

const Btn = ({
  children,
  onClick,
  variant = 'default',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'ghost';
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      fontSize: 13,
      padding: '6px 12px',
      borderRadius: tokens.radius.sm,
      border:
        variant === 'ghost' ? `1px solid ${tokens.color.border}` : `1px solid ${tokens.color.primary}`,
      background: variant === 'ghost' ? 'transparent' : `${tokens.color.primary}22`,
      color: variant === 'ghost' ? tokens.color.textMuted : tokens.color.primary,
      cursor: disabled ? 'wait' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }}
  >
    {children}
  </button>
);
