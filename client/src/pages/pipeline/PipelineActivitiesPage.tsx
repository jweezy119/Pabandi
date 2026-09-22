import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

export default function PipelineActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          const jobs = data.data || [];
          // Derive activities from jobs
          const acts = jobs.flatMap((job: any) => [
            { id: `${job.id}-created`, type: 'job_created', title: `Job created: ${job.serviceType}`, time: job.createdAt },
            ...(job.status === 'COMPLETED' ? [{ id: `${job.id}-completed`, type: 'job_completed', title: `Job completed: ${job.serviceType}`, time: job.completedAt }] : []),
          ]);
          setActivities(acts.filter((a: any) => a.time));
        }
      } catch (err) {
        console.error('Failed to fetch activities:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();
  }, []);

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="#C97B5A" navItems={navItems}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Activities</h1>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center rounded-xl" style={{ background: 'var(--warm-sand)' }}>
            <p style={{ color: 'var(--soft-stone)' }}>No activities yet.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--soft-stone)' }}>
            {activities.map((act) => (
              <div key={act.id} className="p-4 flex items-center gap-4 border-b" style={{ borderColor: 'var(--soft-stone)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--clay)' }}>
                  {act.type === 'job_completed' ? '✓' : '📋'}
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{act.title}</p>
                  <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{act.time ? new Date(act.time).toLocaleDateString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
