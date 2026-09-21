import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

export default function PipelineActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActivities([
      { id: '1', type: 'call', title: 'Discovery call with Acme', user: 'Sarah', time: '2 hours ago', icon: 'phone' },
      { id: '2', type: 'email', title: 'Proposal sent to TechStart', user: 'Mike', time: '5 hours ago', icon: 'email' },
      { id: '3', type: 'meeting', title: 'Demo with Global Ventures', user: 'Sarah', time: '1 day ago', icon: 'event' },
      { id: '4', type: 'note', title: 'Updated NextGen lead score', user: 'Mike', time: '2 days ago', icon: 'note' },
      { id: '5', type: 'deal', title: 'Closed deal with StartupXYZ', user: 'Sarah', time: '3 days ago', icon: 'handshake' },
    ]);
    setLoading(false);
  }, []);

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="indigo" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">Activity Feed</h1>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-indigo-400">{a.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm">{a.title}</p>
                  <p className="text-gray-500 text-xs">{a.user} • {a.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
