import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/primitives/Modal';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';

export function TaskFormModal({ isOpen, onClose, onSubmit, clients, deals, initialData = null }: any) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM',
    clientId: '',
    dealId: '',
    authorName: 'Owner',
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title || '',
          description: initialData.description || '',
          dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
          priority: initialData.priority || 'MEDIUM',
          clientId: initialData.clientId || '',
          dealId: initialData.dealId || '',
          authorName: initialData.authorName || 'Owner',
        });
      } else {
        setFormData({ title: '', description: '', dueDate: '', priority: 'MEDIUM', clientId: '', dealId: '', authorName: 'Owner' });
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Task" : "Create Task"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Task Title"
          placeholder="e.g. Send follow-up email"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Due Date"
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--warm-ink)]">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)]"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

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
          <label className="text-xs font-semibold text-[var(--warm-ink)]">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)]"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" variant="primary">{initialData ? "Save Changes" : "Create Task"}</Button>
        </div>
      </form>
    </Modal>
  );
}
