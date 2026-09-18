import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import {
  adminService,
  AdminStats,
  AdminUser,
  AdminBusiness,
  AdminReservation,
  AdminProperty,
  AdminTenant,
  AdminLease,
} from '../services/adminService';

type Tab = 'overview' | 'users' | 'businesses' | 'reservations' | 'properties' | 'tenants' | 'leases';

export const AdminDashboardPage = () => {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('overview');

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <Surface className="p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2" style={{ color: tokens.color.text }}>Access Denied</h1>
          <p className="mb-4" style={{ color: tokens.color.textMuted }}>You must be an administrator to view this page.</p>
          <Link to="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </Surface>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: tokens.color.text }}>Admin Dashboard</h1>
            <p className="text-sm" style={{ color: tokens.color.textMuted }}>Manage users, businesses, and reservations</p>
          </div>
          <div className="text-sm" style={{ color: tokens.color.textMuted }}>
            {user.firstName} {user.lastName}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          {(['overview', 'users', 'businesses', 'reservations', 'properties', 'tenants', 'leases'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                background: tab === t ? tokens.color.primary : 'rgba(255,255,255,0.05)',
                color: tab === t ? '#fff' : tokens.color.textMuted,
                border: tab === t ? 'none' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'businesses' && <BusinessesTab />}
        {tab === 'reservations' && <ReservationsTab />}
        {tab === 'properties' && <PropertiesTab />}
        {tab === 'tenants' && <TenantsTab />}
        {tab === 'leases' && <LeasesTab />}
      </div>
    </div>
  );
};

// ─── OVERVIEW ────────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.stats();
      setStats(res.data?.data || res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <Surface className="p-4">
      <div className="text-3xl font-bold" style={{ color }}>{loading ? '—' : value.toLocaleString()}</div>
      <div className="text-sm mt-1" style={{ color: tokens.color.textMuted }}>{label}</div>
    </Surface>
  );

  const funnel = stats?.funnel;
  const conversionRate = funnel && funnel.signedUp > 0
    ? ((funnel.madeReservation / funnel.signedUp) * 100).toFixed(1)
    : '0';

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={stats?.totals.users ?? 0} color={tokens.color.primary} />
        <StatCard label="Total Businesses" value={stats?.totals.businesses ?? 0} color={tokens.color.secondary} />
        <StatCard label="Total Reservations" value={stats?.totals.reservations ?? 0} color={tokens.color.accent} />
        <StatCard label="Completed Bookings" value={funnel?.completedBooking ?? 0} color={tokens.color.success} />
      </div>

      <Surface className="p-5">
        <h3 className="text-lg font-bold mb-4" style={{ color: tokens.color.text }}>Conversion Funnel</h3>
        <div className="space-y-3">
          <FunnelBar label="Signed Up" value={funnel?.signedUp ?? 0} max={funnel?.signedUp ?? 1} color={tokens.color.primary} />
          <FunnelBar label="Made Reservation" value={funnel?.madeReservation ?? 0} max={funnel?.signedUp ?? 1} color={tokens.color.accent} />
          <FunnelBar label="Completed Booking" value={funnel?.completedBooking ?? 0} max={funnel?.signedUp ?? 1} color={tokens.color.success} />
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: tokens.color.border }}>
          <span className="text-sm" style={{ color: tokens.color.textMuted }}>
            Booking conversion:{' '}
            <strong style={{ color: tokens.color.text }}>{conversionRate}%</strong>
          </span>
        </div>
      </Surface>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: tokens.color.textMuted }}>{label}</span>
        <span style={{ color: tokens.color.text }}>{value.toLocaleString()}</span>
      </div>
      <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── USERS ───────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (roleFilter) params.role = roleFilter;
      const res = await adminService.listUsers(params);
      setUsers(res.data?.data?.users || res.data?.users || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setUserDetail(null);
      return;
    }
    setExpanded(id);
    setUserDetail(null);
    try {
      const res = await adminService.getUser(id);
      setUserDetail(res.data?.data?.user || res.data?.user);
    } catch {
      // ignore
    }
  };

  const changeRole = async (id: string, newRole: string) => {
    try {
      await adminService.updateUserRole(id, newRole);
      load();
    } catch {
      // ignore
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await adminService.deleteUser(id);
      setConfirmDelete(null);
      load();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex gap-2">
          {['', 'USER', 'BUSINESS_OWNER', 'PROPERTY_MANAGER', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{
                background: roleFilter === r ? tokens.color.primary : 'rgba(255,255,255,0.05)',
                color: roleFilter === r ? '#fff' : tokens.color.textMuted,
              }}
            >
              {r || 'All'}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Name</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Email</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Role</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Bookings</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                expanded={expanded === u.id}
                detail={userDetail}
                onToggle={() => toggleExpand(u.id)}
                onChangeRole={(role) => changeRole(u.id, role)}
                onDelete={() => setConfirmDelete(u.id)}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && !loading && (
          <p className="text-center py-8" style={{ color: tokens.color.textMuted }}>No users found.</p>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {users.map((u) => (
          <Surface key={u.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium" style={{ color: tokens.color.text }}>
                  {u.firstName} {u.lastName}
                </div>
                <div className="text-xs" style={{ color: tokens.color.textMuted }}>{u.email}</div>
              </div>
              <Badge tone={u.role === 'ADMIN' ? 'danger' : u.role === 'BUSINESS_OWNER' ? 'success' : 'info'}>
                {u.role}
              </Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => toggleExpand(u.id)}>
                {expanded === u.id ? 'Collapse' : 'Details'}
              </Button>
              {u.role !== 'ADMIN' && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(u.id)} style={{ color: tokens.color.danger }}>
                  Delete
                </Button>
              )}
            </div>
            {expanded === u.id && userDetail && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: tokens.color.border }}>
                <UserDetailView user={userDetail} onChangeRole={(role) => changeRole(u.id, role)} />
              </div>
            )}
          </Surface>
        ))}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete User"
          message="Are you sure? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => deleteUser(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function UserRow({
  user: u,
  expanded,
  detail,
  onToggle,
  onChangeRole,
  onDelete,
}: {
  user: AdminUser;
  expanded: boolean;
  detail: any;
  onToggle: () => void;
  onChangeRole: (role: string) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
        <td className="py-3 px-2" style={{ color: tokens.color.text }}>
          {u.firstName} {u.lastName}
        </td>
        <td className="py-3 px-2" style={{ color: tokens.color.textMuted }}>{u.email}</td>
        <td className="py-3 px-2">
          <Badge tone={u.role === 'ADMIN' ? 'danger' : u.role === 'BUSINESS_OWNER' ? 'success' : 'info'}>
            {u.role}
          </Badge>
        </td>
        <td className="py-3 px-2" style={{ color: tokens.color.text }}>
          {u._count?.reservations ?? 0}
        </td>
        <td className="py-3 px-2">
          <div className="flex gap-2 items-center">
            <select
              value={u.role}
              onChange={(e) => onChangeRole(e.target.value)}
              className="text-xs rounded-lg px-2 py-1"
              style={{ background: tokens.color.surfaceContainer, color: tokens.color.text, border: `1px solid ${tokens.color.border}` }}
            >
              {['USER', 'BUSINESS_OWNER', 'PROPERTY_MANAGER', 'ADMIN'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {expanded ? 'Collapse' : 'Details'}
            </Button>
            {u.role !== 'ADMIN' && (
              <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: tokens.color.danger }}>
                Delete
              </Button>
            )}
          </div>
        </td>
      </tr>
      {expanded && detail && (
        <tr>
          <td colSpan={5} className="py-3 px-2">
            <UserDetailView user={detail} onChangeRole={onChangeRole} />
          </td>
        </tr>
      )}
    </>
  );
}

