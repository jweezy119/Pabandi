import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  UserPlusIcon,
  BoltIcon,
  PlayIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUSES = [
  { value: 'NEW', label: 'New', color: '#6366f1', bg: '#6366f115' },
  { value: 'CONTACTED', label: 'Contacted', color: '#f59e0b', bg: '#f59e0b15' },
  { value: 'DEMO_SCHEDULED', label: 'Demo Scheduled', color: '#06b6d4', bg: '#06b6d415' },
  { value: 'ONBOARDED', label: 'Onboarded', color: '#10b981', bg: '#10b98115' },
  { value: 'NOT_INTERESTED', label: 'Not Interested', color: '#ef4444', bg: '#ef444415' },
];

const SAMPLE_TEMPLATES = [
  { id: 'intro', title: 'Intro', body: 'Hi {name}, Pabandi helps hospitality owners reduce no-shows with escrow-backed bookings.' },
  { id: 'followup', title: 'Follow-up', body: 'Hi {name}, following up from our last chat. Ready to activate checkout?' },
  { id: 'offer', title: 'Offer', body: 'Hi {name}, quick question: would onboarding support help you go live faster?' },
];

const PRESET_AUTOMATIONS = [
  {
    id: 'new_followup',
    title: 'New lead follow-up',
    description: 'After 15 min, send follow-up to new leads if unchanged.',
    triggerStatus: 'NEW',
    templateId: 'followup',
    delayMinutes: 15,
  },
  {
    id: 'onboard_celebration',
    title: 'Onboard celebration',
    description: 'When status becomes Onboarded, send a short congrats/next steps note.',
    triggerStatus: 'ONBOARDED',
    templateId: 'intro',
    delayMinutes: 30,
  },
  {
    id: 'nointerest_boost',
    title: 'Not interested lookback',
    description: 'After 7 days, re-evaluate not-interested leads with a value message.',
    triggerStatus: 'NOT_INTERESTED',
    templateId: 'offer',
    delayMinutes: 60,
  },
];

const QUICK_ACTIONS = [
  { id: 'book', label: 'Book', color: '#10b981' },
  { id: 'cancel', label: 'Cancel', color: '#ef4444' },
  { id: 'reschedule', label: 'Reschedule', color: '#f59e0b' },
  { id: 'update', label: 'Update', color: '#06b6d4' },
  { id: 'status', label: 'Status', color: '#6366f1' },
  { id: 'pay', label: 'Pay', color: '#8b5cf6' },
  { id: 'human', label: 'Human', color: '#ec4899' },
];

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
  byStatus: Record<string, number>; byCity: Record<string, number>;
}

