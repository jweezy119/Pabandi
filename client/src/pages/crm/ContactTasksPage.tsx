import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives/Button';
import { EmptyState } from '../../components/primitives/EmptyState';
import { TaskList } from './components/TaskList';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_STATUS_LABELS } from '@shared/crm';
import { TaskBoard } from './components/TaskBoard';
import { TaskCalendar } from './components/TaskCalendar';
import { TaskFormModal } from './components/TaskFormModal';
import { getAuthToken } from '../../utils/authToken';
import { readList } from '../../utils/crmResponse';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function ContactTasksPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'BOARD' | 'CALENDAR'>('LIST');
  /**
   * Filters the server applies. Status and priority are both stored, both validated
   * on write, and both were unfilterable — the board showed every task regardless of
   * which column it sat in, so "show me what is urgent" had no answer.
   */
  const [filters, setFilters] = useState<{ status: string; priority: string }>({ status: '', priority: '' });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId]);

  const loadData = async () => {
    const params = new URLSearchParams();
    if (businessId) params.set('businessId', businessId);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    const taskQuery = `${API_BASE}/api/v1/crm/tasks?${params.toString()}`;
    setLoading(true);
    try {
      const [taskRes, cliRes, dealRes] = await Promise.all([
        fetch(taskQuery, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/crm/clients?businessId=${businessId}`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/crm/deals?businessId=${businessId}`, { headers: getHeaders() }),
      ]);
      // readList: /crm/tasks answers with a bare array on success and `{error}` on
      // failure, so an unchecked read put an object into `tasks` and the board's
      // tasks.filter threw — the same error boundary the Activities page hit.
      const [tasks_, clients_, deals_] = await Promise.all([
        readList(taskRes), readList(cliRes), readList(dealRes),
      ]);
      setTasks(tasks_.items);
      setClients(clients_.items);
      setDeals(deals_.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTask = async (data: any) => {
    try {
      if (selectedTask) {
        await fetch(`${API_BASE}/api/v1/crm/tasks/${selectedTask.id}?businessId=${businessId}`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ ...data, businessId })
        });
      } else {
        await fetch(`${API_BASE}/api/v1/crm/tasks?businessId=${businessId}`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ ...data, businessId })
        });
      }
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

  /**
   * Delete a task.
   *
   * There was no way to remove one. The only affordance was a TODO/DONE toggle, so a
   * task created by mistake stayed on the board forever and the only way to stop
   * seeing it was to mark it complete — a claim about work done that was not done.
   *
   * The response is checked. `fetch` does not reject on a 4xx, so an unchecked call
   * would reload the list, show the task still there, and look like nothing happened.
   */
  const handleDeleteTask = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/v1/crm/tasks/${id}?businessId=${businessId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      setActionError('Could not delete that task. It may belong to another workspace.');
      return;
    }
    setActionError(null);
    setTasks((prev: any[]) => prev.filter((t: any) => t.id !== id));
  };

  const openEditTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      setSelectedTask(task);
      setIsTaskModalOpen(true);
    }
  };

  const openCreateTask = () => {
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <div className="flex justify-between items-center clay-heading">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Tasks</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage your upcoming work</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-[var(--warm-sand)]/50 rounded-lg p-1">
              {['LIST', 'BOARD', 'CALENDAR'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={`px-3 py-1 text-sm rounded ${view === v ? 'bg-white text-[var(--warm-ink)] shadow-sm' : 'text-[var(--soft-stone)]'}`}
                >
                  {v.charAt(0) + v.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <Button variant="primary" icon="add" onClick={openCreateTask}>New Task</Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[var(--soft-stone)]">Loading...</div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon="check_box"
            title="No Tasks"
            description="You don't have any tasks pending."
            actionLabel="Create Task"
            onAction={openCreateTask}
          />
        ) : (
          <>
            {/* Filters. Status and priority are both stored and validated on write,
                and neither was reachable — the board showed everything regardless of
                column, so "what is urgent" had no answer. */}
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                aria-label="Filter by status"
                className="px-3 py-1.5 rounded-xl border border-[var(--soft-stone)]/40 text-sm bg-white"
              >
                <option value="">All statuses</option>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s] ?? s}</option>)}
              </select>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                aria-label="Filter by priority"
                className="px-3 py-1.5 rounded-xl border border-[var(--soft-stone)]/40 text-sm bg-white"
              >
                <option value="">All priorities</option>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {(filters.status || filters.priority) && (
                <button
                  onClick={() => setFilters({ status: '', priority: '' })}
                  className="px-3 py-1.5 text-sm text-[var(--soft-stone)] hover:text-[var(--warm-ink)]"
                >
                  Clear
                </button>
              )}
            </div>

            {actionError && (
              <p role="alert" className="text-sm mb-3" style={{ color: 'var(--dusty-rose)' }}>
                {actionError}
              </p>
            )}

            {view === 'LIST' && (
              <TaskList
                tasks={tasks}
                onToggleTask={handleToggleTask}
                onTaskClick={openEditTask}
                onDeleteTask={handleDeleteTask}
              />
            )}
            {view === 'BOARD' && <TaskBoard tasks={tasks} onTaskClick={openEditTask} />}
            {view === 'CALENDAR' && <TaskCalendar tasks={tasks} onTaskClick={openEditTask} />}
          </>
        )}

        <TaskFormModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSubmit={handleSaveTask}
          clients={clients}
          deals={deals}
          initialData={selectedTask}
        />
      </div>
    </DashboardLayout>
  );
}
