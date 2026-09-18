import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { crmService } from '../services/api';

type Contact = { id: string; firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; title?: string; source?: string; status: string; tags: string[]; createdAt: string };
type Deal = { id: string; title: string; description?: string; value: number; currency: string; stage: string; probability: number; expectedCloseDate?: string; closedAt?: string; lostReason?: string; contact?: Contact; createdAt: string };
type Campaign = { id: string; name: string; description?: string; type: string; status: string; sentCount: number; openCount: number; clickCount: number; replyCount: number; scheduledAt?: string; createdAt: string };
type Pipeline = { stage: string; count: number; value: number }[];

export const SalesCRMPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'contacts' | 'deals' | 'pipeline' | 'campaigns'>('contacts');
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: 'WEBSITE', status: 'LEAD' });
  const [dealForm, setDealForm] = useState({ title: '', description: '', value: '', stage: 'LEAD', probability: 0, expectedCloseDate: '' });
  const [campaignForm, setCampaignForm] = useState({ name: '', description: '', type: 'EMAIL', subject: '', body: '', scheduledAt: '' });

  const load = async () => {
    setLoading(true);
    try {
      const emptyContacts = { data: { data: [] } };
      const emptyDeals = { data: { data: [] } };
      const emptyPipeline = { data: { data: { pipeline: [] } } };
      const emptyCampaigns = { data: { data: [] } };
      const [contactsRes, dealsRes, pipelineRes, campaignsRes] = await Promise.all([
        crmService.contacts().catch(() => emptyContacts),
        crmService.deals().catch(() => emptyDeals),
        crmService.pipeline().catch(() => emptyPipeline),
        crmService.campaigns().catch(() => emptyCampaigns),
      ]);
      setContacts(contactsRes.data?.data || []);
      setDeals(dealsRes.data?.data || []);
      setPipeline(pipelineRes.data?.data?.pipeline || []);
      setCampaigns(campaignsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load CRM data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addContact = async () => {
    if (!contactForm.email && !contactForm.firstName) return;
    try {
      await crmService.createContact(contactForm);
      setContactForm({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: 'WEBSITE', status: 'LEAD' });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not add contact');
    }
  };

  const addDeal = async () => {
    if (!dealForm.title) return;
    try {
      await crmService.createDeal({ ...dealForm, value: Number(dealForm.value) || 0 });
      setDealForm({ title: '', description: '', value: '', stage: 'LEAD', probability: 0, expectedCloseDate: '' });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not add deal');
    }
  };

  const createCampaign = async () => {
    if (!campaignForm.name) return;
    try {
      await crmService.createCampaign(campaignForm);
      setCampaignForm({ name: '', description: '', type: 'EMAIL', subject: '', body: '', scheduledAt: '' });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create campaign');
    }
  };

  const sendCampaign = async (campaignId: string) => {
    try {
      await crmService.sendCampaign(campaignId);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not send campaign');
    }
  };

  const stageTone: Record<string, 'info' | 'success' | 'warning' | 'danger'> = { LEAD: 'info', QUALIFIED: 'info', PROPOSAL: 'warning', NEGOTIATION: 'warning', WON: 'success', LOST: 'danger' };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ color: tokens.color.textDim }}>Loading CRM…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0 mt-16" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-headline text-slate-100">Sales CRM</h1>
          <p className="text-sm mt-1" style={{ color: tokens.color.textDim }}>Manage contacts, deals, campaigns, and your sales pipeline.</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['contacts', 'deals', 'pipeline', 'campaigns'] as const).map(s => (
            <button key={s} onClick={() => setTab(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === s ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {s === 'contacts' ? '👥 Contacts' : s === 'deals' ? '💼 Deals' : s === 'pipeline' ? '📊 Pipeline' : '📧 Campaigns'}
            </button>
          ))}
        </div>

        {tab === 'contacts' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Add Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={contactForm.firstName} onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })} placeholder="First name" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={contactForm.lastName} onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })} placeholder="Last name" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="Email" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="Phone" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} placeholder="Company" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={contactForm.status} onChange={e => setContactForm({ ...contactForm, status: e.target.value })} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="LEAD">Lead</option>
                  <option value="PROSPECT">Prospect</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="CHURNED">Churned</option>
                </select>
              </div>
              <Button onClick={addContact} className="mt-4">Add Contact</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.map(c => (
                <Surface key={c.id} className="p-4">
                  <div className="font-semibold text-slate-100">{c.firstName} {c.lastName} {c.company && <span className="text-xs text-slate-400">({c.company})</span>}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{c.email} {c.phone && `· ${c.phone}`}</div>
                  <div className="mt-2"><Badge tone={c.status === 'CUSTOMER' ? 'success' : c.status === 'CHURNED' ? 'danger' : 'info'}>{c.status}</Badge></div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'deals' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Add Deal</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={dealForm.title} onChange={e => setDealForm({ ...dealForm, title: e.target.value })} placeholder="Deal title" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input type="number" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: e.target.value })} placeholder="Value" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={dealForm.stage} onChange={e => setDealForm({ ...dealForm, stage: e.target.value })} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="LEAD">Lead</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                </select>
                <input type="date" value={dealForm.expectedCloseDate} onChange={e => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={addDeal} className="mt-4">Add Deal</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deals.map(d => (
                <Surface key={d.id} className="p-4">
                  <div className="font-semibold text-slate-100">{d.title}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{d.description}</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-lg font-bold text-indigo-300">${d.value.toLocaleString()}</div>
                    <Badge tone={stageTone[d.stage] || 'info'}>{d.stage}</Badge>
                  </div>
                  {d.contact && <div className="text-xs mt-2" style={{ color: tokens.color.textDim }}>Contact: {d.contact.firstName} {d.contact.lastName}</div>}
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'pipeline' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {pipeline.map(p => (
                <Surface key={p.stage} className="text-center p-4">
                  <div className="text-2xl font-bold text-slate-100">{p.count}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{p.stage}</div>
                  <div className="text-sm font-semibold text-indigo-300 mt-1">${p.value.toLocaleString()}</div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Create Campaign</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={campaignForm.name} onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="Campaign name" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={campaignForm.type} onChange={e => setCampaignForm({ ...campaignForm, type: e.target.value })} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="MIXED">Mixed</option>
                </select>
                <input value={campaignForm.subject} onChange={e => setCampaignForm({ ...campaignForm, subject: e.target.value })} placeholder="Subject" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={campaignForm.body} onChange={e => setCampaignForm({ ...campaignForm, body: e.target.value })} placeholder="Body" rows={4} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createCampaign} className="mt-4">Create Campaign</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map(c => (
                <Surface key={c.id} className="p-4">
                  <div className="font-semibold text-slate-100">{c.name}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{c.type} · {c.status}</div>
                  <div className="flex gap-3 mt-2 text-xs" style={{ color: tokens.color.textDim }}>
                    <span>Sent: {c.sentCount}</span>
                    <span>Opens: {c.openCount}</span>
                    <span>Clicks: {c.clickCount}</span>
                  </div>
                  {c.status === 'DRAFT' && (
                    <Button onClick={() => sendCampaign(c.id)} className="mt-3 w-full">Send Now</Button>
                  )}
                </Surface>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesCRMPage;
