import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import apiClient, { adminService } from '../services/api';
import {
  UsersIcon,
  BuildingStorefrontIcon,
  CalendarIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  CheckBadgeIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { Surface, Button, Badge, tokens } from '../design-system';

type Tab = 'overview' | 'users' | 'reservations' | 'businesses' | 'plugins' | 'approvals';

const STATUS_COLORS: Record<string, { bg: string; text: string; }> = {
  PENDING:   { bg: 'rgba(148,163,184,0.08)', text: '#cbd5e1' },
  CONFIRMED: { bg: 'rgba(129,140,248,0.08)', text: '#c7d2fe' },
  COMPLETED: { bg: 'rgba(192,132,252,0.12)', text: '#e9d5ff' },
  CANCELLED: { bg: 'rgba(239,68,68,0.08)', text: '#fecaca' },
  NO_SHOW:   { bg: 'rgba(239,68,68,0.08)', text: '#fecaca' },
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: ChartBarIcon },
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'reservations', label: 'Reservations', icon: CalendarIcon },
  { id: 'businesses', label: 'Businesses', icon: BuildingStorefrontIcon },
  { id: 'plugins', label: 'Plugins', icon: CogIcon },
  { id: 'approvals', label: 'Approvals', icon: CheckBadgeIcon },
] as const;

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

  const { data: pluginsData } = useQuery(
    'admin-openwa-plugins',
    () => apiClient.get('/admin/openwa/plugins').then(r => r.data.data),
    { enabled: tab === 'plugins' }
  );

  const pluginToggle = useMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.patch(`/admin/openwa/plugins/${id}`, { enabled }),
    { onSuccess: () => qc.invalidateQueries('admin-openwa-plugins') }
  );

  const verifyMutation = useMutation(
    (id: string) => apiClient.patch(`/admin/businesses/${id}/verify`),
    { onSuccess: () => qc.invalidateQueries('admin-businesses') }
  );

  const { data: profileRequestsData } = useQuery(
    'admin-profile-requests',
    () => adminService.getProfileRequests().then((r: any) => r.data.data),
    { enabled: tab === 'approvals' }
  );

  const approveProfileMutation = useMutation(
    (id: string) => adminService.approveProfileRequest(id),
    { onSuccess: () => qc.invalidateQueries('admin-profile-requests') }
  );

  const rejectProfileMutation = useMutation(
    (id: string) => adminService.rejectProfileRequest(id),
    { onSuccess: () => qc.invalidateQueries('admin-profile-requests') }
  );

  const stats = statsData?.funnel;
  const users = usersData?.users || [];
  const reservations = reservationsData?.reservations || [];
  const businesses = businessesData?.businesses || [];

  return (
    <div className="min-h-screen pb-20 font-body" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-black/40 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500 font-black text-sm text-white shadow-sm">P</div>
            <span className="font-headline text-sm font-bold tracking-tight text-white">Pabandi Admin</span>
            <span className="rounded-full border border-indigo-400/15 bg-indigo-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-300 shadow-sm">ADMIN</span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors text-red-300 hover:bg-red-500/10 border border-red-500/10">
            <ArrowRightOnRectangleIcon className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 w-fit max-w-full shadow-sm">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
                tab === t.id
                  ? 'bg-white/10 text-indigo-300 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}>
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-10 animate-fade-up">
            <div>
              <h1 className="text-3xl font-black mb-1.5 font-headline tracking-tight text-white">Platform Overview</h1>
              <p className="text-sm font-medium text-white/70">Real-time metrics across all of Pabandi.</p>
            </div>

            <div>
              <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-white/70">Conversion Funnel</p>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <Surface>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/70">Signed Up</p>
                  <p className="font-headline text-3xl font-black text-indigo-300 md:text-4xl">{stats?.signedUp ?? '—'}</p>
                  <p className="text-xs font-medium text-white/70">Total registered users</p>
                </Surface>
                <Surface>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/70">Made Reservation</p>
                  <p className="font-headline text-3xl font-black text-indigo-200 md:text-4xl">{stats?.madeReservation ?? '—'}</p>
                  <p className="text-xs font-medium text-white/70">Users with ≥1 booking</p>
                </Surface>
                <Surface>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/70">Completed Booking</p>
                  <p className="font-headline text-3xl font-black text-purple-300 md:text-4xl">{stats?.completedBooking ?? '—'}</p>
                  <p className="text-xs font-medium text-white/70">Fully completed reservations</p>
                </Surface>
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Recent Sign-ups</p>
                <button onClick={() => setTab('users')} className="text-xs font-bold text-indigo-300 hover:underline">View All →</button>
              </div>
              <Surface className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.04]">
                        {['Name', 'Email', 'Role', 'Reservations', 'Joined'].map(h => (
                          <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white/70">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {users.slice(0, 8).map((u: any) => (
                        <tr key={u.id} className="transition-colors hover:bg-white/[0.04]">
                          <td className="px-5 py-3 font-bold text-white">{u.firstName} {u.lastName}</td>
                          <td className="px-5 py-3 text-xs text-white/70">{u.email}</td>
                          <td className="px-5 py-3"><StatusBadge status={u.role} /></td>
                          <td className="px-5 py-3 text-center font-black text-white">{u._count?.reservations ?? 0}</td>
                          <td className="px-5 py-3 text-xs text-white/70">{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {users.length === 0 && (
                  <p className="py-12 text-center text-sm text-white/70">No users yet.</p>
                )}
              </Surface>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black font-headline text-white">Users <span className="text-lg font-bold text-white/70">({usersData?.total ?? 0})</span></h2>
              <div className="flex flex-wrap gap-2">
                {['', 'CUSTOMER', 'BUSINESS_OWNER', 'ADMIN'].map(r => (
                  <button key={r} onClick={() => setUserFilter(r)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all border ${
                      userFilter === r
                        ? 'border-indigo-400/20 bg-indigo-500/15 text-indigo-200 shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}>
                    {r.replace('_', ' ') || 'All'}
                  </button>
                ))}
              </div>
            </div>

            <Surface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04]">
                      {['Name', 'Email', 'Phone', 'Role', 'Business', '# Bookings', 'Joined'].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white/70">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {users.map((u: any) => (
                      <tr key={u.id} className="transition-colors hover:bg-white/[0.04]">
                        <td className="px-5 py-3 whitespace-nowrap font-bold text-white">{u.firstName} {u.lastName}</td>
                        <td className="px-5 py-3 text-xs text-white/70">{u.email}</td>
                        <td className="px-5 py-3 text-xs text-white/70">{u.phone || '—'}</td>
                        <td className="px-5 py-3 whitespace-nowrap"><StatusBadge status={u.role} /></td>
                        <td className="max-w-[150px] truncate px-5 py-3 text-xs text-white/70">{u.business?.name || '—'}</td>
                        <td className="px-5 py-3 text-center font-black text-white">{u._count?.reservations ?? 0}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-white/70">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <p className="py-12 text-center text-sm text-white/70">No users found.</p>
              )}
            </Surface>
          </div>
        )}

        {tab === 'reservations' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="text-2xl font-black font-headline text-white">Reservations <span className="text-lg font-bold text-white/70">({reservationsData?.total ?? 0})</span></h2>
              <div className="flex flex-wrap gap-2">
                {['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all border ${
                      statusFilter === s
                        ? `${STATUS_COLORS[s]?.bg || 'rgba(129,140,248,0.08)'} ${STATUS_COLORS[s]?.text || 'text-indigo-200'} border-indigo-400/20 shadow-sm`
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}>
                    {s.replace('_', ' ') || 'All'}
                  </button>
                ))}
              </div>
            </div>

            <Surface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04]">
                      {['Customer', 'Business', 'Date', 'Time', 'Guests', 'Status', 'Deposit', 'Created'].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white/70">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {reservations.map((r: any) => (
                      <tr key={r.id} className="transition-colors hover:bg-white/[0.04]">
                        <td className="px-5 py-3 whitespace-nowrap font-bold text-white">{r.customer?.firstName} {r.customer?.lastName}</td>
                        <td className="max-w-[150px] truncate px-5 py-3 text-xs text-white/70">{r.business?.name}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm font-semibold text-white">{new Date(r.reservationDate).toLocaleDateString()}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-white/70">{r.reservationTime}</td>
                        <td className="px-5 py-3 text-center font-black text-white">{r.numberOfGuests}</td>
                        <td className="whitespace-nowrap px-5 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-5 py-3">
                          <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${r.depositStatus === 'PAID' ? 'border-purple-500/15 bg-purple-500/15 text-purple-300' : 'border-white/10 bg-white/5 text-white/70'}`}>
                            {r.depositStatus || 'NONE'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-white/70">{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reservations.length === 0 && (
                <p className="py-12 text-center text-sm text-white/70">No reservations found.</p>
              )}
            </Surface>
          </div>
        )}

        {tab === 'businesses' && (
          <div className="space-y-6 animate-fade-up">
            <h2 className="text-2xl font-black font-headline text-white">Businesses <span className="text-lg font-bold text-white/70">({businesses.length})</span></h2>

            <div className="grid gap-4 lg:grid-cols-1">
              {businesses.map((b: any) => (
                <Surface key={b.id} className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-500/10 bg-indigo-500/15 font-black text-xl text-indigo-300 shadow-sm">{b.name[0]}</div>
                    <div className="min-w-0">
                      <div className="mb-0.5 flex items-center gap-2">
                        <p className="truncate font-black text-lg tracking-tight text-white">{b.name}</p>
                        {b.isVerified && <CheckBadgeIcon className="h-5 w-5 shrink-0 text-purple-400 drop-shadow-sm" />}
                      </div>
                      <p className="mb-1.5 text-xs font-medium text-white/70">{b.category} · {b.address}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-medium text-white/70">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">Owner: {b.owner?.firstName} {b.owner?.lastName}</span>
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">{b._count?.reservations} bookings</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 self-end sm:self-center mt-2 sm:mt-0">
                    {!b.isVerified && (
                      <Button onClick={() => verifyMutation.mutate(b.id)} variant="default" className="flex items-center gap-1" type="button">
                        <CheckBadgeIcon className="h-4 w-4" /> Verify
                      </Button>
                    )}
                    <Badge tone={b.isActive ? 'success' : 'danger'} className="border border-white/10 shadow-sm">
                      {b.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                </Surface>
              ))}
              {businesses.length === 0 && (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                  <BuildingStorefrontIcon className="mx-auto mb-3 h-10 w-10 text-white/40" />
                  <p className="mb-1 text-sm font-bold text-white">No businesses yet</p>
                  <p className="text-xs font-medium text-white/70">Businesses registered on Pabandi will appear here.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'plugins' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black font-headline text-white">OpenWA Plugins</h2>
                <p className="text-sm font-medium text-white/70">Manage plugin enablement and config for customer-facing WhatsApp flows.</p>
              </div>
            </div>

            <div className="grid gap-4">
              {(pluginsData?.plugins || []).map((plugin: any) => (
                <Surface key={plugin.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="font-black text-lg tracking-tight text-white">{plugin.name}</p>
                        {plugin.version && (
                          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/70">
                            {plugin.version}
                          </span>
                        )}
                      </div>
                      <p className="mb-2 text-xs font-medium text-white/70">{plugin.description}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-medium text-white/70">
                        {plugin.homepage && <a href={plugin.homepage} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline">Homepage</a>}
                        {plugin.repoPath && <span>Repo: {plugin.repoPath}</span>}
                        <span className={`rounded-md border px-2 py-0.5 ${plugin.enabled ? 'border-indigo-400/15 bg-indigo-500/15 text-indigo-300' : 'border-red-500/15 bg-red-500/10 text-red-300'}`}>
                          {plugin.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => pluginToggle.mutate({ id: plugin.id, enabled: !plugin.enabled })}
                      variant={plugin.enabled ? 'outline' : 'default'}
                      className="sm:w-auto"
                      type="button"
                    >
                      {plugin.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </Surface>
              ))}

              {!pluginsData?.plugins?.length && (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                  <p className="mb-1 text-sm font-bold text-white">No plugins detected</p>
                  <p className="text-xs font-medium text-white/70">Plugins from the bundled OpenWA catalog will appear here.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'approvals' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black font-headline text-white">Profile Approvals</h2>
                <p className="text-sm font-medium text-white/70">Review and approve changes to user profiles.</p>
              </div>
            </div>

            <div className="grid gap-4">
              {(profileRequestsData?.requests || []).map((req: any) => (
                <Surface key={req.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="mb-1 text-lg font-bold text-white">
                      {req.user?.firstName} {req.user?.lastName} ({req.user?.email})
                    </p>
                    <div className="space-y-1 text-sm text-white/70">
                      {req.requestedChanges?.firstName && <p>New First Name: <strong className="text-white">{req.requestedChanges.firstName}</strong></p>}
                      {req.requestedChanges?.lastName && <p>New Last Name: <strong className="text-white">{req.requestedChanges.lastName}</strong></p>}
                      {req.requestedChanges?.profilePictureUrl && <p>New Photo URL: <strong className="text-white">{req.requestedChanges.profilePictureUrl}</strong></p>}
                    </div>
                    <p className="mt-2 text-xs text-white/70">Requested on {new Date(req.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button onClick={() => approveProfileMutation.mutate(req.id)} variant="default" type="submit">Approve</Button>
                    <Button onClick={() => rejectProfileMutation.mutate(req.id)} variant="outline">Reject</Button>
                  </div>
                </Surface>
              ))}

              {!(profileRequestsData?.requests?.length) && (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                  <p className="mb-1 text-sm font-bold text-white">No pending requests</p>
                  <p className="text-xs font-medium text-white/70">When users request profile changes, they will appear here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || { bg: 'rgba(255,255,255,0.04)', text: '#94a3b8' };
  return (
    <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm" style={{ background: cfg.bg, color: cfg.text }}>
      {status}
    </span>
  );
}
