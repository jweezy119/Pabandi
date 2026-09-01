import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

export const ApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await propertyManagerService.dashboard();
      setApplications(res.data?.data?.applications || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    try {
      await propertyManagerService.updateApplication(id, { status, decisionNotes: notes });
      loadData();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to update');
    }
  };

  const statusColor: Record<string, string> = { PENDING: '#ca8a04', APPROVED: '#16a34a', DENIED: '#dc2626', WITHDRAWN: '#6b7280' };

  if (loading) return <div className="min-h-screen p-8" style={{ background: tokens.color.background, color: 'white' }}>Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">📋 Applications</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Review and process tenant applications</p>
          </div>
          <Link to="/property-manager" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to CRM</Link>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger }}>{err}</div>}

        {applications.length === 0 ? (
          <p className="text-center py-8" style={{ color: tokens.color.muted }}>No applications yet. Tenants can apply through your portal.</p>
        ) : (
          <div className="space-y-3">
            {applications.map(a => (
              <Surface key={a.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-bold text-slate-100">{a.firstName} {a.lastName}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{a.email} · Applied {new Date(a.createdAt).toLocaleDateString()}</div>
                  </div>
                  <Badge tone={a.status === 'APPROVED' ? 'success' : a.status === 'DENIED' ? 'danger' : 'info'}>{a.status}</Badge>
                </div>
                {a.message && <p className="text-sm mb-2" style={{ color: tokens.color.muted }}>"{a.message}"</p>}
                {a.screeningBand && (
                  <div className="flex items-center gap-3 text-xs mb-2">
                    <span style={{ color: statusColor[a.screeningBand] || '#888' }}>Screening: {a.screeningBand}</span>
                    {a.depositAdjPct > 0 && <span style={{ color: tokens.color.danger }}>+{a.depositAdjPct}% deposit</span>}
                  </div>
                )}
                {a.status === 'PENDING' && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => updateStatus(a.id, 'APPROVED')}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, 'DENIED')}>Deny</Button>
                  </div>
                )}
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationsPage;
