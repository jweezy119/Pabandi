import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  PhoneIcon, BuildingStorefrontIcon, CheckCircleIcon,
  ClockIcon, XCircleIcon, CalendarIcon, FunnelIcon,
  ArrowPathIcon, ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUSES = [
  { value: 'NEW',            label: 'New',            color: '#6366f1', bg: '#6366f115', icon: <ClockIcon className="w-4 h-4" /> },
  { value: 'CONTACTED',      label: 'Contacted',       color: '#f59e0b', bg: '#f59e0b15', icon: <PhoneIcon className="w-4 h-4" /> },
  { value: 'DEMO_SCHEDULED', label: 'Demo Scheduled',  color: '#06b6d4', bg: '#06b6d415', icon: <CalendarIcon className="w-4 h-4" /> },
  { value: 'ONBOARDED',      label: 'Onboarded ✓',    color: '#10b981', bg: '#10b98115', icon: <CheckCircleIcon className="w-4 h-4" /> },
  { value: 'NOT_INTERESTED', label: 'Not Interested',  color: '#ef4444', bg: '#ef444415', icon: <XCircleIcon className="w-4 h-4" /> },
];

const WA_TEMPLATES: Record<string, string> = {
  karachi: `Hello {name}! 🙏\n\nI'm reaching out from Pabandi — the world's first Portable Reliability Layer, launching exclusively in your area this month.\n\nWe're eliminating Cash-on-Delivery (COD) rejections and fake orders using a blockchain escrow system — zero interest, 100% Sharia-compliant.\n\n✅ Free to join\n✅ No credit card required\n✅ Verified trust scores for every buyer\n\nWould you be open to a quick 10-minute WhatsApp call to see how it works for {businessName}?\n\npabandi-42c5b.web.app/karachi`,
  lahore: `Hello {name}! 🙏\n\nI'm reaching out from Pabandi — the world's first Portable Reliability Layer, launching exclusively in your area this month.\n\nWe're eliminating Cash-on-Delivery (COD) rejections and fake orders using a blockchain escrow system — zero interest, 100% Sharia-compliant.\n\n✅ Free to join\n✅ No credit card required\n✅ Verified trust scores for every buyer\n\nWould you be open to a quick 10-minute WhatsApp call to see how it works for {businessName}?\n\npabandi-42c5b.web.app/lahore`,
  default: `Hello {name}! 👋\n\nI'm reaching out from Pabandi — a reliability layer that eliminates COD rejections and no-shows using Web3 reputation technology.\n\nFree to join. Would love to show you how it works for {businessName}.\n\npabandi-42c5b.web.app`,
};

function buildTemplate(city: string, name: string, businessName: string): string {
  const template = WA_TEMPLATES[city?.toLowerCase()] || WA_TEMPLATES.default;
  return template.replace(/{name}/g, name || 'there').replace(/{businessName}/g, businessName || 'your business');
}

interface Lead {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  role: string;
  businessName?: string;
  businessType?: string;
  outreachStatus: string;
  outreachAttempts: number;
  lastContactedAt?: string;
  notes?: string;
  createdAt: string;
  isBusinessLead: boolean;
}

interface Summary {
  total: number; businessLeads: number; conversionRate: string;
  byStatus: Record<string, number>;
  byCity: Record<string, number>;
}

