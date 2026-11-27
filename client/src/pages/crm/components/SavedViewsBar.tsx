import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { getAuthToken } from '../../../utils/authToken';

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  isShared: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

/**
 * Saved views for CRM lists. The server stores filters/sorts/columns as JSON —
 * the first step toward Twenty-style views without a metadata engine.
 */
export function SavedViewsBar({
  objectType,
  current,
  onApply,
}: {
  objectType: string;
  current: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [selected, setSelected] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/views?objectType=${encodeURIComponent(objectType)}`, { headers: headers() });
      if (!res.ok) return;
      const body = await res.json();
      setViews(body.data || []);
    } catch {
      // Saved views are a convenience; a failed fetch must not break the list.
    }
  }, [objectType]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/views`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ objectType, name: name.trim(), filters: current }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch {
      window.alert('Could not save this view.');
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm('Delete this saved view?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/views/${selected}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error(String(res.status));
      setSelected('');
      await load();
    } catch {
      window.alert('Could not delete this view.');
    }
  };

  if (views.length === 0) {
    return <Button variant="ghost" icon="add" onClick={save}>Save view</Button>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => {
          const id = e.target.value;
          setSelected(id);
          const view = views.find((v) => v.id === id);
          if (view) onApply(view.filters || {});
        }}
        className="min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-[var(--cream)] px-3 text-sm text-[var(--warm-ink)] touch-target"
        aria-label="Saved views"
      >
        <option value="">Saved views…</option>
        {views.map((v) => <option key={v.id} value={v.id}>{v.name}{v.isShared ? ' (shared)' : ''}</option>)}
      </select>
      <Button variant="ghost" icon="add" onClick={save}>Save</Button>
      {selected && <Button variant="ghost" icon="delete" onClick={remove} aria-label="Delete saved view" />}
    </div>
  );
}
