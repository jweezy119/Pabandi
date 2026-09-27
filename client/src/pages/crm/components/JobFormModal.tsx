import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/primitives/Card';
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
        <div>
          <label className="block text-sm text-gray-400 mb-1">Client</label>
          <select 
            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
            value={formData.clientId}
            onChange={e => setFormData({ ...formData, clientId: e.target.value })}
          >
            <option value="">Select a client...</option>
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

        <div>
          <label className="block text-sm text-gray-400 mb-1">Recurrence</label>
          <select 
            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
            value={formData.recurrence}
            onChange={e => setFormData({ ...formData, recurrence: e.target.value as JobFormData['recurrence'] })}
          >
            <option value="ONETIME">One-time</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Bi-weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(formData)}>Create Job</Button>
        </div>
      </div>
    </Modal>
  );
}
