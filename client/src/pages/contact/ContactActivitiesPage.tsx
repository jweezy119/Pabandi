import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/contact/leads', label: 'Leads', icon: 'person_add' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

export default function ContactActivitiesPage() {
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
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Activities</h1>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center rounded-[var(--radius-card)]" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ color: 'var(--soft-stone)' }}>No activities yet.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] overflow-hidden" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            {activities.map((act) => (
              <div
                key={act.id}
                className="p-5 flex items-center gap-4"
                style={{ borderBottom: '1px solid rgba(191,179,163,0.2)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--clay)' }}
                >
                  <span className="material-symbols-outlined text-[var(--warm-ink)] text-[20px]">
                    {act.type === 'job_completed' ? 'check_circle' : 'assignment'}
                  </span>
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{act.title}</p>
                  <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
                    {act.time ? new Date(act.time).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
