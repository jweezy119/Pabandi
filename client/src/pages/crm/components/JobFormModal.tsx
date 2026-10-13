import { useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';
import { Modal } from '../../../components/primitives/Modal';

type JobFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: JobFormData) => void;
  clients: { id: string; name: string }[];
};

export type JobFormData = {
  clientId: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  price: number;
  recurrence: 'ONETIME' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
};

export function JobFormModal({ isOpen, onClose, onSubmit, clients }: JobFormModalProps) {
  const [formData, setFormData] = useState<JobFormData>({
    clientId: '',
    serviceType: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    durationMinutes: 60,
    price: 0,
    recurrence: 'ONETIME',
  });

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Job">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm text-gray-400 mb-1">Client</label>
          {/* Was `bg-black/40 border-white/10 text-white` — a dark control sitting on a
              clay form, which is why this screen never looked like the rest of
              Contact OS. */}
          <select
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)] text-[var(--warm-ink)]"
            value={formData.clientId}
            onChange={e => setFormData({ ...formData, clientId: e.target.value })}
            aria-label="Client"
          >
            <option value="">Choose a client</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Service Type</label>
          <Input 
            value={formData.serviceType}
            onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
            placeholder="e.g. Deep Cleaning"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Date</label>
            <Input 
              type="date"
              value={formData.scheduledDate}
              onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Time</label>
            <Input 
              type="time"
              value={formData.scheduledTime}
              onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Duration (mins)</label>
            <Input 
              type="number"
              value={formData.durationMinutes}
              onChange={e => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
            <Input 
              type="number"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-gray-400 mb-1">Recurrence</label>
          <select
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)] text-[var(--warm-ink)]"
            value={formData.recurrence}
            onChange={e => setFormData({ ...formData, recurrence: e.target.value as JobFormData['recurrence'] })}
            aria-label="Recurrence"
          >
            <option value="ONETIME">One-time</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Every two weeks</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          {/*
            Recurrence is sent to the server and stored nowhere — CrmJob has no such
            column, and the other jobs form spells the same choice `one_time`. So
            the answer is accepted and discarded. Shown rather than removed because
            the server route for it is a separate piece of work; hiding it now would
            make the gap invisible rather than gone.
          */}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(formData)}>Create Job</Button>
        </div>
      </div>
    </Modal>
  );
}