function UserDetailView({ user, onChangeRole }: { user: any; onChangeRole: (role: string) => void }) {
  return (
    <div className="space-y-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span style={{ color: tokens.color.textMuted }}>Email: </span>
          <span style={{ color: tokens.color.text }}>{user.email}</span>
        </div>
        <div>
          <span style={{ color: tokens.color.textMuted }}>Phone: </span>
          <span style={{ color: tokens.color.text }}>{user.phone || '—'}</span>
        </div>
        <div>
          <span style={{ color: tokens.color.textMuted }}>Verified: </span>
          <span style={{ color: user.isEmailVerified ? tokens.color.success : tokens.color.warning }}>
            {user.isEmailVerified ? 'Yes' : 'No'}
          </span>
        </div>
        <div>
          <span style={{ color: tokens.color.textMuted }}>Joined: </span>
          <span style={{ color: tokens.color.text }}>
            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>

      {user.business && (
        <div className="pt-2 border-t" style={{ borderColor: tokens.color.border }}>
          <span className="text-xs font-semibold" style={{ color: tokens.color.textMuted }}>Business: </span>
          <span className="text-sm" style={{ color: tokens.color.text }}>
            {user.business.name}
            {user.business.isVerified && (
              <Badge tone="success" className="ml-2">Verified</Badge>
            )}
          </span>
        </div>
      )}

      {user.reservations && user.reservations.length > 0 && (
        <div className="pt-2 border-t" style={{ borderColor: tokens.color.border }}>
          <div className="text-xs font-semibold mb-2" style={{ color: tokens.color.textMuted }}>Recent Reservations</div>
          <div className="space-y-1">
            {user.reservations.slice(0, 5).map((r: any) => (
              <div key={r.id} className="text-xs flex justify-between" style={{ color: tokens.color.textMuted }}>
                <span>{r.business?.name || 'Unknown'}</span>
                <Badge tone={r.status === 'COMPLETED' ? 'success' : r.status === 'CANCELLED' ? 'danger' : 'info'}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t flex gap-2 items-center" style={{ borderColor: tokens.color.border }}>
        <span className="text-xs" style={{ color: tokens.color.textMuted }}>Change Role:</span>
        <select
          value={user.role}
          onChange={(e) => onChangeRole(e.target.value)}
          className="text-xs rounded-lg px-2 py-1"
          style={{ background: tokens.color.surfaceContainer, color: tokens.color.text, border: `1px solid ${tokens.color.border}` }}
        >
          {['USER', 'BUSINESS_OWNER', 'PROPERTY_MANAGER', 'ADMIN'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── BUSINESSES ──────────────────────────────────────────────────────────────

function BusinessesTab() {
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(undefined);
  const [editBusiness, setEditBusiness] = useState<AdminBusiness | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (verifiedFilter !== undefined) params.verified = verifiedFilter;
      const res = await adminService.listBusinesses(params);
      setBusinesses(res.data?.data?.businesses || res.data?.businesses || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [verifiedFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleVerify = async (id: string) => {
    try {
      await adminService.verifyBusiness(id);
      load();
    } catch {
      // ignore
    }
  };

  const updateBusiness = async (data: Partial<AdminBusiness>) => {
    if (!editBusiness) return;
    try {
      await adminService.updateBusiness(editBusiness.id, data);
      setEditBusiness(null);
      load();
    } catch {
      // ignore
    }
  };

  const deleteBusiness = async (id: string) => {
    try {
      await adminService.deleteBusiness(id);
      setConfirmDelete(null);
      load();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex gap-2">
          {[{ label: 'All', value: undefined }, { label: 'Verified', value: true }, { label: 'Unverified', value: false }].map((f) => (
            <button
              key={String(f.value)}
              onClick={() => setVerifiedFilter(f.value)}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{
                background: verifiedFilter === f.value ? tokens.color.primary : 'rgba(255,255,255,0.05)',
                color: verifiedFilter === f.value ? '#fff' : tokens.color.textMuted,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Name</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Category</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Owner</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Verified</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                <td className="py-3 px-2" style={{ color: tokens.color.text }}>{b.name}</td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {b.category || '—'}
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {b.owner ? `${b.owner.firstName} ${b.owner.lastName}` : '—'}
                </td>
                <td className="py-3 px-2">
                  {b.isVerified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => toggleVerify(b.id)}>
                      Verify
                    </Button>
                  )}
                </td>
                <td className="py-3 px-2">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditBusiness(b)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(b.id)} style={{ color: tokens.color.danger }}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {businesses.length === 0 && !loading && (
          <p className="text-center py-8" style={{ color: tokens.color.textMuted }}>No businesses found.</p>
        )}
      </div>

      {/* Edit Modal */}
      {editBusiness && (
        <EditBusinessModal
          business={editBusiness}
          onSave={updateBusiness}
          onClose={() => setEditBusiness(null)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Business"
          message="Are you sure? This will soft-delete the business."
          confirmLabel="Delete"
          onConfirm={() => deleteBusiness(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function EditBusinessModal({
  business,
  onSave,
  onClose,
}: {
  business: AdminBusiness;
  onSave: (data: Partial<AdminBusiness>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: business.name || '',
    category: business.category || '',
    description: business.description || '',
    lat: business.lat ?? 0,
    lng: business.lng ?? 0,
    status: business.status || 'ACTIVE',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <Surface className="p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4" style={{ color: tokens.color.text }}>Edit Business</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: tokens.color.textMuted }}>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: tokens.color.textMuted }}>Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: tokens.color.textMuted }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: tokens.color.textMuted }}>Lat</label>
              <input
                type="number"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: tokens.color.textMuted }}>Lng</label>
              <input
                type="number"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: tokens.color.textMuted }}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
            >
              {['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="primary" className="flex-1" onClick={() => onSave(form)}>Save</Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        </div>
      </Surface>
    </div>
  );
}

// ─── RESERVATIONS ────────────────────────────────────────────────────────────

function ReservationsTab() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await adminService.listReservations(params);
      setReservations(res.data?.data?.reservations || res.data?.reservations || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const statusTone = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success' as const;
      case 'CANCELLED': return 'danger' as const;
      case 'NO_SHOW': return 'danger' as const;
      case 'CONFIRMED': return 'info' as const;
      default: return 'warning' as const;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{
                background: statusFilter === s ? tokens.color.primary : 'rgba(255,255,255,0.05)',
                color: statusFilter === s ? '#fff' : tokens.color.textMuted,
              }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Business</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Customer</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Date</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                <td className="py-3 px-2" style={{ color: tokens.color.text }}>
                  {r.business?.name || 'Unknown'}
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : '—'}
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {r.date ? new Date(r.date).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-2">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reservations.length === 0 && !loading && (
          <p className="text-center py-8" style={{ color: tokens.color.textMuted }}>No reservations found.</p>
        )}
      </div>
    </div>
  );
}

// ─── PROPERTIES ──────────────────────────────────────────────────────────────

function PropertiesTab() {
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listProperties();
      setProperties(res.data?.data?.properties || res.data?.properties || res.data?.data || res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Property</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Manager</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Tenants</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p: any) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                <td className="py-3 px-2" style={{ color: tokens.color.text }}>{p.name || p.address || 'Unnamed'}</td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : '—'}
                </td>
                <td className="py-3 px-2" style={{ color: tokens.color.text }}>
                  {p._count?.tenants ?? p.tenantCount ?? 0}
                </td>
                <td className="py-3 px-2">
                  <Badge tone={p.status === 'ACTIVE' ? 'success' : p.status === 'VACANT' ? 'warning' : 'info'}>
                    {p.status || 'ACTIVE'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {properties.length === 0 && !loading && (
          <p className="text-center py-8" style={{ color: tokens.color.textMuted }}>No properties found.</p>
        )}
      </div>
    </div>
  );
}

// ─── TENANTS ─────────────────────────────────────────────────────────────────

function TenantsTab() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listTenants();
      setTenants(res.data?.data?.tenants || res.data?.tenants || res.data?.data || res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const riskTone = (band?: string) => {
    switch (band) {
      case 'LOW': return 'success' as const;
      case 'MEDIUM': return 'warning' as const;
      case 'HIGH': return 'danger' as const;
      default: return 'info' as const;
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Name</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Email</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Risk Band</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Property</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t: any) => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                <td className="py-3 px-2" style={{ color: tokens.color.text }}>
                  {t.firstName || t.name ? `${t.firstName || ''} ${t.lastName || ''}`.trim() : '—'}
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {t.email || '—'}
                </td>
                <td className="py-3 px-2">
                  <Badge tone={riskTone(t.riskBand)}>{t.riskBand || 'N/A'}</Badge>
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {t.property?.name || t.propertyName || '—'}
                </td>
                <td className="py-3 px-2">
                  <Badge tone={t.status === 'ACTIVE' ? 'success' : t.status === 'APPLIED' ? 'warning' : 'info'}>
                    {t.status || '—'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && !loading && (
          <p className="text-center py-8" style={{ color: tokens.color.textMuted }}>No tenants found.</p>
        )}
      </div>
    </div>
  );
}

// ─── LEASES ──────────────────────────────────────────────────────────────────

function LeasesTab() {
  const [leases, setLeases] = useState<AdminLease[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listLeases();
      setLeases(res.data?.data?.leases || res.data?.leases || res.data?.data || res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusTone = (status?: string) => {
    switch (status) {
      case 'ACTIVE': return 'success' as const;
      case 'EXPIRED': return 'danger' as const;
      case 'TERMINATED': return 'danger' as const;
      case 'PENDING': return 'warning' as const;
      default: return 'info' as const;
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Tenant</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Property</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>Start</th>
              <th className="text-left py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>End</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Rent</th>
              <th className="text-left py-3 px-2" style={{ color: tokens.color.textMuted }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {leases.map((l: any) => (
              <tr key={l.id} style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                <td className="py-3 px-2" style={{ color: tokens.color.text }}>
                  {l.tenant ? `${l.tenant.firstName || ''} ${l.tenant.lastName || ''}`.trim() : '—'}
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {l.property?.name || l.propertyName || '—'}
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {l.startDate ? new Date(l.startDate).toLocaleDateString() : '—'}
                </td>
                <td className="py-3 px-2 hidden md:table-cell" style={{ color: tokens.color.textMuted }}>
                  {l.endDate ? new Date(l.endDate).toLocaleDateString() : '—'}
                </td>
                <td className="py-3 px-2" style={{ color: tokens.color.text }}>
                  {l.rentAmount ? `$${l.rentAmount}` : '—'}
                </td>
                <td className="py-3 px-2">
                  <Badge tone={statusTone(l.status)}>{l.status || '—'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leases.length === 0 && !loading && (
          <p className="text-center py-8" style={{ color: tokens.color.textMuted }}>No leases found.</p>
        )}
      </div>
    </div>
  );
}

// ─── CONFIRM DIALOG ──────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <Surface className="p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-2" style={{ color: tokens.color.text }}>{title}</h3>
        <p className="text-sm mb-4" style={{ color: tokens.color.textMuted }}>{message}</p>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={onConfirm}>{confirmLabel}</Button>
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        </div>
      </Surface>
    </div>
  );
}

export default AdminDashboardPage;
