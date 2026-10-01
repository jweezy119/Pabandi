import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives/Button';
import { EmptyState } from '../../components/primitives/EmptyState';
import { TaskList } from './components/TaskList';
import { TaskBoard } from './components/TaskBoard';
import { TaskCalendar } from './components/TaskCalendar';
import { TaskFormModal } from './components/TaskFormModal';
import { getAuthToken } from '../../utils/authToken';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function ContactTasksPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'BOARD' | 'CALENDAR'>('LIST');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [taskRes, cliRes, dealRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/crm/tasks?businessId=${businessId}`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/crm/clients?businessId=${businessId}`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/crm/deals?businessId=${businessId}`, { headers: getHeaders() }),
      ]);
      setTasks(await taskRes.json() || []);
      if (cliRes.ok) setClients((await cliRes.json()).data || []);
      if (dealRes.ok) setDeals((await dealRes.json()).data || []);
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
            {view === 'LIST' && <TaskList tasks={tasks} onToggleTask={handleToggleTask} onTaskClick={openEditTask} />}
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
