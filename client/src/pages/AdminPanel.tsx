import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import {
  UsersIcon, BuildingStorefrontIcon, CalendarIcon,
  ChartBarIcon, ArrowRightOnRectangleIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';

type Tab = 'overview' | 'users' | 'reservations' | 'businesses';

// Updated for light theme design system
const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-secondary-container',
  CONFIRMED: 'bg-primary-container',
  COMPLETED: 'bg-tertiary-fixed',
  CANCELLED: 'bg-error-container',
  NO_SHOW:   'bg-error-container',
};
const STATUS_TEXT: Record<string, string> = {
  PENDING:   'text-secondary',
  CONFIRMED: 'text-primary',
  COMPLETED: 'text-tertiary',
  CANCELLED: 'text-error',
  NO_SHOW:   'text-error',
};

function StatCard({ label, value, sub, colorClass }: { label: string; value: number | string; sub?: string; colorClass: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-on-surface-variant font-body">{label}</p>
      <p className={`text-3xl md:text-4xl font-black mb-1 font-headline ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-on-surface-variant font-body font-medium">{sub}</p>}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const bgClass = STATUS_COLORS[status] || 'bg-surface-container-high';
  const textClass = STATUS_TEXT[status] || 'text-on-surface-variant';
  return (
    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${bgClass} ${textClass} border border-outline-variant/10 shadow-sm`}>
      {status}
    </span>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('overview');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: statsData } = useQuery('admin-stats', () =>
    apiClient.get('/admin/stats').then(r => r.data.data)
  );

  const { data: usersData } = useQuery(
    ['admin-users', userFilter],
    () => apiClient.get(`/admin/users${userFilter ? `?role=${userFilter}` : ''}`).then(r => r.data.data),
    { enabled: tab === 'users' || tab === 'overview' }
  );

  const { data: reservationsData } = useQuery(
    ['admin-reservations', statusFilter],
    () => apiClient.get(`/admin/reservations${statusFilter ? `?status=${statusFilter}` : ''}`).then(r => r.data.data),
    { enabled: tab === 'reservations' }
  );

  const { data: businessesData } = useQuery(
    'admin-businesses',
    () => apiClient.get('/admin/businesses').then(r => r.data.data),
    { enabled: tab === 'businesses' }
  );

  const verifyMutation = useMutation(
    (id: string) => apiClient.patch(`/admin/businesses/${id}/verify`),
    { onSuccess: () => qc.invalidateQueries('admin-businesses') }
  );

  const stats = statsData?.funnel;
  const users = usersData?.users || [];
  const reservations = reservationsData?.reservations || [];
  const businesses = businessesData?.businesses || [];

  const tabs = [
    { id: 'overview',     label: 'Overview',     icon: ChartBarIcon },
    { id: 'users',        label: 'Users',         icon: UsersIcon },
    { id: 'reservations', label: 'Reservations',  icon: CalendarIcon },
    { id: 'businesses',   label: 'Businesses',    icon: BuildingStorefrontIcon },
  ] as const;

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body pb-20">
      {/* Top Bar */}
      <div className="border-b border-outline-variant/20 sticky top-0 z-10 bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm font-headline">P</div>
            <span className="font-bold text-sm text-on-surface font-headline tracking-tight">Pabandi Admin</span>
            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-tertiary-fixed text-tertiary shadow-sm border border-tertiary/10">ADMIN</span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 text-xs font-bold transition-colors text-error hover:bg-error-container px-3 py-2 rounded-lg">
            <ArrowRightOnRectangleIcon className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tab Nav */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl w-max bg-surface-container-low border border-outline-variant/20 shadow-sm overflow-x-auto max-w-full">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                tab === t.id 
                ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}>
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-10 animate-fade-up">
            <div>
              <h1 className="text-3xl font-black mb-1.5 text-on-surface font-headline tracking-tight">Platform Overview</h1>
              <p className="text-sm text-on-surface-variant font-medium">Real-time metrics across all of Pabandi.</p>
            </div>

            {/* Funnel */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest mb-4 text-on-surface-variant">Conversion Funnel</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <StatCard label="Signed Up" value={stats?.signedUp ?? '—'} sub="Total registered users" colorClass="text-primary" />
                <StatCard label="Made Reservation" value={stats?.madeReservation ?? '—'} sub="Users with ≥1 booking" colorClass="text-secondary" />
                <StatCard label="Completed Booking" value={stats?.completedBooking ?? '—'} sub="Fully completed reservations" colorClass="text-tertiary" />
              </div>
            </div>

            {/* Recent Users */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Recent Sign-ups</p>
                <button onClick={() => setTab('users')} className="text-xs font-bold text-primary hover:underline">View All →</button>
              </div>
              <div className="rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                        {['Name', 'Email', 'Role', 'Reservations', 'Joined'].map(h => (
                          <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {users.slice(0, 8).map((u: any) => (
                        <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-5 py-3 font-bold text-on-surface font-headline">{u.firstName} {u.lastName}</td>
                          <td className="px-5 py-3 text-on-surface-variant font-medium text-xs">{u.email}</td>
                          <td className="px-5 py-3"><Badge status={u.role} /></td>
                          <td className="px-5 py-3 text-center font-black text-on-surface font-headline">{u._count?.reservations ?? 0}</td>
                          <td className="px-5 py-3 text-on-surface-variant font-medium text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {users.length === 0 && (
                  <p className="text-center py-12 text-sm text-on-surface-variant font-medium">No users yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-on-surface font-headline">Users <span className="text-lg font-bold text-on-surface-variant">({usersData?.total ?? 0})</span></h2>
              <div className="flex gap-2 flex-wrap">
                {['', 'CUSTOMER', 'BUSINESS_OWNER', 'ADMIN'].map(r => (
                  <button key={r} onClick={() => setUserFilter(r)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      userFilter === r 
                      ? 'bg-primary-container text-primary border border-primary/20 shadow-sm' 
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low'
                    }`}>
                    {r.replace('_', ' ') || 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                      {['Name', 'Email', 'Phone', 'Role', 'Business', '# Bookings', 'Joined'].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {users.map((u: any) => (
                      <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-5 py-3 font-bold text-on-surface font-headline whitespace-nowrap">{u.firstName} {u.lastName}</td>
                        <td className="px-5 py-3 text-on-surface-variant font-medium text-xs">{u.email}</td>
                        <td className="px-5 py-3 text-on-surface-variant font-medium text-xs whitespace-nowrap">{u.phone || '—'}</td>
                        <td className="px-5 py-3 whitespace-nowrap"><Badge status={u.role} /></td>
                        <td className="px-5 py-3 text-on-surface-variant font-medium text-xs truncate max-w-[150px]">{u.business?.name || '—'}</td>
                        <td className="px-5 py-3 text-center font-black text-on-surface font-headline">{u._count?.reservations ?? 0}</td>
                        <td className="px-5 py-3 text-xs text-on-surface-variant font-medium whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <p className="text-center py-12 text-sm text-on-surface-variant font-medium">No users found.</p>
              )}
            </div>
          </div>
        )}

        {/* ── RESERVATIONS ─────────────────────────────── */}
        {tab === 'reservations' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-on-surface font-headline">Reservations <span className="text-lg font-bold text-on-surface-variant">({reservationsData?.total ?? 0})</span></h2>
              <div className="flex gap-2 flex-wrap">
                {['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === s 
                      ? `${STATUS_COLORS[s] || 'bg-primary-container'} ${STATUS_TEXT[s] || 'text-primary'} border border-outline-variant/10 shadow-sm` 
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-low'
                    }`}>
                    {s.replace('_', ' ') || 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                      {['Customer', 'Business', 'Date', 'Time', 'Guests', 'Status', 'Deposit', 'Created'].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {reservations.map((r: any) => (
                      <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-5 py-3 font-bold text-on-surface font-headline whitespace-nowrap">{r.customer?.firstName} {r.customer?.lastName}</td>
                        <td className="px-5 py-3 text-on-surface-variant font-medium text-xs max-w-[150px] truncate">{r.business?.name}</td>
                        <td className="px-5 py-3 text-on-surface font-semibold text-xs whitespace-nowrap">{new Date(r.reservationDate).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-on-surface-variant font-medium text-xs whitespace-nowrap">{r.reservationTime}</td>
                        <td className="px-5 py-3 text-center font-black text-on-surface font-headline">{r.numberOfGuests}</td>
                        <td className="px-5 py-3 whitespace-nowrap"><Badge status={r.status} /></td>
                        <td className="px-5 py-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${r.depositStatus === 'PAID' ? 'bg-tertiary-fixed text-tertiary border border-tertiary/10' : 'bg-secondary-container text-secondary border border-secondary/10'}`}>
                            {r.depositStatus || 'NONE'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-on-surface-variant font-medium whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reservations.length === 0 && (
                <p className="text-center py-12 text-sm text-on-surface-variant font-medium">No reservations found.</p>
              )}
            </div>
          </div>
        )}

        {/* ── BUSINESSES ───────────────────────────────── */}
        {tab === 'businesses' && (
          <div className="space-y-6 animate-fade-up">
            <h2 className="text-2xl font-black text-on-surface font-headline">Businesses <span className="text-lg font-bold text-on-surface-variant">({businesses.length})</span></h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              {businesses.map((b: any) => (
                <div key={b.id} className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-surface-container-lowest border border-outline-variant/30 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-xl font-headline bg-primary-container text-primary shadow-sm border border-primary/10">
                      {b.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-black text-lg truncate text-on-surface font-headline tracking-tight">{b.name}</p>
                        {b.isVerified && <CheckBadgeIcon className="h-5 w-5 text-tertiary shrink-0 drop-shadow-sm" />}
                      </div>
                      <p className="text-xs font-medium text-on-surface-variant truncate mb-1.5">{b.category} · {b.address}</p>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-medium border border-outline-variant/20">
                          Owner: {b.owner?.firstName} {b.owner?.lastName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-medium border border-outline-variant/20">
                          {b._count?.reservations} bookings
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center mt-2 sm:mt-0">
                    {!b.isVerified && (
                      <button onClick={() => verifyMutation.mutate(b.id)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 bg-tertiary text-on-tertiary shadow-sm flex items-center gap-1">
                        <CheckBadgeIcon className="h-4 w-4" /> Verify
                      </button>
                    )}
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shadow-sm uppercase tracking-widest ${
                      b.isActive 
                      ? 'bg-tertiary-fixed text-tertiary border-tertiary/10' 
                      : 'bg-error-container text-error border-error/10'
                    }`}>
                      {b.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              ))}
              {businesses.length === 0 && (
                <div className="text-center py-12 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl">
                  <BuildingStorefrontIcon className="h-10 w-10 mx-auto text-outline opacity-50 mb-3" />
                  <p className="text-sm text-on-surface font-bold mb-1">No businesses yet</p>
                  <p className="text-xs text-on-surface-variant font-medium">Businesses registered on Pabandi will appear here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
