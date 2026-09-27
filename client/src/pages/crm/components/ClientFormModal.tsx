import { useState } from 'react';
import { Input, Button } from '../../../components/primitives';

export default function ClientFormModal({ client, onClose, onSave, customFields }: any) {
  const [form, setForm] = useState(client || { id: '', name: '', email: '', phone: '', company: '', notes: '', customData: {} });
  
  // Autosave simulation
  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleCustomChange = (field: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      customData: { ...(prev.customData || {}), [field]: value }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Full Name" required value={form.name} onChange={(e: any) => handleChange('name', e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" type="email" value={form.email} onChange={(e: any) => handleChange('email', e.target.value)} />
        <Input label="Phone" type="text" value={form.phone} onChange={(e: any) => handleChange('phone', e.target.value)} />
      </div>
      <Input label="Company (Optional)" type="text" value={form.company} onChange={(e: any) => handleChange('company', e.target.value)} />
      <Input label="Notes" textarea rows={3} value={form.notes} onChange={(e: any) => handleChange('notes', e.target.value)} />
      
      {customFields && customFields.length > 0 && (
        <div className="mt-4 border-t pt-4 border-[rgba(191,179,163,0.3)]">
          <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-3">Custom Fields</h4>
          {customFields.map((cf: any) => (
            <div key={cf.id} className="mb-3">
              <Input 
                label={cf.label} 
                type={cf.type || 'text'} 
                value={(form.customData || {})[cf.id] || ''} 
                onChange={(e: any) => handleCustomChange(cf.id, e.target.value)} 
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-4 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
