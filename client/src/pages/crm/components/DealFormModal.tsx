import { useState } from 'react';
import { Input, Button } from '../../../components/primitives';

export default function DealFormModal({ deal, clients, onClose, onSave, customFields }: any) {
  const [form, setForm] = useState(deal || {
    title: '', value: '', stage: 'LEAD', clientId: '', probability: '10', expectedCloseDate: '', notes: '', customData: {}
  });

  const handleChange = (field: string, value: any) => setForm((p: any) => ({ ...p, [field]: value }));
  const handleCustomChange = (field: string, value: any) => setForm((p: any) => ({
    ...p, customData: { ...(p.customData || {}), [field]: value }
  }));

  const STAGES = [
    { id: 'LEAD', label: 'Lead' },
    { id: 'QUALIFIED', label: 'Qualified' },
    { id: 'PROPOSAL', label: 'Proposal' },
    { id: 'NEGOTIATION', label: 'Negotiation' },
    { id: 'WON', label: 'Closed Won' },
    { id: 'LOST', label: 'Closed Lost' }
  ];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <Input label="Deal Title" value={form.title} onChange={(e: any) => handleChange('title', e.target.value)} required />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Value ($)" type="number" value={form.value} onChange={(e: any) => handleChange('value', e.target.value)} required />
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--warm-ink)]">Stage</label>
          <select value={form.stage} onChange={(e: any) => handleChange('stage', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--warm-sand)]">
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-[var(--warm-ink)]">Client</label>
        <select value={form.clientId} onChange={(e: any) => handleChange('clientId', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--warm-sand)]" required>
          <option value="">-- Select Client --</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Win Probability (%)" type="number" min="0" max="100" value={form.probability} onChange={(e: any) => handleChange('probability', e.target.value)} />
        <Input label="Expected Close Date" type="date" value={form.expectedCloseDate} onChange={(e: any) => handleChange('expectedCloseDate', e.target.value)} />
      </div>
      <Input label="Notes" textarea rows={3} value={form.notes} onChange={(e: any) => handleChange('notes', e.target.value)} />

      {customFields && customFields.length > 0 && (
        <div className="mt-4 border-t pt-4 border-[rgba(191,179,163,0.3)]">
          <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-3">Custom Fields</h4>
          {customFields.map((cf: any) => (
            <div key={cf.id} className="mb-3">
              <Input label={cf.label} type={cf.type || 'text'} value={(form.customData || {})[cf.id] || ''} onChange={(e: any) => handleCustomChange(cf.id, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">Save Deal</Button>
      </div>
    </form>
  );
}
