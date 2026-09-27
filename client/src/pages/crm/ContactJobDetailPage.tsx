import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/primitives/Card';
import { Button } from '../../components/primitives/Button';
import { JobCheckinPanel } from './components/JobCheckinPanel';
const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });
const api = {
  get: async (url: string) => { const r = await fetch(API_BASE + url, { headers: getHeaders() }); return { data: await r.json() }; },
  post: async (url: string, data: any) => { const r = await fetch(API_BASE + url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }); return { data: await r.json() }; },
  patch: async (url: string, data: any) => { const r = await fetch(API_BASE + url, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data) }); return { data: await r.json() }; }
};import { Input } from '../../components/primitives/Input';

type JobData = {
  id: string;
  serviceType: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  status: string;
  price: number;
  client?: { name: string; passportId?: string };
};

export function ContactJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<JobData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<JobData>>({});
  
  // Need businessId. Hardcode for now or assume it's in context/local storage.
  const businessId = 'default';

  useEffect(() => {
    if (jobId) loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      const res = await api.get(`/api/v1/jobs/${jobId}?businessId=${businessId}`);
      if (res.data) {
        setJob(res.data);
        setEditForm(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckIn = async () => {
    try {
      await api.post(`/api/v1/jobs/${jobId}/checkin?businessId=${businessId}`, {});
      loadJob();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckOut = async () => {
    try {
      await api.post(`/api/v1/jobs/${jobId}/checkout?businessId=${businessId}`, {});
      loadJob();
    } catch (err) {
      console.error(err);
    }
  };

  const saveEdits = async () => {
    try {
      await api.patch(`/api/v1/jobs/${jobId}?businessId=${businessId}`, editForm);
      setIsEditing(false);
      loadJob();
    } catch (err) {
      console.error(err);
    }
  };

  if (!job) return <div className="p-8 text-white">Loading job...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
        <h1 className="text-2xl font-bold text-white flex-1">{job.serviceType}</h1>
        {!isEditing ? (
          <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit Job</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={saveEdits}>Save Changes</Button>
          </>
        )}
      </div>

      <JobCheckinPanel 
        job={job}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Job Details</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Service Type</label>
              {isEditing ? (
                <Input value={editForm.serviceType} onChange={e => setEditForm({...editForm, serviceType: e.target.value})} />
              ) : (
                <div className="text-white">{job.serviceType}</div>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400">Date & Time</label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input type="date" value={new Date(editForm.scheduledDate).toISOString().split('T')[0]} onChange={e => setEditForm({...editForm, scheduledDate: e.target.value})} />
                  <Input type="time" value={editForm.scheduledTime} onChange={e => setEditForm({...editForm, scheduledTime: e.target.value})} />
                </div>
              ) : (
                <div className="text-white">{new Date(job.scheduledDate).toLocaleDateString()} at {job.scheduledTime}</div>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400">Price</label>
              {isEditing ? (
                <Input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})} />
              ) : (
                <div className="text-white">${job.price}</div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Client & Invoice</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Client</label>
              <div className="text-white">{job.client?.name || 'No client linked'}</div>
            </div>
            <div>
              <label className="text-sm text-gray-400">Related Invoice</label>
              {job.status === 'COMPLETED' ? (
                <div className="text-blue-400 cursor-pointer hover:underline">View Auto-Generated Invoice</div>
              ) : (
                <div className="text-gray-500">Invoice will be generated on check-out</div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