const OutreachCRMPage: React.FC = () => {
  const { token } = useAuthStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [businessOnly, setBusinessOnly] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automations, setAutomations] = useState<{ triggerStatus: string; templateId: string; delayMinutes: number }[]>([]);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [smartResult, setSmartResult] = useState<string | null>(null);
  const [smartTesting, setSmartTesting] = useState(false);

  const authHeaders = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (cityFilter) params.set('city', cityFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (businessOnly) params.set('businessOnly', 'true');

      const [leadsRes, summaryRes] = await Promise.all([
        fetch(`${API}/api/v1/waitlist/leads?${params}`, { headers: authHeaders }),
        fetch(`${API}/api/v1/waitlist/outreach-summary`, { headers: authHeaders }),
      ]);
      const leadsData = await leadsRes.json();
      const summaryData = await summaryRes.json();
      if (leadsData.success) {
        setLeads(leadsData.leads || []);
        setSelected({});
      }
      if (summaryData.success) setSummary(summaryData.summary);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token, query, cityFilter, statusFilter, businessOnly, authHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedCount = useMemo(() => leads.filter(l => selected[l.id]).length, [leads, selected]);

  const updateLead = async (id: string, update: Record<string, unknown>) => {
    setSaving(true);
    await fetch(`${API}/api/v1/waitlist/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify(update),
    });
    setSaving(false);
    fetchData();
  };

  const sendTo = async (to: string, leadId: string) => {
    const clean = to.replace(/[^0-9]/g, '');
    if (!clean) return;
    setSaving(true);
    const res = await fetch(`${API}/api/v1/waitlist/lead/${encodeURIComponent(leadId)}/send-whatsapp`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ to: clean, sessionId: 'pabandi' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Send failed');
    await updateLead(leadId, { outreachStatus: 'CONTACTED', incrementAttempt: true, notes: `${leadId}: outreach sent via OpenWA.` });
  };

  const bulkSend = async () => {
    const selectedLeads = leads.filter(l => selected[l.id]);
    for (const lead of selectedLeads) {
      const template = SAMPLE_TEMPLATES.find(t => t.id === templateId);
      const body = template ? template.body.replace('{name}', lead.name || 'there') : '';
      if (!lead.phone && !body) continue;
      await sendTo(body ? body : lead.phone || '', lead.id);
    }
    setSelected({});
    setTemplateId('');
    alert('Bulk outreach queued.');
  };

  const statusInfo = (val: string) => STATUSES.find(s => s.value === val) || STATUSES[0];
  const cities = useMemo(() => Array.from(new Set(leads.map(l => l.city).filter(Boolean))) as string[], [leads]);
  const visibleLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(l => {
      if (q) {
        const hay = [l.name, l.businessName, l.phone, l.city, l.businessType].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (cityFilter && l.city !== cityFilter) return false;
      if (statusFilter && l.outreachStatus !== statusFilter) return false;
      if (businessOnly && !l.isBusinessLead) return false;
      return true;
    });
  }, [leads, query, cityFilter, statusFilter, businessOnly]);

  const exportCsv = () => {
    const header = 'id,name,phone,city,status,attempts,notes\n';
    const rows = visibleLeads.map(l => `${l.id},"${l.name}","${l.phone || ''}","${l.city || ''}",${l.outreachStatus},${l.outreachAttempts || 0},"${(l.notes || '').replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const loadPlugins = useCallback(async () => {
    const res = await fetch(`${API}/api/v1/openwa/plugins`, { headers: authHeaders });
    const data = await res.json();
    if (data.success) setPlugins(data.data || []);
  }, [authHeaders]);

  const saveAutomations = async () => {
    setSavingAutomation(true);
    await fetch(`${API}/api/v1/whatsapp/smart`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ automation: automations }) });
    setSavingAutomation(false);
    alert('Automation rules saved.');
  };

  const smartAction = async (leadId: string, intent: string) => {
    setSmartTesting(true);
    setSmartResult(null);
    const res = await fetch(`${API}/api/v1/waitlist/lead/${encodeURIComponent(leadId)}/smart-action`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ intent }),
    });
    const data = await res.json();
    setSmartTesting(false);
    if (!data.success) {
      setSmartResult(data.error || 'Smart action failed');
      return;
    }
    setSmartResult(data.reply || 'Smart action sent');
    await updateLead(leadId, { outreachStatus: data.status || 'CONTACTED', incrementAttempt: true });
  };

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Outreach CRM</h1>
            <p className="text-white/40 text-sm mt-1">Advanced lead management, automation, and WhatsApp smart actions.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAdvancedOpen(true)} className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-white/10 hover:border-white/25 text-white/70 hover:text-white">
              <BoltIcon className="w-4 h-4" /> Advanced
            </button>
            <button onClick={() => { setAutomationOpen(true); loadPlugins(); }} className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-white/10 hover:border-white/25 text-white/70 hover:text-white">
              <Cog6ToothIcon className="w-4 h-4" /> Automation
            </button>
            <button onClick={() => { setPluginsOpen(true); loadPlugins(); }} className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-white/10 hover:border-white/25 text-white/70 hover:text-white">
              <ClipboardDocumentCheckIcon className="w-4 h-4" /> Plugins
            </button>
            <button onClick={fetchData} className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors px-3 py-2 rounded-xl border border-white/10">
              <ArrowPathIcon className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

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

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/50 mb-1">Total Leads</p>
              <p className="text-4xl font-black text-white">{summary.total}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/50 mb-1">Business Leads</p>
              <p className="text-4xl font-black text-emerald-400">{summary.businessLeads}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/50 mb-1">Conversion</p>
              <p className="text-4xl font-black text-amber-400">{summary.conversionRate}%</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, business, phone" className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/30" />
          </div>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
            <input type="checkbox" checked={businessOnly} onChange={e => setBusinessOnly(e.target.checked)} className="rounded" />
            Business leads only
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white">
              <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
            </button>
            <span className="text-xs text-white/40">{selectedCount}/{leads.length} selected</span>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
            <span className="text-xs text-white/60 font-bold">{selectedCount} selected</span>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
              <option value="">Select template</option>
              {SAMPLE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button onClick={bulkSend} disabled={!templateId} className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40">
              <ChatBubbleLeftRightIcon className="w-4 h-4" /> Send Bulk
            </button>
            <div className="text-xs text-white/40">or open details for smart actions.</div>
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-white/30">Loading leads…</div>
          ) : visibleLeads.length === 0 ? (
            <div className="text-center py-24 text-white/30">
              <p className="mb-1">No leads found</p>
              <p className="text-xs text-white/40">Share landing pages or adjust filters to start outreach.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-widest">
                    <th className="px-5 py-4 font-semibold w-10">
                      <input type="checkbox" checked={visibleLeads.length > 0 && visibleLeads.every(l => selected[l.id])} onChange={e => {
                        const next: Record<string, boolean> = {};
                        if (e.target.checked) visibleLeads.forEach(l => next[l.id] = true);
                        setSelected(next);
                      }} />
                    </th>
                    <th className="px-5 py-4 font-semibold">Business</th>
                    <th className="px-5 py-4 font-semibold">City</th>
                    <th className="px-5 py-4 font-semibold">Phone</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Attempts</th>
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visibleLeads.map(lead => {
                    const si = statusInfo(lead.outreachStatus);
                    return (
                      <tr key={lead.id} className="hover:bg-white/[0.025] transition-colors">
                        <td className="px-5 py-4">
                          <input type="checkbox" checked={!!selected[lead.id]} onChange={e => setSelected({ ...selected, [lead.id]: e.target.checked })} />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-white text-sm">{lead.businessName || lead.name}</p>
                          <p className="text-xs text-white/40">{lead.businessType || lead.role}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-white/70">{lead.city || '—'}</td>
                        <td className="px-5 py-4 text-sm font-mono text-white/60">{lead.phone || '—'}</td>
                        <td className="px-5 py-4">
                          <select value={lead.outreachStatus} onChange={e => updateLead(lead.id, { outreachStatus: e.target.value })} className="text-xs font-bold px-2 py-1 rounded-full border cursor-pointer focus:outline-none" style={{ background: si.bg, color: si.color, borderColor: `${si.color}40` }}>
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-4 text-center text-white/50 text-sm">{lead.outreachAttempts || 0}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => { setActiveLead(lead); setNotes(lead.notes || ''); }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:border-white/20 transition-colors">Details</button>
                            <button onClick={() => sendTo(lead.phone || '', lead.id)} disabled={!lead.phone} title="Send WhatsApp via OpenWA" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors disabled:opacity-40">
                              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                            {QUICK_ACTIONS.map(action => (
                              <button key={action.id} onClick={() => smartAction(lead.id, action.id)} title={`Smart action: ${action.label}`} className="text-xs font-bold px-2.5 py-1.5 rounded-lg border hover:brightness-110 transition-colors" style={{ background: `${action.color}15`, color: action.color, borderColor: `${action.color}35` }}>
                                {action.label}
                              </button>
                            ))}
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

        {activeLead && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-white">{activeLead.businessName || activeLead.name}</h3>
                  <p className="text-white/40 text-xs">{activeLead.city} · {activeLead.phone}</p>
                </div>
                <button onClick={() => setActiveLead(null)} className="text-xs text-white/50 hover:text-white">Close</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3">
                  <p className="text-xs text-white/40 mb-1">Status</p>
                  <select value={activeLead.outreachStatus} onChange={e => updateLead(activeLead.id, { outreachStatus: e.target.value })} className="w-full bg-transparent text-sm font-bold text-white focus:outline-none">
                    {STATUSES.map(s => <option key={s.value} value={s.value} style={{ background: '#111', color: '#fff' }}>{s.label}</option>)}
                  </select>
                </div>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3">
                  <p className="text-xs text-white/40 mb-1">Attempts</p>
                  <p className="text-sm font-bold text-white">{activeLead.outreachAttempts || 0}</p>
                </div>
              </div>
              <label className="text-xs text-white/50 mb-1 block">Smart action</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_ACTIONS.map(action => (
                  <button key={action.id} onClick={() => { smartAction(activeLead.id, action.id).then(() => setActiveLead(null)); }} className="text-xs font-bold px-3 py-2 rounded-xl border hover:brightness-110" style={{ background: `${action.color}15`, color: action.color, borderColor: `${action.color}35` }}>
                    {action.label}
                  </button>
                ))}
              </div>
              <label className="text-xs text-white/50 mb-1 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} placeholder="Notes, call outcomes, follow-up reminders…" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/30 resize-none mb-4" />
              <div className="flex gap-3">
                <button onClick={async () => { await updateLead(activeLead.id, { notes }); setActiveLead(null); }} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setActiveLead(null)} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">Close</button>
              </div>
            </div>
          </div>
        )}

        {advancedOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BoltIcon className="w-5 h-5 text-white/70" />
                  <h3 className="font-black text-white">Advanced</h3>
                </div>
                <button onClick={() => { setAdvancedOpen(false); setSmartResult(null); }} className="text-xs text-white/50 hover:text-white">Close</button>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 mb-3">
                <p className="text-xs text-white/40 mb-2">WhatsApp smart capabilities</p>
                <p className="text-xs text-white/70 whitespace-pre-wrap">{JSON.stringify({ menu: true, book: true, cancel: true, reschedule: true, update: true, status: true, pay: true, human: true, faq: true, pluginAware: true }, null, 2)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 mb-3">
                <p className="text-xs text-white/40 mb-2">Live smart action</p>
                <label className="text-xs text-white/60 block mb-1">Lead ID</label>
                <input id="smartLeadId" placeholder="Paste lead ID" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/30 mb-2" />
                <label className="text-xs text-white/60 block mb-1">Intent</label>
                <select id="smartIntent" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                  {QUICK_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <button onClick={async () => {
                  const leadId = (document.getElementById('smartLeadId') as HTMLInputElement).value.trim();
                  const intent = (document.getElementById('smartIntent') as HTMLSelectElement).value;
                  if (!leadId) return;
                  await smartAction(leadId, intent);
                }} disabled={smartTesting} className="mt-2 flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50">
                  <PlayIcon className="w-4 h-4" /> Run smart action
                </button>
                {smartResult && <p className="text-xs text-white/70 mt-2">Result: {smartResult}</p>}
              </div>
              <p className="text-xs text-white/40">Advanced actions help move leads through automation, plugin-aware messaging, and fast manual overrides.</p>
            </div>
          </div>
        )}

        {pluginsOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="w-5 h-5 text-white/70" />
                  <h3 className="font-black text-white">Plugin Catalog</h3>
                </div>
                <button onClick={() => setPluginsOpen(false)} className="text-xs text-white/50 hover:text-white">Close</button>
              </div>
              {plugins.length === 0 && <p className="text-xs text-white/50">No plugins listed yet.</p>}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {plugins.map(plugin => (
                  <div key={plugin.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{plugin.name}</p>
                        <p className="text-xs text-white/40">{plugin.id} · {plugin.version}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-white/10 text-white/60">{plugin.status}</span>
                    </div>
                    {plugin.description && <p className="text-xs text-white/60 mt-2">{plugin.description}</p>}
                    {plugin.keywords?.length > 0 && <p className="text-[11px] text-white/35 mt-1">keywords: {(plugin.keywords as string[]).join(', ')}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {automationOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cog6ToothIcon className="w-5 h-5 text-white/70" />
                  <h3 className="font-black text-white">Automation</h3>
                </div>
                <button onClick={() => setAutomationOpen(false)} className="text-xs text-white/50 hover:text-white">Close</button>
              </div>
              <p className="text-xs text-white/50 mb-4">Start with a preset, then edit timing and templates.</p>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {PRESET_AUTOMATIONS.map(preset => (
                  <button key={preset.id} onClick={() => setAutomations([...automations, { triggerStatus: preset.triggerStatus, templateId: preset.templateId, delayMinutes: preset.delayMinutes }])} className="text-left bg-white/[0.03] border border-white/10 rounded-2xl p-3 hover:border-white/20 transition-colors">
                    <p className="text-sm font-bold text-white">{preset.title}</p>
                    <p className="text-xs text-white/50">{preset.description}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-3 mb-4">
                {automations.map((a, idx) => (
                  <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-white/50">When →</span>
                    <select value={a.triggerStatus} onChange={e => { const next = [...automations]; next[idx] = { ...next[idx], triggerStatus: e.target.value }; setAutomations(next); }} className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white">
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <span className="text-xs text-white/50">send</span>
                    <select value={a.templateId} onChange={e => { const next = [...automations]; next[idx] = { ...next[idx], templateId: e.target.value }; setAutomations(next); }} className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white">
                      <option value="">template</option>
                      {SAMPLE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                    <button onClick={() => setAutomations(automations.filter((_, i) => i !== idx))} className="text-xs text-red-300/80 hover:text-red-200">Remove</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setAutomations([...automations, { triggerStatus: 'NEW', templateId: '', delayMinutes: 60 }])} className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white">
                  <UserPlusIcon className="w-4 h-4" /> Add rule
                </button>
                <span className="text-xs text-white/40">Rules are saved per workspace.</span>
              </div>
              <div className="flex gap-3">
                <button onClick={saveAutomations} disabled={savingAutomation} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-50">{savingAutomation ? 'Saving…' : 'Save Automation'}</button>
                <button onClick={() => setAutomationOpen(false)} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutreachCRMPage;
