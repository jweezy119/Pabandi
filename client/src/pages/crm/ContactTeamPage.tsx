import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives/Button';
import { TeamList } from './components/TeamList';
import { TeamInviteModal } from './components/TeamInviteModal';
import { usePermissions } from '../../hooks/usePermissions';
import { getAuthToken } from '../../utils/authToken';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function ContactTeamPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  // Distinguishes "the request failed" from "there are no members", and gives the
  // invite form something to say when the server rejects it.
  const [loadFailed, setLoadFailed] = useState(false);
  /**
   * The roster controls.
   *
   * The directory had none: one table, creation order, no way to search, filter or
   * sort. An admin managing fifty people scrolled a single list to find one, and could
   * not ask "who is inactive" or "who has not taken a job in a fortnight".
   */
  const [rosterQuery, setRosterQuery] = useState({
    search: '', role: 'all', isActive: 'all', sortBy: 'name', sortOrder: 'asc', page: 1,
  });
  const [rosterTotal, setRosterTotal] = useState(0);
  const [rosterPages, setRosterPages] = useState(1);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { hasPermission, loading: permLoading } = usePermissions(businessId);
  const canManageTeam = hasPermission('ADMIN');

  useEffect(() => {
    if (businessId) {
      loadTeam();
    }
  }, [businessId, rosterQuery.search, rosterQuery.role, rosterQuery.isActive, rosterQuery.sortBy, rosterQuery.sortOrder, rosterQuery.page]);

  const loadTeam = async () => {
    try {
      const params = new URLSearchParams();
      if (businessId) params.set('businessId', businessId);
      if (rosterQuery.search) params.set('search', rosterQuery.search);
      if (rosterQuery.role !== 'all') params.set('role', rosterQuery.role);
      if (rosterQuery.isActive !== 'all') params.set('isActive', rosterQuery.isActive);
      if (rosterQuery.sortBy) params.set('sortBy', rosterQuery.sortBy);
      if (rosterQuery.sortOrder) params.set('sortOrder', rosterQuery.sortOrder);
      params.set('page', String(rosterQuery.page));
      params.set('limit', '25');

      const res = await fetch(`${API_BASE}/api/v1/team?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const body = await res.json();
        // The endpoint now answers `{ success, data, pagination }` rather than a bare
        // array. Reading it as an array set state to an object, and every `.map` over
        // members below would have thrown.
        setMembers(body.data || []);
        if (body.pagination) {
          setRosterTotal(body.pagination.total ?? 0);
          setRosterPages(body.pagination.totalPages ?? 1);
        }
        setLoadFailed(false);
      } else {
        // Previously this left `members` at whatever it was — normally [] — so a failed
        // request rendered "No team members found." A one-person team that briefly lost
        // its connection looked like an empty directory.
        setLoadFailed(true);
      }
    } catch (err) {
      console.error(err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (data: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/team/invite`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, businessId })
      });
      // `res.ok` was unchecked, so a rejected invite closed the modal and reloaded the
      // roster exactly like a successful one. The person watched their form vanish
      // with no invitation anywhere and nothing telling them it had failed.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setInviteError(body?.error || 'The invitation was not sent. Check the address and try again.');
        return;
      }
      setInviteError(null);
      setIsInviteOpen(false);
      loadTeam();
    } catch (err) {
      console.error(err);
      setInviteError('Could not reach the server. The invitation was not sent.');
    }
  };

  // Inside the layout, not a bare div. This was the only loading state in the CRM that
  // replaced the whole shell, so the sidebar and nav blinked out and back on every
  // visit — the page appeared to reload.
  if (permLoading || loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
        <div className="p-12 text-center text-[var(--soft-stone)]">Loading your team…</div>
      </DashboardLayout>
    );
  }
  if (!hasPermission('VIEWER')) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
        <div className="p-12 text-center text-[var(--rose)]">Access Denied: You do not have permission to view the team directory.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <div className="flex justify-between items-center clay-heading">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Team Directory</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage your team members and their roles</p>
          </div>
          {canManageTeam && (
            <Button variant="primary" icon="person_add" onClick={() => setIsInviteOpen(true)}>
              Invite Member
            </Button>
          )}
        </div>

        {inviteError && (
          <div className="p-3 rounded-xl bg-[var(--dusty-rose)]/15 text-[var(--dusty-rose)] text-sm">
            {inviteError}
          </div>
        )}

        {/* Roster controls. All of these were missing: the directory was one table in
            creation order with no way to narrow it. */}
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={rosterQuery.search}
            onChange={(e) => setRosterQuery((q) => ({ ...q, search: e.target.value, page: 1 }))}
            placeholder="Search name or email"
            aria-label="Search team"
            className="px-3 py-1.5 rounded-xl border border-[var(--soft-stone)]/40 text-sm"
          />
          <select
            value={rosterQuery.role}
            onChange={(e) => setRosterQuery((q) => ({ ...q, role: e.target.value, page: 1 }))}
            aria-label="Filter by role"
            className="px-3 py-1.5 rounded-xl border border-[var(--soft-stone)]/40 text-sm bg-white"
          >
            <option value="all">All roles</option>
            {['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={rosterQuery.isActive}
            onChange={(e) => setRosterQuery((q) => ({ ...q, isActive: e.target.value, page: 1 }))}
            aria-label="Filter by status"
            className="px-3 py-1.5 rounded-xl border border-[var(--soft-stone)]/40 text-sm bg-white"
          >
            <option value="all">Everyone</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select>
          <select
            value={rosterQuery.sortBy}
            onChange={(e) => setRosterQuery((q) => ({ ...q, sortBy: e.target.value, page: 1 }))}
            aria-label="Sort by"
            className="px-3 py-1.5 rounded-xl border border-[var(--soft-stone)]/40 text-sm bg-white"
          >
            <option value="name">Name</option>
            <option value="role">Role</option>
            <option value="reliabilityScore">Reliability</option>
            <option value="deliveryScore">Delivery score</option>
            <option value="payRate">Pay rate</option>
            <option value="lastBookingAt">Last job</option>
            <option value="createdAt">Joined</option>
          </select>
        </div>

        {rosterPages > 1 && (
          <div className="flex items-center justify-between text-xs text-[var(--soft-stone)]">
            <span>
              Page {rosterQuery.page} of {rosterPages} · {rosterTotal} member{rosterTotal === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={rosterQuery.page <= 1}
                onClick={() => setRosterQuery((q) => ({ ...q, page: q.page - 1 }))}
              >Prev</Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={rosterQuery.page >= rosterPages}
                onClick={() => setRosterQuery((q) => ({ ...q, page: q.page + 1 }))}
              >Next</Button>
            </div>
          </div>
        )}

        {loadFailed ? (
          <div className="p-12 text-center text-[var(--soft-stone)]">
            Could not load the team directory. This is a connection or permissions
            problem, not an empty team.
          </div>
        ) : (
          <TeamList
            members={members}
            onMemberClick={(id) => navigate(`/contact/team/${id}`)}
          />
        )}

        {canManageTeam && (
          <TeamInviteModal
            isOpen={isInviteOpen}
            onClose={() => setIsInviteOpen(false)}
            onInvite={handleInvite}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
