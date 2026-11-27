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
  actions: Array<{ type: string; value?: string; title?: string; message?: string }>;
  enabled: boolean;
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
        body: JSON.stringify({ name: name.trim(), triggerObject: objectType, triggerEvent: event, conditions: [], actions: [action] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setName('');
      setActionValue('');
      await load();
    } catch {
      setError('Could not create the rule.');
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
          <Button variant="primary" onClick={create} disabled={!name.trim() || !actionValue.trim()}>Create rule</Button>
        </Card>

        <div className="space-y-2">
          {rules.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No automations yet.</p>}
          {rules.map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-[var(--warm-ink)]">{r.name}</p>
                <p className="text-xs text-[var(--soft-stone)]">{r.triggerObject}.{r.triggerEvent} → {r.actions[0]?.type}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>Delete</Button>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
