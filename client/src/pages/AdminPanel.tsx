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

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'rgba(251,191,36,0.15)',
  CONFIRMED: 'rgba(59,130,246,0.15)',
  COMPLETED: 'rgba(52,211,153,0.15)',
  CANCELLED: 'rgba(239,68,68,0.15)',
  NO_SHOW:   'rgba(139,92,246,0.15)',
};
const STATUS_TEXT: Record<string, string> = {
  PENDING:   '#fbbf24',
  CONFIRMED: '#60a5fa',
  COMPLETED: '#34d399',
  CANCELLED: '#f87171',
  NO_SHOW:   '#a78bfa',
};

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>{label}</p>
      <p className="text-4xl font-black mb-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: '#3d5068' }}>{sub}</p>}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: STATUS_COLORS[status] || 'rgba(255,255,255,0.05)', color: STATUS_TEXT[status] || '#a0b4c8' }}>
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
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}>
      {/* Top Bar */}
      <div className="border-b sticky top-0 z-10" style={{ background: 'var(--color-bg)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>P</div>
            <span className="font-bold text-sm" style={{ color: '#e8edf3' }}>Pabandi Admin</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>ADMIN</span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: '#5a7490' }}>
            <ArrowRightOnRectangleIcon className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tab Nav */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: 'var(--color-surface-raised)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: tab === t.id ? '#60a5fa' : '#5a7490',
              }}>
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-black mb-1" style={{ color: '#e8edf3' }}>Platform Overview</h1>
              <p className="text-sm" style={{ color: '#5a7490' }}>Real-time metrics across all of Pabandi.</p>
            </div>

            {/* Funnel */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#3d5068' }}>Conversion Funnel</p>
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Signed Up" value={stats?.signedUp ?? '—'} sub="Total registered users" color="#60a5fa" />
                <StatCard label="Made Reservation" value={stats?.madeReservation ?? '—'} sub="Users with ≥1 booking" color="#a78bfa" />
                <StatCard label="Completed Booking" value={stats?.completedBooking ?? '—'} sub="Fully completed reservations" color="#34d399" />
              </div>
            </div>

            {/* Recent Users */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#3d5068' }}>Recent Sign-ups</p>
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['Name', 'Email', 'Role', 'Reservations', 'Joined'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#3d5068' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 8).map((u: any) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#e8edf3' }}>{u.firstName} {u.lastName}</td>
                        <td className="px-4 py-3" style={{ color: '#7a90a8' }}>{u.email}</td>
                        <td className="px-4 py-3"><Badge status={u.role} /></td>
                        <td className="px-4 py-3 text-center font-bold" style={{ color: '#e8edf3' }}>{u._count?.reservations ?? 0}</td>
                        <td className="px-4 py-3" style={{ color: '#3d5068' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p className="text-center py-12 text-sm" style={{ color: '#3d5068' }}>No users yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black" style={{ color: '#e8edf3' }}>Users <span className="text-base font-normal" style={{ color: '#5a7490' }}>({usersData?.total ?? 0})</span></h2>
              <div className="flex gap-2">
                {['', 'CUSTOMER', 'BUSINESS_OWNER', 'ADMIN'].map(r => (
                  <button key={r} onClick={() => setUserFilter(r)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: userFilter === r ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                      color: userFilter === r ? '#60a5fa' : '#5a7490',
                      border: '1px solid ' + (userFilter === r ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'),
                    }}>
                    {r || 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['Name', 'Email', 'Phone', 'Role', 'Business', '# Bookings', 'Joined'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#3d5068' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#e8edf3' }}>{u.firstName} {u.lastName}</td>
                      <td className="px-4 py-3" style={{ color: '#7a90a8' }}>{u.email}</td>
                      <td className="px-4 py-3" style={{ color: '#5a7490' }}>{u.phone || '—'}</td>
                      <td className="px-4 py-3"><Badge status={u.role} /></td>
                      <td className="px-4 py-3" style={{ color: '#5a7490' }}>{u.business?.name || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold" style={{ color: '#e8edf3' }}>{u._count?.reservations ?? 0}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#3d5068' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: '#3d5068' }}>No users found.</p>
              )}
            </div>
          </div>
        )}

        {/* ── RESERVATIONS ─────────────────────────────── */}
        {tab === 'reservations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-black" style={{ color: '#e8edf3' }}>Reservations <span className="text-base font-normal" style={{ color: '#5a7490' }}>({reservationsData?.total ?? 0})</span></h2>
              <div className="flex gap-2 flex-wrap">
                {['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: statusFilter === s ? (STATUS_COLORS[s] || 'rgba(59,130,246,0.15)') : 'rgba(255,255,255,0.04)',
                      color: statusFilter === s ? (STATUS_TEXT[s] || '#60a5fa') : '#5a7490',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                    {s || 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['Customer', 'Business', 'Date', 'Time', 'Guests', 'Status', 'Deposit', 'Created'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#3d5068' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r: any) => (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#e8edf3' }}>{r.customer?.firstName} {r.customer?.lastName}</td>
                      <td className="px-4 py-3" style={{ color: '#7a90a8' }}>{r.business?.name}</td>
                      <td className="px-4 py-3" style={{ color: '#a0b4c8' }}>{new Date(r.reservationDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3" style={{ color: '#5a7490' }}>{r.reservationTime}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#e8edf3' }}>{r.numberOfGuests}</td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold" style={{ color: r.depositStatus === 'PAID' ? '#34d399' : '#fbbf24' }}>
                          {r.depositStatus || 'NONE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#3d5068' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reservations.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: '#3d5068' }}>No reservations found.</p>
              )}
            </div>
          </div>
        )}

        {/* ── BUSINESSES ───────────────────────────────── */}
        {tab === 'businesses' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black" style={{ color: '#e8edf3' }}>Businesses <span className="text-base font-normal" style={{ color: '#5a7490' }}>({businesses.length})</span></h2>

            <div className="grid gap-4">
              {businesses.map((b: any) => (
                <div key={b.id} className="rounded-2xl p-5 flex items-center justify-between gap-4"
                  style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg"
                      style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
                      {b.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate" style={{ color: '#e8edf3' }}>{b.name}</p>
                        {b.isVerified && <CheckBadgeIcon className="h-4 w-4 text-emerald-400 shrink-0" />}
                      </div>
                      <p className="text-xs truncate" style={{ color: '#5a7490' }}>{b.category} · {b.address}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3d5068' }}>
                        Owner: {b.owner?.firstName} {b.owner?.lastName} ({b.owner?.email}) · {b._count?.reservations} reservations
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!b.isVerified && (
                      <button onClick={() => verifyMutation.mutate(b.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                        ✓ Verify
                      </button>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${b.isActive ? 'text-emerald-400' : 'text-red-400'}`}
                      style={{ background: b.isActive ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)' }}>
                      {b.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              ))}
              {businesses.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: '#3d5068' }}>No businesses registered yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
