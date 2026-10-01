import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives/Button';
import { Chip } from '../../components/primitives/Chip';
import { TeamMemberForm } from './components/TeamMemberForm';
import { usePermissions } from '../../hooks/usePermissions';
import { TrustPanel } from '../../components/TrustPanel';
import { getAuthToken } from '../../utils/authToken';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function ContactTeamMemberPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const businessId = localStorage.getItem('businessId') || '';
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { hasPermission } = usePermissions(businessId);
  const canManageTeam = hasPermission('ADMIN');

  useEffect(() => {
    if (businessId && id) {
      loadMember();
    }
  }, [businessId, id]);

  const loadMember = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/team/${id}?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) {
        setMember(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      await fetch(`${API_BASE}/api/v1/team/${id}/role`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, businessId })
      });
      loadMember();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Are you sure you want to deactivate this member?")) return;
    try {
      await fetch(`${API_BASE}/api/v1/team/${id}/deactivate?businessId=${businessId}`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      loadMember();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!hasPermission('VIEWER')) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
        <div className="p-12 text-center text-[var(--rose)]">Access Denied</div>
      </DashboardLayout>
    );
  }
  if (!member) return <div>Member not found</div>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <Button variant="ghost" icon="arrow_back" onClick={() => navigate('/contact/team')}>
          Back to Team
        </Button>

        <div className="clay-heading flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-[var(--warm-ink)] mb-2">{member.name}</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--soft-stone)]">{member.email}</span>
              <Chip label={member.role} variant="default" size="sm" />
              <Chip label={member.isActive ? 'Active' : 'Inactive'} variant={member.isActive ? 'success' : 'stone'} size="sm" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <TrustPanel passportId={member.passportId} />
            <div className="bg-white p-6 rounded-2xl border border-[var(--warm-sand)] flex justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Reliability Score</div>
                <div className="text-3xl font-bold text-[var(--warm-ink)]">{member.reliabilityScore}%</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Delivery Score</div>
                <div className="text-3xl font-bold text-[var(--warm-ink)]">{member.deliveryScore}%</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--warm-sand)] overflow-hidden">
              <div className="p-4 border-b border-[var(--warm-sand)] bg-[var(--warm-sand)]/20">
                <h3 className="font-semibold text-[var(--warm-ink)]">Assigned Jobs</h3>
              </div>
              <div className="divide-y divide-[var(--warm-sand)]">
                {member.jobs?.length > 0 ? member.jobs.map((job: any) => (
                  <div key={job.id} className="p-4 flex justify-between items-center hover:bg-[var(--warm-sand)]/10 cursor-pointer">
                    <div>
                      <div className="font-medium text-[var(--warm-ink)]">{job.title}</div>
                    </div>
                    <Chip label={job.status} variant="info" size="sm" />
                  </div>
                )) : (
                  <div className="p-8 text-center text-[var(--soft-stone)]">No jobs assigned</div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-1 space-y-6">
            {canManageTeam && (
              <TeamMemberForm 
                member={member}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
