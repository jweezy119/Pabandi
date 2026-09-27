import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/primitives/Modal';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';

export function ActivityFormModal({ isOpen, onClose, onSubmit, clients, deals, initialType = 'NOTE' }: any) {
  const [formData, setFormData] = useState({
    type: initialType,
    title: '',
    description: '',
    clientId: '',
    dealId: '',
    authorName: 'Owner',
  });

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ ...prev, type: initialType, title: '', description: '', clientId: '', dealId: '' }));
    }
  }, [isOpen, initialType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--warm-ink)]">Activity Type</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'NOTE', label: 'Note', icon: 'edit_note' },
              { id: 'CALL', label: 'Call', icon: 'call' },
              { id: 'EMAIL', label: 'Email', icon: 'mail' },
              { id: 'MEETING', label: 'Meeting', icon: 'groups' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFormData({ ...formData, type: t.id })}
                className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-medium border transition-all ${
                  formData.type === t.id
                    ? 'border-[var(--clay)] bg-[var(--clay)]/10 text-[var(--clay)] font-bold'
                    : 'border-[var(--warm-sand)] bg-white text-[var(--soft-stone)]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] mb-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Title"
          placeholder="e.g. Discovery call"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--warm-ink)]">Related Client</label>
          <select
            value={formData.clientId}
            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)]"
          >
            <option value="">-- None --</option>
            {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--warm-ink)]">Related Deal</label>
          <select
            value={formData.dealId}
            onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)]"
          >
            <option value="">-- None --</option>
            {deals?.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--warm-ink)]">Details</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)]"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" variant="primary">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
