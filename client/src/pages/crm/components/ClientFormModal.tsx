import { useState } from 'react';
import { Input, Button } from '../../../components/primitives';
import ClaySelect from './ClaySelect';
import CustomFieldsRenderer from './CustomFieldsRenderer';

interface ClientFormModalProps {
  client?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
    status: string;
    customData: Record<string, unknown>;
  } | null;
  onClose: () => void;
  onSave: (form: Record<string, unknown>) => void;
  customFields?: { id: string; name: string; type: string; required?: boolean; options?: string[] }[];
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', icon: '✅' },
  { value: 'AT_RISK', label: 'At Risk', icon: '⚠️' },
  { value: 'VIP', label: 'VIP', icon: '⭐' },
  { value: 'INACTIVE', label: 'Inactive', icon: '💤' },
];

export default function ClientFormModal({ client, onClose, onSave, customFields }: ClientFormModalProps) {
  const [form, setForm] = useState(client || {
    id: '', name: '', email: '', phone: '', company: '', notes: '', status: 'ACTIVE', customData: {}
  });

  const handleChange = (field: string, value: unknown) => setForm((p: Record<string, unknown>) => ({ ...p, [field]: value }));
  const handleCustomChange = (fieldId: string, value: unknown) => setForm((p: Record<string, unknown>) => ({
    ...p, customData: { ...(p.customData as Record<string, unknown> || {}), [fieldId]: value }
  }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <Input label="Full Name" required value={form.name as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" type="email" value={form.email as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('email', e.target.value)} />
        <Input label="Phone" type="text" value={form.phone as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('phone', e.target.value)} />
      </div>
      <Input label="Company (Optional)" type="text" value={form.company as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('company', e.target.value)} />
      <ClaySelect
        label="Status"
        value={form.status as string}
        onChange={(v) => handleChange('status', v)}
        options={STATUS_OPTIONS}
      />
      <Input label="Notes" textarea rows={3} value={form.notes as string} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('notes', e.target.value)} />

      {customFields && customFields.length > 0 && (
        <div className="mt-4 border-t pt-4 border-[rgba(191,179,163,0.3)]">
          <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-3">Custom Fields</h4>
          <CustomFieldsRenderer
            fields={customFields}
            values={form.customData as Record<string, unknown>}
            onChange={handleCustomChange}
          />
        </div>
      )}

      <div className="flex gap-3 pt-4 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