export const OutreachCRMPage: React.FC = () => {
  const { token } = useAuthStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [businessOnly, setBusinessOnly] = useState(true);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const params = new URLSearchParams();
      if (cityFilter) params.set('city', cityFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (businessOnly) params.set('businessOnly', 'true');

      const [leadsRes, summaryRes] = await Promise.all([
        fetch(`${API}/api/v1/waitlist/leads?${params}`, { headers }),
        fetch(`${API}/api/v1/waitlist/outreach-summary`, { headers }),
      ]);
      const leadsData = await leadsRes.json();
      const summaryData = await summaryRes.json();
      if (leadsData.success) setLeads(leadsData.leads);
      if (summaryData.success) setSummary(summaryData.summary);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token, cityFilter, statusFilter, businessOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateLead = async (id: string, update: Record<string, any>) => {
    setSaving(true);
    await fetch(`${API}/api/v1/waitlist/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(update),
    });
    setSaving(false);
    fetchData();
  };

  const openWhatsApp = (lead: Lead) => {
    const msg = encodeURIComponent(buildTemplate(lead.city || '', lead.name, lead.businessName || ''));
    const phone = (lead.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    updateLead(lead.id, { outreachStatus: 'CONTACTED', incrementAttempt: true });
  };

  const statusInfo = (val: string) => STATUSES.find(s => s.value === val) || STATUSES[0];

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight">B2B Outreach CRM</h1>
            <p className="text-white/40 text-sm mt-1">Karachi & Lahore Business Onboarding Pipeline</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors px-3 py-2 rounded-lg border border-white/10 hover:border-white/20">
            <ArrowPathIcon className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* KPI Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {STATUSES.map(s => (
              <div key={s.value} className="rounded-2xl p-4 border" style={{ background: s.bg, borderColor: `${s.color}30` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: s.color }}>{s.label}</p>
                <p className="text-3xl font-black text-white">{summary.byStatus[s.value] || 0}</p>
              </div>
            ))}
          </div>
        )}

        {/* Funnel Stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xs text-white/40 mb-1">Total Leads</p>
              <p className="text-4xl font-black text-white">{summary.total}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xs text-white/40 mb-1">Business Leads</p>
              <p className="text-4xl font-black text-emerald-400">{summary.businessLeads}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xs text-white/40 mb-1">Conversion Rate</p>
              <p className="text-4xl font-black text-amber-400">{summary.conversionRate}%</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 text-white/50 text-xs"><FunnelIcon className="w-4 h-4" /> Filter by:</div>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30">
            <option value="">All Cities</option>
            <option value="Karachi">Karachi</option>
            <option value="Lahore">Lahore</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <input type="checkbox" checked={businessOnly} onChange={e => setBusinessOnly(e.target.checked)} className="rounded" />
            Business leads only
          </label>
        </div>

        {/* Leads Table */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-white/30">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <BuildingStorefrontIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No leads yet. Share the Karachi & Lahore landing pages to start collecting!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-widest">
                    <th className="px-5 py-4 font-semibold">Business</th>
                    <th className="px-5 py-4 font-semibold">City</th>
                    <th className="px-5 py-4 font-semibold">Phone</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Attempts</th>
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leads.map(lead => {
                    const si = statusInfo(lead.outreachStatus);
                    return (
                      <tr key={lead.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-white text-sm">{lead.businessName || lead.name}</p>
                          <p className="text-xs text-white/40">{lead.businessType || lead.role}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-white/70">{lead.city || '—'}</td>
                        <td className="px-5 py-4 text-sm font-mono text-white/60">{lead.phone || '—'}</td>
                        <td className="px-5 py-4">
                          <select
                            value={lead.outreachStatus}
                            onChange={e => updateLead(lead.id, { outreachStatus: e.target.value })}
                            className="text-xs font-bold px-2 py-1 rounded-full border cursor-pointer focus:outline-none"
                            style={{ background: si.bg, color: si.color, borderColor: `${si.color}40` }}
                          >
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-4 text-center text-white/50 text-sm">{lead.outreachAttempts || 0}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openWhatsApp(lead)}
                              title="Open WhatsApp with pre-filled message"
                              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors"
                            >
                              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                            <button
                              onClick={() => { setActiveLead(lead); setNotes(lead.notes || ''); }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:border-white/20 transition-colors"
                            >
                              Notes
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Notes Modal */}
      {activeLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-md">
            <h3 className="font-black text-white mb-1">{activeLead.businessName || activeLead.name}</h3>
            <p className="text-white/40 text-xs mb-4">{activeLead.city} · {activeLead.phone}</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="Add notes, call outcomes, follow-up reminders..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/30 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await updateLead(activeLead.id, { notes });
                  setActiveLead(null);
                }}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
              <button onClick={() => setActiveLead(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutreachCRMPage;
