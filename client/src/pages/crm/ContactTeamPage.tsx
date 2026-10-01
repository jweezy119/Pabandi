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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (data: any) => {
    try {
      await fetch(`${API_BASE}/api/v1/team/invite`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, businessId })
      });
      setIsInviteOpen(false);
      loadTeam();
    } catch (err) {
      console.error(err);
    }
  };

  if (permLoading || loading) return <div>Loading...</div>;
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

        <TeamList 
          members={members} 
          onMemberClick={(id) => navigate(`/contact/team/${id}`)}
        />

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
