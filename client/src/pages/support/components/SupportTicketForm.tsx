import { useState } from 'react';
import { ClayModal } from '../../../components/clay/ClayModal';
import { ClayButton } from '../../../components/clay/ClayButton';
import usePabandiApi from '../../../hooks/usePabandiApi';

export function SupportTicketForm({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const api = usePabandiApi();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Low');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/support', { subject, category, description, priority });
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClayModal title="Open a Ticket" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
          <input 
            type="text" required value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-white"
            placeholder="Brief summary of the issue"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            <select 
              value={category} onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-white"
            >
              <option>General</option>
              <option>Technical Issue</option>
              <option>Billing</option>
              <option>Trust & Escrow</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
            <select 
              value={priority} onChange={e => setPriority(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-white"
            >
              <option>Low</option>
              <option>Normal</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea 
            required rows={4} value={description} onChange={e => setDescription(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-white"
            placeholder="Please describe your issue in detail..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <ClayButton variant="secondary" onClick={onClose} type="button">Cancel</ClayButton>
          <ClayButton variant="primary" type="submit" disabled={loading}>Submit Ticket</ClayButton>
        </div>
      </form>
    </ClayModal>
  );
}
