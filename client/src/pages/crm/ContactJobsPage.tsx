import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/primitives/Button';
import { JobList } from './components/JobList';
import { JobCalendar } from './components/JobCalendar';
import { JobFormModal, JobFormData } from './components/JobFormModal';
import { getAuthToken } from '../../utils/authToken';
const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });
const api = {
  get: async (url: string) => { const r = await fetch(API_BASE + url, { headers: getHeaders() }); return { data: await r.json() }; },
  post: async (url: string, data: any) => { const r = await fetch(API_BASE + url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }); return { data: await r.json() }; },
  patch: async (url: string, data: any) => { const r = await fetch(API_BASE + url, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data) }); return { data: await r.json() }; }
};
type JobData = {
  id: string;
  serviceType: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  status: string;
  price: number;
};

type ClientData = {
  id: string;
  name: string;
};

export function ContactJobsPage({ businessId }: { businessId: string }) {
  const [view, setView] = useState<'List' | 'Calendar'>('List');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const navigate = useNavigate();


  useEffect(() => {
    if (businessId) {
      loadJobs();
      loadClients();
    }
  }, [businessId]);

  const loadJobs = async () => {
    try {
      const res = await api.get(`/api/v1/jobs?businessId=${businessId}`);
      if (res.data) setJobs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadClients = async () => {
    try {
      const res = await api.get(`/api/v1/crm/clients?businessId=${businessId}`);
      if (res.data) setClients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateJob = async (data: JobFormData) => {
    try {
      await api.post(`/api/v1/jobs?businessId=${businessId}`, data);
      setIsModalOpen(false);
      loadJobs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-white">Jobs</h2>
        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 rounded-lg p-1">
            <button 
              onClick={() => setView('List')}
              className={`px-3 py-1 text-sm rounded ${view === 'List' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
            >
              List
            </button>
            <button 
              onClick={() => setView('Calendar')}
              className={`px-3 py-1 text-sm rounded ${view === 'Calendar' ? 'bg-white/10 text-white' : 'text-gray-400'}`}
            >
              Calendar
            </button>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>+ New Job</Button>
        </div>
      </div>

      {view === 'List' ? (
        <JobList jobs={jobs} onJobClick={(id) => navigate(`/contact/jobs/${id}`)} />
      ) : (
        <JobCalendar jobs={jobs} onJobClick={(id) => navigate(`/contact/jobs/${id}`)} />
      )}

      <JobFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateJob}
        clients={clients}
      />
    </div>
  );
}
