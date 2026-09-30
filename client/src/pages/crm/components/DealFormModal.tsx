import { useState } from 'react';
import { Input, Button } from '../../../components/primitives';
import ClaySelect from './ClaySelect';

interface DealFormModalProps {
  deal?: {
    id: string;
    title: string;
    value: string;
    stage: string;
    clientId: string;
    probability: string;
    expectedCloseDate: string;
    notes: string;
    customData: Record<string, unknown>;
  } | null;
  clients: { id: string; name: string; email?: string }[];
  onClose: () => void;
  onSave: (form: Record<string, unknown>) => void;
  customFields?: { id: string; label: string; type: string }[];
}

const STAGES = [
  { value: 'LEAD', label: 'Lead', icon: '🌱' },
  { value: 'QUALIFIED', label: 'Qualified', icon: '🔍' },
  { value: 'PROPOSAL', label: 'Proposal', icon: '📋' },
  { value: 'NEGOTIATION', label: 'Negotiation', icon: '🤝' },
  { value: 'WON', label: 'Closed Won', icon: '🎉' },
  { value: 'LOST', label: 'Closed Lost', icon: '❌' },
];

export default function DealFormModal({ deal, clients, onClose, onSave, customFields }: DealFormModalProps) {
  const [form, setForm] = useState(deal || {
    title: '', value: '', stage: 'LEAD', clientId: '', probability: '10', expectedCloseDate: '', notes: '', customData: {}
  });

  const handleChange = (field: string, value: unknown) => setForm((p: Record<string, unknown>) => ({ ...p, [field]: value }));
  const handleCustomChange = (field: string, value: unknown) => setForm((p: Record<string, unknown>) => ({
    ...p, customData: { ...(p.customData as Record<string, unknown> || {}), [field]: value }
  }));

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <Input label="Deal Title" value={form.title as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('title', e.target.value)} required />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Value ($)" type="number" value={form.value as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('value', e.target.value)} required />
        <ClaySelect
          label="Stage"
          value={form.stage as string}
          onChange={(v) => handleChange('stage', v)}
          options={STAGES}
        />
      </div>
      <ClaySelect
        label="Client"
        value={form.clientId as string}
        onChange={(v) => handleChange('clientId', v)}
        options={clientOptions}
        placeholder="Select client..."
        searchable
        clearable
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Win Probability (%)" type="number" min="0" max="100" value={form.probability as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('probability', e.target.value)} />
        <Input label="Expected Close Date" type="date" value={form.expectedCloseDate as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('expectedCloseDate', e.target.value)} />
      </div>
      <Input label="Notes" textarea rows={3} value={form.notes as string} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('notes', e.target.value)} />

      {customFields && customFields.length > 0 && (
        <div className="mt-4 border-t pt-4 border-[rgba(191,179,163,0.3)]">
          <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-3">Custom Fields</h4>
          {customFields.map((cf) => (
            <div key={cf.id} className="mb-3">
              <Input label={cf.label} type={cf.type || 'text'} value={(form.customData as Record<string, unknown>)?.[cf.id] as string || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomChange(cf.id, e.target.value)} />
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
