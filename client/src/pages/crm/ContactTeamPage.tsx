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
  const [inviteError, setInviteError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { hasPermission, loading: permLoading } = usePermissions(businessId);
  const canManageTeam = hasPermission('ADMIN');

  useEffect(() => {
    if (businessId) {
      loadTeam();
    }
  }, [businessId]);

  const loadTeam = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/team?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) {
        setMembers(await res.json());
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
