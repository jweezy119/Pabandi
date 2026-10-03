import { useState } from 'react';
import { Input, Button } from '../../../components/primitives';
import ClaySelect from './ClaySelect';
import CustomFieldsRenderer from './CustomFieldsRenderer';

interface ClientFormModalProps {
  /**
   * A save failure, shown in the form.
   *
   * The form used to close on a failed write and print the reason to the console,
   * so a customer pressing Save on a 403 saw the dialog close and nothing happen.
   */
  error?: string | null;
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

export default function ClientFormModal({ client, onClose, onSave, customFields, error }: ClientFormModalProps) {
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

      {/* Placed immediately above the actions, so a failed save is read before the
          button the customer just pressed — not on another screen, and not in the
          console. */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ background: 'var(--danger-container, #FCE8E6)', color: 'var(--on-danger-container, #8C1D18)' }}
        >
          <span className="material-symbols-outlined text-[18px] shrink-0 mt-px">error</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3 pt-4 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
