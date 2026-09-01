import React, { useState, useEffect } from 'react';
import { Surface } from '../design-system';
import { tenantService } from '../services/api';

type Application = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  screeningBand?: string | null;
  depositAdjPct: number;
  decisionNotes?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

type Document = {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  category: string;
  createdAt: string;
};

const statusInfo: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: '📨 Submitted', color: '#6366f1' },
  UNDER_REVIEW: { label: '👀 Under review', color: '#f59e0b' },
  SCREENING: { label: '🔍 Screening', color: '#f59e0b' },
  APPROVED: { label: '✅ Approved', color: '#16a34a' },
  DENIED: { label: '❌ Denied', color: '#dc2626' },
  WITHDRAWN: { label: '🚪 Withdrawn', color: '#6b7280' },
};

const docCategoryIcon: Record<string, string> = {
  ID: '🪪', INCOME_PROOF: '💰', LEASE_AGREEMENT: '📄', BACKGROUND_CHECK: '🔍', OTHER: '📎',
};

export const TenantDashboardPage: React.FC = () => {
  const [tab, setTab] = useState<'applications' | 'documents'>('applications');
  const [apps, setApps] = useState<Application[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [err, setErr] = useState('');

  const load = () => {
    tenantService.dashboard()
      .then((r) => {
        setApps(r.data?.data?.applications || []);
        setDocs(r.data?.data?.documents || []);
      })
      .catch((e) => setErr(e?.response?.data?.error || 'Could not load dashboard'));
  };
  useEffect(load, []);

  return (
    <div style={page}>
      <div style={{ maxWidth: 800, width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>My Applications</h1>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Track your rental applications and documents.</p>

        <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
          {(['applications', 'documents'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 16px', borderRadius: 8, border: tab === t ? '2px solid #6366f1' : '1px solid rgba(139,92,246,0.3)', background: tab === t ? '#eef2ff' : 'transparent', color: tab === t ? '#6366f1' : '#888', fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {err && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{err}</div>}

        {tab === 'applications' && (
          <div style={{ display: 'grid', gap: 10 }}>
            {apps.length === 0 && <Surface><p style={{ color: '#888' }}>No applications yet. Apply to a listing to get started.</p></Surface>}
            {apps.map((a) => (
              <Surface key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.firstName || ''} {a.lastName || a.email}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>Applied {new Date(a.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: statusInfo[a.status]?.color || '#888' }}>
                      {statusInfo[a.status]?.label || a.status}
                    </div>
                    {a.screeningBand && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Band: {a.screeningBand}</div>}
                    {a.decisionNotes && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{a.decisionNotes}</div>}
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {tab === 'documents' && (
          <div style={{ display: 'grid', gap: 10 }}>
            {docs.length === 0 && <Surface><p style={{ color: '#888' }}>No documents yet.</p></Surface>}
            {docs.map((d) => (
              <Surface key={d.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{docCategoryIcon[d.category] || '📎'} {d.title}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{d.category} · {new Date(d.createdAt).toLocaleDateString()}</div>
                  </div>
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none' }}>View →</a>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const page: React.CSSProperties = {
  minHeight: '100vh', background: 'radial-gradient(800px 400px at 50% -10%, rgba(99,102,241,0.12), transparent 60%), #020617',
  color: 'var(--foreground)', padding: '40px 20px',
};

export default TenantDashboardPage;
