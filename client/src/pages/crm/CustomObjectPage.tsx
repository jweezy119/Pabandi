import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Card, InlineEdit } from '../../components/primitives';
import { SavedViewsBar } from './components/SavedViewsBar';
import { getAuthToken } from '../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

interface FieldDef {
  id: string;
  name: string;
  label: string;
  type: string;
  options?: string[] | null;
}
interface ObjectDef {
  id: string;
  name: string;
  pluralName?: string | null;
  icon: string;
  color: string;
  fields: FieldDef[];
}
interface Row {
  id: string;
  data: Record<string, unknown>;
}

/** A generated list/detail surface for an owner-built object. It behaves like
 * the built-in CRM views: table, kanban, search, saved views and inline editing. */
export function CustomObjectPage() {
  const { objectId } = useParams<{ objectId: string }>();
  const reduced = Boolean(useReducedMotion());
  const [object, setObject] = useState<ObjectDef | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!objectId) return;
    setLoading(true);
    try {
      const [o, r] = await Promise.all([
        fetch(`${API_BASE}/api/v1/crm/builder/objects/${objectId}`, { headers: headers() }),
        fetch(`${API_BASE}/api/v1/crm/builder/objects/${objectId}/records`, { headers: headers() }),
      ]);
      if (o.ok) setObject((await o.json()).data || null);
      if (r.ok) setRows((await r.json()).data || []);
    } catch {
      setError('Could not load this object.');
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useEffect(() => { void load(); }, [load]);

  const stageField = useMemo(
    () => object?.fields.find((f) => f.type === 'select') ?? null,
    [object],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !Object.values(row.data || {}).some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
      if (stageField && stageFilter && String(row.data?.[stageField.name] ?? '') !== stageFilter) return false;
      return true;
    });
  }, [rows, search, stageField, stageFilter]);

  const patchRow = async (row: Row, patch: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/api/v1/crm/builder/objects/${objectId}/records/${row.id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ data: patch }),
    });
    if (!res.ok) throw new Error('Could not save that change');
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, data: { ...r.data, ...patch } } : r)));
  };

  const addRow = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/builder/objects/${objectId}/records`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ data: draft }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDraft({});
      await load();
    } catch {
      setError('Could not add this entry. Check the required details.');
    }
  };

  const removeRow = async (id: string) => {
    await fetch(`${API_BASE}/api/v1/crm/builder/objects/${objectId}/records/${id}`, { method: 'DELETE', headers: headers() });
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading && !object) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay"><p className="text-[var(--soft-stone)]">Loading…</p></DashboardLayout>;
  if (!object) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay"><p className="text-[var(--dusty-rose)]">This object could not be found.</p></DashboardLayout>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--soft-stone)]">{object.icon} Your tool</p>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">{object.pluralName || object.name}</h1>
            <p className="text-sm text-[var(--soft-stone)]">{visible.length} of {rows.length} entries</p>
          </div>
          <div className="flex items-center gap-2">
            <SavedViewsBar
              objectType={`custom:${object.id}`}
              current={{ search, stage: stageFilter }}
              onApply={(filters) => { setSearch(String(filters.search ?? '')); setStageFilter(String(filters.stage ?? '')); }}
            />
            <div className="flex rounded-xl border border-[var(--warm-sand)] overflow-hidden">
              {(['table', 'kanban'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`min-h-[44px] px-3 text-sm font-semibold capitalize ${view === v ? 'bg-[var(--clay)] text-[var(--pab-on-accent)]' : 'text-[var(--soft-stone)]'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-[var(--dusty-rose)]">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries…"
            className="min-h-[44px] flex-1 rounded-xl border border-[var(--warm-sand)] bg-white px-3 text-[var(--warm-ink)]"
          />
          {stageField && (
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-white px-3 text-[var(--warm-ink)]"
            >
              <option value="">All {stageField.label.toLowerCase()}s</option>
              {(stageField.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            {view === 'table' ? (
              <div className="overflow-x-auto rounded-2xl border border-[var(--warm-sand)] bg-white">
                <table className="mobile-table w-full text-left text-sm">
                  <thead className="bg-[var(--warm-sand)]/40 text-[var(--soft-stone)]">
                    <tr>
                      {object.fields.map((f) => <th key={f.id} className="p-3 font-semibold">{f.label}</th>)}
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--warm-sand)]/40">
                        {object.fields.map((field) => (
                          <td key={field.id} className="p-3 text-[var(--warm-ink)]">
                            <Cell field={field} value={row.data?.[field.name]} onSave={(value) => patchRow(row, { [field.name]: value })} />
                          </td>
                        ))}
                        <td className="p-3 text-right">
                          <button onClick={() => removeRow(row.id)} className="min-h-[40px] min-w-[40px] text-[var(--dusty-rose)]" aria-label="Delete entry">✕</button>
                        </td>
                      </tr>
                    ))}
                    {visible.length === 0 && (
                      <tr><td colSpan={object.fields.length + 1} className="p-6 text-center text-[var(--soft-stone)]">No entries yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {(stageField?.options || ['All']).map((option) => {
                  const cards = visible.filter((r) => String(r.data?.[stageField?.name ?? ''] ?? '') === option);
                  return (
                    <div
                      key={option}
                      className="min-w-[260px] w-[260px] flex-shrink-0 rounded-2xl bg-[var(--cream)] p-3"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/plain');
                        if (id && stageField) void patchRow({ id, data: {} }, { [stageField.name]: option });
                      }}
                    >
                      <p className="mb-3 text-sm font-bold text-[var(--warm-ink)]">{option} <span className="text-[var(--soft-stone)]">({cards.length})</span></p>
                      <div className="space-y-2">
                        {cards.map((row) => (
                          <motion.div
                            key={row.id}
                            draggable={!reduced}
                            onDragStart={(e: any) => e.dataTransfer.setData('text/plain', row.id)}
                            whileHover={reduced ? undefined : { y: -2 }}
                            className="cursor-grab rounded-xl bg-white p-3 shadow-sm"
                          >
                            <p className="font-semibold text-[var(--warm-ink)]">
                              {String(row.data?.[object.fields[0]?.name] ?? 'Entry')}
                            </p>
                            {object.fields.slice(1, 4).map((f) => (
                              <p key={f.id} className="text-xs text-[var(--soft-stone)]">{f.label}: {String(row.data?.[f.name] ?? '—')}</p>
                            ))}
                          </motion.div>
                        ))}
                        {cards.length === 0 && <p className="text-xs text-[var(--soft-stone)]">Drop here</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <Card className="space-y-3">
          <p className="font-bold text-[var(--warm-ink)]">+ Add an entry</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {object.fields.map((field) => (
              <label key={field.id} className="block text-sm">
                <span className="text-xs font-bold text-[var(--warm-ink)]">{field.label}</span>
                {field.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(draft[field.name])}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.name]: e.target.checked }))}
                    className="ml-2 mt-2 h-5 w-5"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={String(draft[field.name] ?? '')}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.name]: e.target.value }))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-white px-2"
                  >
                    <option value="">Choose…</option>
                    {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : ['number', 'currency'].includes(field.type) ? 'number' : 'text'}
                    value={String(draft[field.name] ?? '')}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.name]: e.target.value }))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-white px-3"
                  />
                )}
              </label>
            ))}
          </div>
          <Button variant="primary" onClick={addRow} disabled={object.fields.length === 0}>Add entry</Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Cell({ field, value, onSave }: { field: FieldDef; value: unknown; onSave: (v: unknown) => Promise<void> }) {
  if (field.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => void onSave(e.target.checked)}
        className="h-5 w-5"
        aria-label={field.label}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => void onSave(e.target.value)}
        className="min-h-[40px] w-full rounded-lg border border-[var(--warm-sand)] bg-white px-2"
        aria-label={field.label}
      >
        <option value="">—</option>
        {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (['number', 'currency'].includes(field.type)) {
    return (
      <InlineEdit
        value={Number(value ?? 0)}
        type="number"
        onSave={(v) => onSave(Number(v))}
        placeholder="0"
      />
    );
  }
  return <InlineEdit value={String(value ?? '')} onSave={(v) => onSave(String(v))} placeholder={`Add ${field.label.toLowerCase()}`} />;
}
