import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/builder', label: 'Dashboard', icon: '🏗️', end: true },
  { path: '/builder/projects', label: 'Projects', icon: '🏢' },
  { path: '/builder/buyers', label: 'Buyers', icon: '👥' },
  { path: '/builder/installments', label: 'Payments', icon: '💰' },
  { path: '/builder/search', label: 'Search', icon: '🔍' },
];

export default function BuilderDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [profileRes, projectsRes, scoreRes] = await Promise.all([
        api.get('/api/v1/builder/profile').catch(() => ({ data: { data: null } })),
        api.get('/api/v1/builder/projects').catch(() => ({ data: { data: [] } })),
        api.get('/api/v1/builder/trust-score').catch(() => ({ data: { data: null } })),
      ]);
      setProfile(profileRes.data?.data);
      setProjects(projectsRes.data?.data || []);
      setTrustScore(scoreRes.data?.data);
    } catch (e) {
      console.error('Failed to load builder data', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout osName="Haq OS" osIcon="🏗️" osColor="emerald" navItems={navItems}>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="Haq OS" osIcon="🏗️" osColor="emerald" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Builder Dashboard</h1>
            <p className="text-[var(--soft-stone)] text-sm mt-1">{profile?.companyName || 'Welcome to Haq OS Real Estate'}</p>
          </div>
          {profile && (
            <Link to="/builder/projects/new" className="px-4 py-2 bg-[var(--sage)] text-[var(--warm-ink)] rounded-lg text-sm hover:bg-[var(--sage)]">
              + Add Project
            </Link>
          )}
        </div>

        {!profile ? (
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-8 text-center">
            <p className="text-[var(--soft-stone)] mb-4">Register as a builder to start managing projects</p>
            <Link to="/builder/register" className="px-6 py-3 bg-[var(--sage)] text-[var(--warm-ink)] rounded-lg hover:bg-[var(--sage)]">
              Register as Builder
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
                <p className="text-[var(--soft-stone)] text-sm">Total Projects</p>
                <p className="text-2xl font-bold text-[var(--warm-ink)]">{projects.length || 0}</p>
              </div>
              <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
                <p className="text-[var(--soft-stone)] text-sm">Total Units</p>
                <p className="text-2xl font-bold text-[var(--warm-ink)]">{projects.reduce((s: number, p: any) => s + (p.totalUnits || 0), 0)}</p>
              </div>
              <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
                <p className="text-[var(--soft-stone)] text-sm">Units Sold</p>
                <p className="text-2xl font-bold text-[var(--sage)]">{projects.reduce((s: number, p: any) => s + (p.soldUnits || 0), 0)}</p>
              </div>
              <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
                <p className="text-[var(--soft-stone)] text-sm">Trust Score</p>
                <p className="text-2xl font-bold text-[var(--muted-ochre)]">{trustScore?.score?.toFixed(0) || '—'}/100</p>
              </div>
            </div>

            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
              <p className="text-[var(--soft-stone)] text-sm mb-2">Trust Score Progress</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-[var(--warm-sand)] rounded-full h-4 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[var(--sage)] to-[var(--sky-wash)] rounded-full transition-all" style={{ width: `${trustScore?.score || 0}%` }} />
                </div>
                <span className="text-[var(--warm-ink)] font-bold">{trustScore?.score?.toFixed(0) || 0}%</span>
              </div>
              <p className="text-[var(--soft-stone)] text-xs mt-2">
                {trustScore?.verified ? '✅ Verified Builder' : '⏳ Verification pending'} •
                {trustScore?.completedMilestones || 0}/{trustScore?.totalMilestones || 0} milestones completed
              </p>
            </div>

            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
              <p className="text-[var(--soft-stone)] text-sm mb-3">Projects</p>
              <div className="space-y-3">
                {projects.map((p: any) => (
                  <Link key={p.id} to={`/builder/projects/${p.id}`} className="flex items-center justify-between py-3 border-b border-[rgba(191,179,163,0.15)] hover:bg-[var(--warm-sand)] rounded px-2 -mx-2">
                    <div>
                      <p className="text-[var(--warm-ink)] font-medium">{p.name}</p>
                      <p className="text-[var(--soft-stone)] text-xs">{p.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[var(--sage)] text-sm">{p.soldUnits || 0}/{p.totalUnits || 0} sold</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'ACTIVE' ? 'bg-[var(--sage)]/20 text-[var(--sage)]' : 'bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]'}`}>
                        {p.status}
                      </span>
                    </div>
                  </Link>
                ))}
                {projects.length === 0 && <p className="text-[var(--soft-stone)] text-sm">No projects yet. Add your first project!</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to="/builder/projects/new" className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4 text-center hover:border-[var(--sage)]/30">
                <span className="text-2xl">🏢</span><p className="text-[var(--warm-ink)] text-sm mt-1">New Project</p>
              </Link>
              <Link to="/builder/units/new" className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4 text-center hover:border-[var(--sage)]/30">
                <span className="text-2xl">🚪</span><p className="text-[var(--warm-ink)] text-sm mt-1">Add Unit</p>
              </Link>
              <Link to="/builder/installments" className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4 text-center hover:border-[var(--sage)]/30">
                <span className="text-2xl">💳</span><p className="text-[var(--warm-ink)] text-sm mt-1">Payments</p>
              </Link>
              <Link to="/builder/buyers" className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4 text-center hover:border-[var(--sage)]/30">
                <span className="text-2xl">👥</span><p className="text-[var(--warm-ink)] text-sm mt-1">Buyers</p>
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
