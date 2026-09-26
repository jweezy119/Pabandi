import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Card } from '../../components/primitives/Card';
import { Button } from '../../components/primitives/Button';
import { Chip } from '../../components/primitives/Chip';
import { Input } from '../../components/primitives/Input';
import { Modal } from '../../components/primitives/Modal';
import { EmptyState } from '../../components/primitives/EmptyState';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

const TYPES = [
  { id: 'ALL', label: 'All Activities', icon: 'list' },
  { id: 'CALL', label: 'Calls', icon: 'call' },
  { id: 'EMAIL', label: 'Emails', icon: 'mail' },
  { id: 'MEETING', label: 'Meetings', icon: 'groups' },
  { id: 'NOTE', label: 'Notes', icon: 'edit_note' },
  { id: 'TASK', label: 'Tasks', icon: 'check_box' },
];

export default function ContactActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('ALL');
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Log Activity Form
  const [formData, setFormData] = useState({
    type: 'NOTE',
    title: '',
    description: '',
    clientId: '',
    dueDate: '',
    authorName: 'Owner',
  });

  useEffect(() => {
    fetchActivitiesAndClients();
  }, []);

  async function fetchActivitiesAndClients() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const [actRes, clientRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/crm/activities`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/clients`, { headers }),
      ]);

      if (actRes.ok) {
        const aData = await actRes.json();
        setActivities(aData.data || []);
      }
      if (clientRes.ok) {
        const cData = await clientRes.json();
        setClients(cData.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const res = await fetch(`${baseUrl}/api/v1/crm/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: formData.type,
          title: formData.title,
          description: formData.description,
          clientId: formData.clientId || undefined,
          dueDate: formData.dueDate || undefined,
          authorName: formData.authorName,
        }),
      });

      if (res.ok) {
        setIsLogOpen(false);
        setFormData({ type: 'NOTE', title: '', description: '', clientId: '', dueDate: '', authorName: 'Owner' });
        fetchActivitiesAndClients();
      }
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }

  async function toggleTaskCompleted(activityId: string, currentCompleted: boolean) {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const res = await fetch(`${baseUrl}/api/v1/crm/activities/${activityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: !currentCompleted }),
      });

      if (res.ok) {
        fetchActivitiesAndClients();
      }
    } catch (err) {
      console.error('Failed to toggle completion:', err);
    }
  }

  const filteredActivities = selectedType === 'ALL'
    ? activities
    : activities.filter(a => a.type === selectedType);

  function getTypeIcon(type: string) {
    switch (type) {
      case 'CALL': return 'call';
      case 'EMAIL': return 'mail';
      case 'MEETING': return 'groups';
      case 'TASK': return 'check_box';
      default: return 'edit_note';
    }
  }

  function getTypeChipVariant(type: string) {
    switch (type) {
      case 'CALL': return 'clay';
      case 'EMAIL': return 'ochre';
      case 'MEETING': return 'sage';
      case 'TASK': return 'rose';
      default: return 'stone';
    }
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-headline text-[var(--warm-ink)]">Activity & Task Stream</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">
              Track calls, emails, meetings, notes, and pending tasks across clients.
            </p>
          </div>
          <Button variant="primary" icon="add" onClick={() => setIsLogOpen(true)}>
            Log Activity
          </Button>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mobile-scroll">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                selectedType === t.id
                  ? 'bg-[var(--warm-ink)] text-white shadow-xs'
                  : 'bg-white text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]/50'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Timeline View */}
        {loading ? (
          <div className="p-12 text-center text-[var(--soft-stone)]">Loading activity stream...</div>
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            icon="notifications"
            title="No Activities Logged"
            description="Log your interactions with clients such as call notes, emails, meetings, or create follow-up tasks."
            actionLabel="Log First Activity"
            onAction={() => setIsLogOpen(true)}
          />
        ) : (
          <div className="space-y-3">
            {filteredActivities.map(act => (
              <Card key={act.id} variant="flat" padding="md" hover className="flex items-start gap-4 border border-[var(--warm-sand)]/60">
                {/* Checkbox for Task or Icon for Activity */}
                {act.type === 'TASK' ? (
                  <button
                    onClick={() => toggleTaskCompleted(act.id, act.completed)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      act.completed
                        ? 'bg-[var(--sage)] text-white'
                        : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:border-[var(--clay)]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {act.completed ? 'check' : 'check_box_outline_blank'}
                    </span>
                  </button>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-[var(--warm-sand)]/60 flex items-center justify-center shrink-0 text-[var(--clay)]">
                    <span className="material-symbols-outlined text-[20px]">{getTypeIcon(act.type)}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm text-[var(--warm-ink)] ${act.completed ? 'line-through opacity-60' : ''}`}>
                        {act.title}
                      </span>
                      <Chip label={act.type} variant="info" />
                    </div>

                    <span className="text-xs text-[var(--soft-stone)]">
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {act.description && (
                    <p className={`text-xs text-[var(--soft-stone)] mb-2 whitespace-pre-wrap ${act.completed ? 'opacity-50' : ''}`}>
                      {act.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--soft-stone)] pt-2 border-t border-[var(--warm-sand)]/30">
                    {act.client && (
                      <div className="flex items-center gap-1 font-medium text-[var(--warm-ink)]">
                        <span className="material-symbols-outlined text-[13px]">person</span>
                        {act.client.name}
                      </div>
                    )}

                    {act.authorName && (
                      <div>Logged by: <strong>{act.authorName}</strong></div>
                    )}

                    {act.dueDate && (
                      <div className={`font-medium ${new Date(act.dueDate) < new Date() && !act.completed ? 'text-[var(--rose)]' : ''}`}>
                        Due: {new Date(act.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Log Activity Modal */}
        <Modal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} title="Log New Activity">
          <form onSubmit={handleLogActivity} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--warm-ink)]">Activity Type</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'NOTE', label: 'Note', icon: 'edit_note' },
                  { id: 'CALL', label: 'Call', icon: 'call' },
                  { id: 'EMAIL', label: 'Email', icon: 'mail' },
                  { id: 'MEETING', label: 'Meeting', icon: 'groups' },
                  { id: 'TASK', label: 'Task', icon: 'check_box' },
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
              label="Subject / Title"
              placeholder="e.g. Discovery call regarding quarterly contract"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--warm-ink)]">Associated Client</label>
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]"
              >
                <option value="">-- Select Client (Optional) --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {formData.type === 'TASK' && (
              <Input
                label="Due Date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--warm-ink)]">Notes / Details</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Details of call, discussion points, action items..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
              <Button variant="ghost" onClick={() => setIsLogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Activity</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
