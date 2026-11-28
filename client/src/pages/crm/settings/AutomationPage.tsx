import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Button, Card, Input } from '../../../components/primitives';
import { getAuthToken } from '../../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

interface Rule {
  id: string;
  name: string;
  triggerObject: string;
  triggerEvent: string;
  conditions?: Array<{ field: string; operator: string; value: string }>;
  actions: Array<{ type: string; value?: string; title?: string; message?: string }>;
  enabled: boolean;
}

interface Run {
  id: string;
  status: string;
  event: string;
  error?: string | null;
  createdAt: string;
}

/** Rule builder: trigger → conditions → actions. Deliberately small, but it
 * covers the 80% case (status change → set status / create task / notify). */
export function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState('');
  const [objectType, setObjectType] = useState('client');
  const [event, setEvent] = useState('status_changed');
  const [actionType, setActionType] = useState('notify');
  const [actionValue, setActionValue] = useState('');
  const [conditions, setConditions] = useState<Array<{ field: string; operator: string; value: string }>>([]);
  const [runs, setRuns] = useState<Record<string, Run[]>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/automations`, { headers: headers() });
      if (res.ok) setRules((await res.json()).data || []);
    } catch {
      setError('Could not load automations.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim() || !actionValue.trim()) return;
    setError(null);
    const action = actionType === 'createTask'
      ? { type: 'createTask', title: actionValue.trim() }
      : actionType === 'setStatus'
        ? { type: 'setStatus', value: actionValue.trim() }
        : { type: 'notify', message: actionValue.trim() };
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/automations`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          name: name.trim(),
          triggerObject: objectType,
          triggerEvent: event,
          conditions: conditions.filter((c) => c.field.trim() && String(c.value).trim()),
          actions: [action],
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setName('');
      setActionValue('');
      setConditions([]);
      await load();
    } catch {
      setError('Could not create the rule.');
    }
  };

  const loadRuns = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/v1/crm/automations/${id}/runs`, { headers: headers() });
    if (res.ok) {
      const body = await res.json();
      setRuns((prev) => ({ ...prev, [id]: body.data || [] }));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this automation?')) return;
    const res = await fetch(`${API_BASE}/api/v1/crm/automations/${id}`, { method: 'DELETE', headers: headers() });
    if (res.ok) await load();
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Automations</h1>
          <p className="text-sm text-[var(--soft-stone)]">When a CRM record changes, run an action and notify your team.</p>
        </div>
        {error && <p className="text-sm text-[var(--dusty-rose)]">{error}</p>}

        <Card className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <Input label="Rule name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Escalate at-risk clients" />
          <div>
            <label className="text-xs font-semibold text-[var(--warm-ink)]">When</label>
            <select value={`${objectType}.${event}`} onChange={(e) => {
              const [o, ev] = e.target.value.split('.');
              setObjectType(o);
              setEvent(ev);
            }} className="w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-white px-3 text-sm text-[var(--warm-ink)]">
              <option value="client.status_changed">Client status changed</option>
              <option value="client.created">Client created</option>
              <option value="deal.status_changed">Deal stage changed</option>
              <option value="deal.created">Deal created</option>
              <option value="task.status_changed">Task status changed</option>
              <option value="task.created">Task created</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--warm-ink)]">Then</label>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-white px-3 text-sm text-[var(--warm-ink)]">
              <option value="notify">Notify owner</option>
              <option value="createTask">Create follow-up task</option>
              <option value="setStatus">Set status / stage</option>
            </select>
          </div>
          <Input label={actionType === 'setStatus' ? 'New status' : actionType === 'createTask' ? 'Task title' : 'Message'} value={actionValue} onChange={(e: any) => setActionValue(e.target.value)} />

          <div className="sm:col-span-2 rounded-xl border border-[var(--warm-sand)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Only when (optional)</p>
              <Button variant="ghost" size="sm" onClick={() => setConditions((c) => [...c, { field: '', operator: 'equals', value: '' }])}>+ Condition</Button>
            </div>
            {conditions.map((condition, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input
                  value={condition.field}
                  onChange={(e) => setConditions((c) => c.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                  placeholder="Field name (e.g. stage)"
                  className="min-h-[44px] flex-1 rounded-lg border border-[var(--warm-sand)] bg-white px-2 text-sm"
                  aria-label="Condition field"
                />
                <select
                  value={condition.operator}
                  onChange={(e) => setConditions((c) => c.map((x, j) => j === i ? { ...x, operator: e.target.value } : x))}
                  className="min-h-[44px] rounded-lg border border-[var(--warm-sand)] bg-white px-2 text-sm"
                  aria-label="Condition operator"
                >
                  <option value="equals">is</option>
                  <option value="not_equals">is not</option>
                  <option value="contains">contains</option>
                </select>
                <input
                  value={condition.value}
                  onChange={(e) => setConditions((c) => c.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder="Value"
                  className="min-h-[44px] flex-1 rounded-lg border border-[var(--warm-sand)] bg-white px-2 text-sm"
                  aria-label="Condition value"
                />
                <button
                  type="button"
                  onClick={() => setConditions((c) => c.filter((_, j) => j !== i))}
                  className="min-h-[44px] min-w-[44px] text-[var(--dusty-rose)]"
                  aria-label="Remove condition"
                >✕</button>
              </div>
            ))}
          </div>

          <Button variant="primary" onClick={create} disabled={!name.trim() || !actionValue.trim()}>Create rule</Button>
        </Card>

        <div className="space-y-2">
          {rules.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No automations yet.</p>}
          {rules.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--warm-ink)]">{r.name}</p>
                  <p className="text-xs text-[var(--soft-stone)]">
                    {r.triggerObject}.{r.triggerEvent} → {r.actions[0]?.type}
                    {r.conditions?.length ? ` · ${r.conditions.length} condition(s)` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => loadRuns(r.id)}>History</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>Delete</Button>
                </div>
              </div>
              {runs[r.id] && (
                <div className="mt-3 space-y-1 border-t border-[var(--warm-sand)] pt-3">
                  {runs[r.id].length === 0 && <p className="text-xs text-[var(--soft-stone)]">No runs yet.</p>}
                  {runs[r.id].map((run) => (
                    <p key={run.id} className="text-xs text-[var(--soft-stone)]">
                      <span className={run.status === 'SUCCESS' ? 'text-[var(--sage)]' : 'text-[var(--dusty-rose)]'}>{run.status}</span>
                      {' · '}{run.event} · {new Date(run.createdAt).toLocaleString()}
                      {run.error ? ` · ${run.error}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
