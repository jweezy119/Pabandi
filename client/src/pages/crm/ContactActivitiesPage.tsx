import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives/Button';
import { EmptyState } from '../../components/primitives/EmptyState';
import { ActivityFeed } from './components/ActivityFeed';
import { ActivityFormModal } from './components/ActivityFormModal';
import { TaskFormModal } from './components/TaskFormModal';
import { getAuthToken } from '../../utils/authToken';
import { readList } from '../../utils/crmResponse';



const TYPES = [
  { id: 'ALL', label: 'All', icon: 'list' },
  { id: 'CALL', label: 'Calls', icon: 'call' },
  { id: 'EMAIL', label: 'Emails', icon: 'mail' },
  { id: 'MEETING', label: 'Meetings', icon: 'groups' },
  { id: 'NOTE', label: 'Notes', icon: 'edit_note' },
  { id: 'TASK', label: 'Tasks', icon: 'check_box' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function ContactActivitiesPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [activities, setActivities] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Whether the list is empty because there is nothing, or because the request failed.
  // The code already knew the difference and wrote it to the console, which nobody
  // reads; the UI showed "Inbox Zero" for both, so a broken endpoint looked exactly
  // like a clear inbox and offered "Add Something" — which then failed for the same
  // reason.
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedType, setSelectedType] = useState('ALL');
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('NOTE');

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [actRes, cliRes, dealRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/crm/activities?businessId=${businessId}`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/crm/clients?businessId=${businessId}`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/crm/deals?businessId=${businessId}`, { headers: getHeaders() }),
      ]);
      // readList, not `await res.json()`. This endpoint returns a bare array on
      // success and `{error}` on failure, so an unchecked read put an OBJECT into
      // `activities` the moment the token expired — and the line below calls
      // activities.filter(), which threw and rendered the error boundary. It
      // presented as "this page ran into a problem"; the console had nothing.
      const [acts, clients_, deals_] = await Promise.all([
        readList(actRes), readList(cliRes), readList(dealRes),
      ]);
      setActivities(acts.items);
      setClients(clients_.items);
      setDeals(deals_.items);

      if (!acts.ok) {
        setLoadFailed(true);
        // Said out loud rather than shown as an empty list: "no activities yet" and
        // "we could not ask the server" are different facts, and only one of them
        // is fixed by creating an activity.
        console.error('[Activities] could not load activities — the list is empty because the request failed, not because there are none.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async (data: any) => {
    try {
      await fetch(`${API_BASE}/api/v1/crm/activities?businessId=${businessId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, businessId })
      });
      setIsActivityModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTask = async (data: any) => {
    try {
      await fetch(`${API_BASE}/api/v1/crm/tasks?businessId=${businessId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, businessId })
      });
      setIsTaskModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (id: string, currentCompleted: boolean) => {
    try {
      await fetch(`${API_BASE}/api/v1/crm/tasks/${id}?businessId=${businessId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: currentCompleted ? 'TODO' : 'DONE' })
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = selectedType === 'ALL' ? activities : activities.filter(a => a.type === selectedType);

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <div className="flex justify-between items-center clay-heading">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Unified Inbox</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Track your activities and tasks</p>
          </div>
          <div className="flex items-center gap-2 relative group">
            <Button variant="primary" icon="add" onClick={() => { setQuickAddType('NOTE'); setIsActivityModalOpen(true); }}>
              Log Activity
            </Button>
            {/* Quick Add floating options */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col gap-1 bg-white p-2 rounded-xl shadow-lg border border-[var(--warm-sand)] z-10 w-48">
              {TYPES.filter(t => t.id !== 'ALL').map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.id === 'TASK') setIsTaskModalOpen(true);
                    else {
                      setQuickAddType(t.id);
                      setIsActivityModalOpen(true);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/50 rounded-lg w-full text-left"
                >
                  <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                  Add {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mobile-scroll">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`clay-filter-chip flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
                selectedType === t.id ? 'clay-filter-chip--active' : 'clay-filter-chip--inactive'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-12 text-center text-[var(--soft-stone)]">Loading...</div>
        ) : loadFailed ? (
          // Distinct from the empty state, and it does not offer to create one:
          // adding an activity will not fix a request that failed.
          <EmptyState
            icon="cloud_off"
            title="Could not load activities"
            description="This is a connection or permissions problem, not an empty inbox. Reload the page to try again."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="notifications"
            title="Inbox Zero"
            description="No activities or tasks match your filter."
            actionLabel="Add Something"
            onAction={() => setIsActivityModalOpen(true)}
          />
        ) : (
          <ActivityFeed 
            activities={filtered} 
            onToggleTask={handleToggleTask} 
            onActivityClick={() => {}} 
          />
        )}

        <ActivityFormModal 
          isOpen={isActivityModalOpen} 
          onClose={() => setIsActivityModalOpen(false)} 
          onSubmit={handleCreateActivity}
          initialType={quickAddType}
          clients={clients}
          deals={deals}
        />

        <TaskFormModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSubmit={handleCreateTask}
          clients={clients}
          deals={deals}
        />
      </div>
    </DashboardLayout>
  );
}
