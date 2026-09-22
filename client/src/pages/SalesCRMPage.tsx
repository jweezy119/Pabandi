import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { crmService, teamService } from '../services/api';
import { useOfflineMode } from '../hooks/useOfflineMode';

type Contact = { id: string; firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; title?: string; source?: string; status: string; tags: string[]; createdAt: string };
type Deal = { id: string; title: string; description?: string; value: number; currency: string; stage: string; probability: number; expectedCloseDate?: string; closedAt?: string; lostReason?: string; contact?: Contact; createdAt: string };
type Campaign = { id: string; name: string; description?: string; type: string; status: string; sentCount: number; openCount: number; clickCount: number; replyCount: number; scheduledAt?: string; createdAt: string };
type Task = { id: string; title: string; description?: string; status: string; priority: string; dueDate?: string; completedAt?: string; contactId?: string; dealId?: string; contact?: Contact; createdAt: string };
type Communication = { id: string; type: string; direction?: string; subject?: string; body?: string; duration?: number; contactId?: string; dealId?: string; contact?: Contact; createdAt: string };
type PipelineItem = { stage: string; count: number; value: number };
type EmailTemplate = { id: string; name: string; subject: string; body: string; category?: string; isDefault: boolean; createdAt: string };
type Sequence = { id: string; name: string; description?: string; status: string; trigger?: string; steps: SequenceStep[]; _count?: { enrollments: number }; createdAt: string };
type SequenceStep = { id: string; order: number; type: string; subject?: string; body?: string; delayDays: number; delayHours: number };
type Form = { id: string; name: string; slug: string; fields: any[]; status: string; submissions: number; createdAt: string };
type CalendarEvent = { id: string; contactId?: string; dealId?: string; title: string; description?: string; startAt: string; endAt?: string; location?: string; type: string; status: string; attendees?: string[]; createdAt: string };
type Integration = { id: string; type: string; name: string; config?: any; isActive: boolean; createdAt: string };
type ApiKey = { id: string; name: string; key: string; permissions?: string[]; expiresAt?: string; createdAt: string };
type AIInsight = { id: string; type: string; entityType?: string; entityId?: string; title: string; description?: string; confidence?: number; actionData?: any; isRead: boolean; isDismissed: boolean; createdAt: string };
type NextBestAction = { id: string; contactId?: string; dealId?: string; actionType: string; title: string; description?: string; priority: string; reasoning?: string; context?: any; isCompleted: boolean; completedAt?: string; createdAt: string };
type LeadScorePrediction = { id: string; contactId: string; score: number; confidence: number; modelVersion: string; features?: any; explanation?: string; createdAt: string };

const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
const STAGE_COLORS: Record<string, string> = { LEAD: 'var(--clay)', QUALIFIED: '#8b5cf6', PROPOSAL: 'var(--muted-ochre)', NEGOTIATION: 'var(--terracotta)', WON: 'var(--sage)', LOST: 'var(--terracotta)' };
const STAGE_TONE: Record<string, 'info' | 'success' | 'warning' | 'danger'> = { LEAD: 'info', QUALIFIED: 'info', PROPOSAL: 'warning', NEGOTIATION: 'warning', WON: 'success', LOST: 'danger' };

export const SalesCRMPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pipeline' | 'contacts' | 'deals' | 'tasks' | 'communications' | 'campaigns' | 'templates' | 'sequences' | 'forms' | 'reports' | 'team' | 'notifications' | 'tickets' | 'knowledge' | 'events' | 'integrations' | 'apiKeys' | 'ai'>('pipeline');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [dealTasks, setDealTasks] = useState<Task[]>([]);
  const [dealComms, setDealComms] = useState<Communication[]>([]);

  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: 'WEBSITE', status: 'LEAD' });
  const [dealForm, setDealForm] = useState({ title: '', description: '', value: '', stage: 'LEAD', probability: 0, expectedCloseDate: '', contactId: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', contactId: '', dealId: '' });
  const [commForm, setCommForm] = useState({ type: 'EMAIL', direction: 'OUTBOUND', subject: '', body: '', duration: '', contactId: '', dealId: '' });
  const [campaignForm, setCampaignForm] = useState({ name: '', description: '', type: 'EMAIL', subject: '', body: '', scheduledAt: '' });
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '', category: 'FOLLOW_UP' });
  const [sequenceForm, setSequenceForm] = useState({ name: '', description: '', status: 'DRAFT', trigger: 'MANUAL' });
  const [formForm, setFormForm] = useState({ name: '', slug: '', fields: '', thankYou: '', redirectUrl: '', status: 'DRAFT' });
  const [reportForm, setReportForm] = useState({ name: '', type: 'CONTACTS', description: '', chartType: 'table' });
  const [reports, setReports] = useState<any[]>([]);
  const [reportResult, setReportResult] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [knowledgeArticles, setKnowledgeArticles] = useState<any[]>([]);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'MEDIUM', category: 'GENERAL', contactId: '' });
  const [articleForm, setArticleForm] = useState({ title: '', slug: '', content: '', category: '', tags: '' });
  const [events, setEvents] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [nextActions, setNextActions] = useState<NextBestAction[]>([]);
  const [scorePredictions, setScorePredictions] = useState<LeadScorePrediction[]>([]);
  const [emailDraft, setEmailDraft] = useState<{ contactId: string; subject: string; body: string } | null>(null);
  const [eventForm, setEventForm] = useState({ title: '', description: '', startAt: '', endAt: '', location: '', type: 'MEETING', contactId: '' });
  const [integrationForm, setIntegrationForm] = useState({ type: 'GOOGLE_CALENDAR', name: '', config: '' });
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', permissions: '', expiresAt: '' });
  const { isOnline, queueAction } = useOfflineMode();

  const loadAll = async () => {
    setLoading(true);
    try {
      const empty = { data: { data: [] } };
      const emptyPipeline = { data: { data: { pipeline: [] } } };
      const [contactsRes, dealsRes, pipelineRes, campaignsRes, tasksRes, commsRes, templatesRes, sequencesRes, formsRes, reportsRes, teamRes, notifRes, ticketsRes, kbRes, eventsRes, integrationsRes, apiKeysRes, aiInsightsRes] = await Promise.all([
        crmService.contacts().catch(() => empty),
        crmService.deals().catch(() => empty),
        crmService.pipeline().catch(() => emptyPipeline),
        crmService.campaigns().catch(() => empty),
        crmService.tasks().catch(() => empty),
        crmService.communications().catch(() => empty),
        crmService.emailTemplates().catch(() => empty),
        crmService.sequences().catch(() => empty),
        crmService.forms().catch(() => empty),
        crmService.reports().catch(() => empty),
        teamService.listMembers().catch(() => ({ data: { data: [] } })),
        Promise.resolve({ data: { data: [] } }),
        crmService.tickets().catch(() => ({ data: { data: [] } })),
        crmService.knowledge().catch(() => ({ data: { data: [] } })),
        crmService.events().catch(() => ({ data: { data: [] } })),
        crmService.integrations().catch(() => ({ data: { data: [] } })),
        crmService.apiKeys().catch(() => ({ data: { data: [] } })),
        crmService.aiInsights().catch(() => ({ data: { data: [] } })),
      ]);
      setContacts(contactsRes.data?.data || []);
      setDeals(dealsRes.data?.data || []);
      setPipeline(pipelineRes.data?.data?.pipeline || []);
      setCampaigns(campaignsRes.data?.data || []);
      setTasks(tasksRes.data?.data || []);
      setCommunications(commsRes.data?.data || []);
      setEmailTemplates(templatesRes.data?.data || []);
      setSequences(sequencesRes.data?.data || []);
      setForms(formsRes.data?.data || []);
      setReports(reportsRes.data?.data || []);
      setTeamMembers(teamRes.data?.data || []);
      setNotifications(notifRes.data?.data || []);
      setTickets(ticketsRes.data?.data || []);
      setKnowledgeArticles(kbRes.data?.data || []);
      setEvents(eventsRes.data?.data || []);
      setIntegrations(integrationsRes.data?.data || []);
      setApiKeys(apiKeysRes.data?.data || []);
      setAiInsights(aiInsightsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load CRM data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const loadDealDetail = async (dealId: string) => {
    try {
      const [dealRes, tasksRes, commsRes] = await Promise.all([
        crmService.getDeal(dealId).catch(() => ({ data: { data: null } })),
        crmService.tasks({ dealId }).catch(() => ({ data: { data: [] } })),
        crmService.communications({ dealId }).catch(() => ({ data: { data: [] } })),
      ]);
      if (dealRes.data?.data) setSelectedDeal(dealRes.data.data);
      setDealTasks(tasksRes.data?.data || []);
      setDealComms(commsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load deal detail', e);
    }
  };

  const addContact = async () => {
    if (!contactForm.email && !contactForm.firstName) return;
    try {
      await crmService.createContact(contactForm);
      setContactForm({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: 'WEBSITE', status: 'LEAD' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not add contact');
    }
  };

  const addDeal = async () => {
    if (!dealForm.title) return;
    try {
      await crmService.createDeal({ ...dealForm, value: Number(dealForm.value) || 0, contactId: dealForm.contactId || undefined });
      setDealForm({ title: '', description: '', value: '', stage: 'LEAD', probability: 0, expectedCloseDate: '', contactId: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not add deal');
    }
  };

  const moveDeal = async (dealId: string, stage: string) => {
    try {
      await crmService.moveDeal(dealId, stage);
      loadAll();
      if (selectedDeal?.id === dealId) {
        setSelectedDeal({ ...selectedDeal, stage });
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not move deal');
    }
  };

  const addTask = async () => {
    if (!taskForm.title) return;
    try {
      await crmService.createTask({ ...taskForm, contactId: taskForm.contactId || undefined, dealId: taskForm.dealId || undefined });
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', contactId: '', dealId: '' });
      loadAll();
      if (selectedDeal) {
        setDealTasks(prev => [...prev, { ...taskForm, id: '', status: 'OPEN', createdAt: new Date().toISOString() } as Task]);
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not add task');
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      await crmService.updateTask(taskId, { status: 'COMPLETED' });
      loadAll();
      setDealTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED' } : t));
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED' } : t));
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not complete task');
    }
  };

  const addCommunication = async () => {
    if (!commForm.type) return;
    try {
      await crmService.createCommunication({ ...commForm, contactId: commForm.contactId || undefined, dealId: commForm.dealId || undefined, duration: commForm.duration ? Number(commForm.duration) : undefined });
      setCommForm({ type: 'EMAIL', direction: 'OUTBOUND', subject: '', body: '', duration: '', contactId: '', dealId: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not log communication');
    }
  };

  const createCampaign = async () => {
    if (!campaignForm.name) return;
    try {
      await crmService.createCampaign(campaignForm);
      setCampaignForm({ name: '', description: '', type: 'EMAIL', subject: '', body: '', scheduledAt: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create campaign');
    }
  };

  const sendCampaign = async (campaignId: string) => {
    try {
      await crmService.sendCampaign(campaignId);
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not send campaign');
    }
  };

  const createTemplate = async () => {
    if (!templateForm.name || !templateForm.subject || !templateForm.body) return;
    try {
      await crmService.createEmailTemplate(templateForm);
      setTemplateForm({ name: '', subject: '', body: '', category: 'FOLLOW_UP' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create template');
    }
  };

  const createSequence = async () => {
    if (!sequenceForm.name) return;
    try {
      await crmService.createSequence({ ...sequenceForm, steps: [] });
      setSequenceForm({ name: '', description: '', status: 'DRAFT', trigger: 'MANUAL' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create sequence');
    }
  };

  const createForm = async () => {
    if (!formForm.name || !formForm.slug || !formForm.fields) return;
    try {
      await crmService.createForm({ ...formForm, fields: JSON.parse(formForm.fields) });
      setFormForm({ name: '', slug: '', fields: '', thankYou: '', redirectUrl: '', status: 'DRAFT' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create form');
    }
  };

  const createReport = async () => {
    if (!reportForm.name || !reportForm.type) return;
    try {
      await crmService.createReport(reportForm);
      setReportForm({ name: '', type: 'CONTACTS', description: '', chartType: 'table' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create report');
    }
  };

  const runReport = async (reportId: string) => {
    try {
      const res = await crmService.runReport(reportId);
      setReportResult(res.data?.data);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not run report');
    }
  };

  const createTicket = async () => {
    if (!ticketForm.subject) return;
    try {
      await crmService.createTicket(ticketForm);
      setTicketForm({ subject: '', description: '', priority: 'MEDIUM', category: 'GENERAL', contactId: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create ticket');
    }
  };

  const createArticle = async () => {
    if (!articleForm.title || !articleForm.slug || !articleForm.content) return;
    try {
      await crmService.createKnowledgeArticle({ ...articleForm, tags: articleForm.tags ? articleForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [] });
      setArticleForm({ title: '', slug: '', content: '', category: '', tags: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create article');
    }
  };

  const createEvent = async () => {
    if (!eventForm.title || !eventForm.startAt) return;
    try {
      await crmService.createEvent(eventForm);
      setEventForm({ title: '', description: '', startAt: '', endAt: '', location: '', type: 'MEETING', contactId: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create event');
    }
  };

  const createIntegration = async () => {
    if (!integrationForm.type || !integrationForm.name) return;
    try {
      const config = integrationForm.config ? JSON.parse(integrationForm.config) : undefined;
      await crmService.createIntegration({ ...integrationForm, config });
      setIntegrationForm({ type: 'GOOGLE_CALENDAR', name: '', config: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create integration');
    }
  };

  const createApiKey = async () => {
    if (!apiKeyForm.name) return;
    try {
      const permissions = apiKeyForm.permissions ? apiKeyForm.permissions.split(',').map(p => p.trim()).filter(Boolean) : [];
      await crmService.createApiKey({ name: apiKeyForm.name, permissions, expiresAt: apiKeyForm.expiresAt || undefined });
      setApiKeyForm({ name: '', permissions: '', expiresAt: '' });
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create API key');
    }
  };

  if (!isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Surface className="p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">📡</div>
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">You are offline</h2>
          <p className="text-sm text-[var(--soft-stone)] mb-4">Some CRM features require an internet connection. Please reconnect to continue.</p>
          <div className="text-xs text-[var(--soft-stone)]">Data entered while offline will be queued and synced when you reconnect.</div>
        </Surface>
      </div>
    );
  }

  const generateNextAction = async (contactId: string) => {
    try {
      const res = await crmService.aiNextAction(contactId);
      const actions = res.data?.data || [];
      setNextActions(prev => [...actions, ...prev]);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not generate next action');
    }
  };

  const generateScore = async (contactId: string) => {
    try {
      const res = await crmService.aiScoreContact(contactId);
      const prediction = res.data?.data;
      if (prediction) setScorePredictions(prev => [prediction, ...prev]);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not generate score');
    }
  };

  const generateEmailDraft = async (contactId: string) => {
    try {
      const res = await crmService.aiEmailDraft({ contactId });
      setEmailDraft(res.data?.data);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not generate email draft');
    }
  };

  const markInsightRead = async (id: string) => {
    try {
      await crmService.markInsightRead(id);
      setAiInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
    } catch (e: any) {
      console.error('Could not mark insight read', e);
    }
  };

  const openDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setTaskForm(prev => ({ ...prev, dealId: deal.id, contactId: deal.contact?.id || '' }));
    setCommForm(prev => ({ ...prev, dealId: deal.id, contactId: deal.contact?.id || '' }));
    loadDealDetail(deal.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ color: tokens.color.textDim }}>Loading CRM…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0 mt-16" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-headline text-[var(--warm-ink)]">Sales CRM</h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.textDim }}>Pipeline, contacts, deals, tasks, and campaigns.</p>
          </div>
          <div className="flex gap-2 text-xs" style={{ color: tokens.color.textDim }}>
            <span>Total pipeline: ${pipeline.reduce((s, p) => s + p.value, 0).toLocaleString()}</span>
            <span>·</span>
            <span>Weighted: ${pipeline.filter(p => p.stage !== 'WON' && p.stage !== 'LOST').reduce((s, p) => s + p.value * 0.5, 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { key: 'pipeline', label: '📊 Pipeline', icon: '📊' },
            { key: 'contacts', label: '👥 Contacts', icon: '👥' },
            { key: 'deals', label: '💼 Deals', icon: '💼' },
            { key: 'tasks', label: '✅ Tasks', icon: '✅' },
            { key: 'communications', label: '💬 Communications', icon: '💬' },
            { key: 'templates', label: '📧 Templates', icon: '📧' },
            { key: 'sequences', label: '🔄 Sequences', icon: '🔄' },
            { key: 'forms', label: '📝 Forms', icon: '📝' },
            { key: 'reports', label: '📈 Reports', icon: '📈' },
            { key: 'team', label: '👥 Team', icon: '👥' },
            { key: 'notifications', label: '🔔 Notifications', icon: '🔔' },
            { key: 'tickets', label: '🎫 Tickets', icon: '🎫' },
            { key: 'knowledge', label: '📚 Knowledge', icon: '📚' },
            { key: 'events', label: '📅 Events', icon: '📅' },
            { key: 'integrations', label: '🔌 Integrations', icon: '🔌' },
            { key: 'apiKeys', label: '🔑 API Keys', icon: '🔑' },
            { key: 'ai', label: '🤖 AI', icon: '🤖' },
            { key: 'campaigns', label: '📣 Campaigns', icon: '📣' },
          ] as const).map(s => (
            <button key={s.key} onClick={() => setTab(s.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === s.key ? 'bg-[var(--clay)]/20 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.2)]'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Pipeline Kanban ─────────────────────────────────────────────── */}
        {tab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button onClick={() => setTab('deals')} className="text-sm">+ New Deal</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {STAGES.map(stage => {
                const stageDeals = deals.filter(d => d.stage === stage);
                const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
                return (
                  <div key={stage} className="flex flex-col gap-2 min-h-[400px]"
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={e => { e.preventDefault(); const dealId = e.dataTransfer.getData('text/plain'); if (dealId) moveDeal(dealId, stage); }}>
                    <Surface className="p-3 flex items-center justify-between" style={{ borderTop: `3px solid ${STAGE_COLORS[stage]}` }}>
                      <div>
                        <div className="text-sm font-bold text-[var(--warm-ink)]">{stage}</div>
                        <div className="text-xs" style={{ color: tokens.color.textDim }}>{stageDeals.length} deal{stageDeals.length !== 1 ? 's' : ''} · ${stageValue.toLocaleString()}</div>
                      </div>
                    </Surface>
                    <div className="flex flex-col gap-2 flex-1">
                      {stageDeals.map(deal => (
                        <div key={deal.id} draggable onDragStart={(e: React.DragEvent<HTMLDivElement>) => { e.dataTransfer.setData('text/plain', deal.id); }}
                          className="p-3 rounded-xl cursor-grab active:cursor-grabbing hover:bg-[var(--warm-sand)] transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                          onClick={() => openDeal(deal)}>
                          <div className="font-semibold text-[var(--warm-ink)] text-sm">{deal.title}</div>
                          {deal.contact && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{deal.contact.firstName} {deal.contact.lastName}</div>}
                          <div className="flex items-center justify-between mt-2">
                            <div className="text-sm font-bold text-[var(--clay)]">${deal.value.toLocaleString()}</div>
                            <Badge tone={STAGE_TONE[deal.stage] || 'info'} className="text-[10px]">{deal.probability}%</Badge>
                          </div>
                          {deal.expectedCloseDate && <div className="text-[10px] mt-1" style={{ color: tokens.color.textDim }}>Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Contacts ───────────────────────────────────────────────────── */}
        {tab === 'contacts' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Add Contact</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                 <input value={contactForm.firstName} onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })} placeholder="First name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 sm:py-3 outline-none font-body text-base touch-target" />
                 <input value={contactForm.lastName} onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })} placeholder="Last name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 sm:py-3 outline-none font-body text-base touch-target" />
                 <input value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="Email" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 sm:py-3 outline-none font-body text-base touch-target" />
                 <input value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="Phone" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 sm:py-3 outline-none font-body text-base touch-target" />
                 <input value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} placeholder="Company" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 sm:py-3 outline-none font-body text-base touch-target" />
                 <select value={contactForm.status} onChange={e => setContactForm({ ...contactForm, status: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 sm:py-3 outline-none font-body text-base touch-target">
                   <option value="LEAD">Lead</option>
                   <option value="PROSPECT">Prospect</option>
                   <option value="CUSTOMER">Customer</option>
                   <option value="CHURNED">Churned</option>
                 </select>
               </div>
              <Button onClick={addContact} className="mt-4">Add Contact</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.map(c => {
                const { ref, translateX, onTouchStart, onTouchMove, onTouchEnd } = useSwipe(
                  () => setContacts(prev => prev.filter(x => x.id !== c.id)),
                  () => { setDealForm(prev => ({ ...prev, contactId: c.id })); setTab('deals'); }
                );
                return (
                  <div key={c.id} ref={ref} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="relative">
                    <div style={{ transform: `translateX(${translateX}px)`, transition: 'transform 0.3s ease' }}>
                      <Surface className="p-4 hover:bg-[var(--warm-sand)] transition-colors cursor-pointer" onClick={() => { setDealForm(prev => ({ ...prev, contactId: c.id })); setTab('deals'); }}>
                        <div className="font-semibold text-[var(--warm-ink)]">{c.firstName} {c.lastName} {c.company && <span className="text-xs text-[var(--soft-stone)]">({c.company})</span>}</div>
                        <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{c.email} {c.phone && `· ${c.phone}`}</div>
                        <div className="mt-2"><Badge tone={c.status === 'CUSTOMER' ? 'success' : c.status === 'CHURNED' ? 'danger' : 'info'}>{c.status}</Badge></div>
                        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                          <Button onClick={() => generateNextAction(c.id)} className="text-xs flex-1">Next Action</Button>
                          <Button onClick={() => generateScore(c.id)} className="text-xs flex-1">Score</Button>
                          <Button onClick={() => generateEmailDraft(c.id)} className="text-xs flex-1">Draft Email</Button>
                        </div>
                      </Surface>
                    </div>
                    {Math.abs(translateX) > 10 && (
                      <div className="absolute inset-y-0 right-0 flex items-center justify-center w-16 bg-[var(--terracotta)]/80 rounded-r-2xl text-[var(--warm-ink)] text-xs font-bold">
                        {translateX < 0 ? 'Delete' : 'Open'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Deals ──────────────────────────────────────────────────────── */}
        {tab === 'deals' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Add Deal</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={dealForm.title} onChange={e => setDealForm({ ...dealForm, title: e.target.value })} placeholder="Deal title" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={dealForm.contactId} onChange={e => setDealForm({ ...dealForm, contactId: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="">Select contact…</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} {c.company ? `(${c.company})` : ''}</option>)}
                </select>
                <input type="number" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: e.target.value })} placeholder="Value" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={dealForm.stage} onChange={e => setDealForm({ ...dealForm, stage: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="number" value={dealForm.probability} onChange={e => setDealForm({ ...dealForm, probability: Number(e.target.value) })} placeholder="Probability %" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input type="date" value={dealForm.expectedCloseDate} onChange={e => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={addDeal} className="mt-4">Add Deal</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deals.map(d => (
                <Surface key={d.id} className="p-4 hover:bg-[var(--warm-sand)] transition-colors cursor-pointer" onClick={() => openDeal(d)}>
                  <div className="font-semibold text-[var(--warm-ink)]">{d.title}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{d.description}</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-lg font-bold text-[var(--clay)]">${d.value.toLocaleString()}</div>
                    <Badge tone={STAGE_TONE[d.stage] || 'info'}>{d.stage}</Badge>
                  </div>
                  {d.contact && <div className="text-xs mt-2" style={{ color: tokens.color.textDim }}>Contact: {d.contact.firstName} {d.contact.lastName}</div>}
                  {d.expectedCloseDate && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Expected close: {new Date(d.expectedCloseDate).toLocaleDateString()}</div>}
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Tasks ─────────────────────────────────────────────────────── */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Add Task</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title *" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={taskForm.contactId} onChange={e => setTaskForm({ ...taskForm, contactId: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="">Contact (optional)</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
                <select value={taskForm.dealId} onChange={e => setTaskForm({ ...taskForm, dealId: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="">Deal (optional)</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
                <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={addTask} className="mt-4">Add Task</Button>
            </Surface>

            <div className="space-y-2">
              {tasks.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No tasks yet.</p>}
              {tasks.map(t => (
                <Surface key={t.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[var(--warm-ink)]">{t.title}</div>
                    <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{t.description} {t.dueDate && `· Due: ${new Date(t.dueDate).toLocaleDateString()}`}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={t.priority === 'URGENT' || t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'info'}>{t.priority}</Badge>
                    {t.status !== 'COMPLETED' && (
                      <Button onClick={() => completeTask(t.id)} size="sm" className="text-xs">Complete</Button>
                    )}
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Communications ─────────────────────────────────────────────── */}
        {tab === 'communications' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Log Communication</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select value={commForm.type} onChange={e => setCommForm({ ...commForm, type: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="EMAIL">Email</option>
                  <option value="CALL">Call</option>
                  <option value="SMS">SMS</option>
                  <option value="MEETING">Meeting</option>
                  <option value="NOTE">Note</option>
                </select>
                <select value={commForm.direction} onChange={e => setCommForm({ ...commForm, direction: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="INBOUND">Inbound</option>
                  <option value="OUTBOUND">Outbound</option>
                </select>
                <select value={commForm.contactId} onChange={e => setCommForm({ ...commForm, contactId: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="">Contact (optional)</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
                <input value={commForm.subject} onChange={e => setCommForm({ ...commForm, subject: e.target.value })} placeholder="Subject" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={commForm.body} onChange={e => setCommForm({ ...commForm, body: e.target.value })} placeholder="Notes / transcript" rows={3} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={addCommunication} className="mt-4">Log Communication</Button>
            </Surface>

            <div className="space-y-2">
              {communications.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No communications yet.</p>}
              {communications.map(c => (
                <Surface key={c.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--warm-ink)]">{c.type} {c.direction && <span className="text-xs text-[var(--soft-stone)]">({c.direction})</span>}</div>
                    <div className="text-xs" style={{ color: tokens.color.textDim }}>{new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                  {c.subject && <div className="text-sm mt-1 text-[var(--warm-ink)]">{c.subject}</div>}
                  {c.body && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{c.body}</div>}
                  {c.contact && <div className="text-xs mt-2" style={{ color: tokens.color.textDim }}>Contact: {c.contact.firstName} {c.contact.lastName}</div>}
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Email Templates ─────────────────────────────────────────────── */}
        {tab === 'templates' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Email Template</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Template name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={templateForm.category} onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="WELCOME">Welcome</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="REVIEW_REQUEST">Review Request</option>
                  <option value="OTHER">Other</option>
                </select>
                <input value={templateForm.subject} onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="Subject line" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={templateForm.body} onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })} placeholder="Email body (HTML supported)" rows={5} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createTemplate} className="mt-4">Save Template</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {emailTemplates.map(t => (
                <Surface key={t.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{t.name}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{t.category} · {t.isDefault ? 'Default' : 'Custom'}</div>
                  <div className="text-xs mt-2 text-[var(--warm-ink)] line-clamp-2">{t.subject}</div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Sequences ───────────────────────────────────────────────────── */}
        {tab === 'sequences' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Sequence</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={sequenceForm.name} onChange={e => setSequenceForm({ ...sequenceForm, name: e.target.value })} placeholder="Sequence name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={sequenceForm.trigger} onChange={e => setSequenceForm({ ...sequenceForm, trigger: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="MANUAL">Manual</option>
                  <option value="LEAD_CREATED">Lead Created</option>
                  <option value="DEAL_STAGE_CHANGED">Deal Stage Changed</option>
                  <option value="TAG_ADDED">Tag Added</option>
                </select>
                <input value={sequenceForm.description} onChange={e => setSequenceForm({ ...sequenceForm, description: e.target.value })} placeholder="Description" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createSequence} className="mt-4">Create Sequence</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sequences.map(s => (
                <Surface key={s.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{s.name}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{s.description || 'No description'}</div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge tone={s.status === 'ACTIVE' ? 'success' : s.status === 'PAUSED' ? 'warning' : 'info'}>{s.status}</Badge>
                    <span className="text-xs text-[var(--soft-stone)]">{s._count?.enrollments || 0} enrolled</span>
                  </div>
                  <div className="text-xs mt-2" style={{ color: tokens.color.textDim }}>Trigger: {s.trigger || 'Manual'}</div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Forms ───────────────────────────────────────────────────────── */}
        {tab === 'forms' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Form</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={formForm.name} onChange={e => setFormForm({ ...formForm, name: e.target.value })} placeholder="Form name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={formForm.slug} onChange={e => setFormForm({ ...formForm, slug: e.target.value })} placeholder="URL slug (e.g. contact-us)" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={formForm.fields} onChange={e => setFormForm({ ...formForm, fields: e.target.value })} placeholder='Fields JSON (e.g. [{"name":"email","label":"Email","type":"email","required":true}])' rows={4} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={formForm.thankYou} onChange={e => setFormForm({ ...formForm, thankYou: e.target.value })} placeholder="Thank you message" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createForm} className="mt-4">Create Form</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map(f => (
                <Surface key={f.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{f.name}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>/forms/{f.slug} · {f.submissions} submissions</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{f.fields?.length || 0} fields · {f.status}</div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Reports ────────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Report</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={reportForm.name} onChange={e => setReportForm({ ...reportForm, name: e.target.value })} placeholder="Report name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={reportForm.type} onChange={e => setReportForm({ ...reportForm, type: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="CONTACTS">Contacts</option>
                  <option value="DEALS">Deals</option>
                  <option value="PIPELINE">Pipeline</option>
                  <option value="TASKS">Tasks</option>
                  <option value="CAMPAIGNS">Campaigns</option>
                </select>
                <select value={reportForm.chartType} onChange={e => setReportForm({ ...reportForm, chartType: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="table">Table</option>
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="pie">Pie Chart</option>
                </select>
              </div>
              <Button onClick={createReport} className="mt-4">Save Report</Button>
            </Surface>

            {reportResult && (
              <Surface className="p-6">
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Report Result</h3>
                <pre className="text-xs bg-[var(--warm-sand)] p-4 rounded-lg overflow-auto max-h-96 text-[var(--warm-ink)]">{JSON.stringify(reportResult, null, 2)}</pre>
              </Surface>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map(r => (
                <Surface key={r.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{r.name}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{r.type} · {r.chartType || 'table'}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{r.description || 'No description'}</div>
                  <div className="text-xs mt-2" style={{ color: tokens.color.textDim }}>Last run: {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : 'Never'}</div>
                  <Button onClick={() => runReport(r.id)} size="sm" className="mt-3 w-full">Run Report</Button>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Team ───────────────────────────────────────────────────────── */}
        {tab === 'team' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Team Members</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.textDim }}>Manage your sales team and assign roles.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map(m => (
                  <Surface key={m.id} className="p-4">
                    <div className="font-semibold text-[var(--warm-ink)]">{m.firstName} {m.lastName}</div>
                    <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{m.email}</div>
                    <div className="mt-2"><Badge tone={m.role === 'OWNER' || m.role === 'ADMIN' ? 'success' : m.role === 'MANAGER' ? 'warning' : 'info'}>{m.role}</Badge></div>
                  </Surface>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* ── Notifications ───────────────────────────────────────────────── */}
        {tab === 'notifications' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Notifications</h3>
              {notifications.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No notifications yet.</p>}
              {notifications.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between p-3 bg-[var(--warm-sand)] rounded-lg mb-2">
                  <div>
                    <div className="text-sm text-[var(--warm-ink)]">{n.title || n.message || 'Notification'}</div>
                    <div className="text-xs text-[var(--soft-stone)]">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                  {n.read ? <Badge tone="info">Read</Badge> : <Badge tone="warning">New</Badge>}
                </div>
              ))}
            </Surface>
          </div>
        )}

        {/* ── Tickets ─────────────────────────────────────────────────────── */}
        {tab === 'tickets' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Ticket</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} placeholder="Subject *" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={ticketForm.contactId} onChange={e => setTicketForm({ ...ticketForm, contactId: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="">Contact (optional)</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
                <select value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <select value={ticketForm.category} onChange={e => setTicketForm({ ...ticketForm, category: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="GENERAL">General</option>
                  <option value="BILLING">Billing</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="FEATURE">Feature Request</option>
                </select>
                <textarea value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Description" rows={3} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createTicket} className="mt-4">Create Ticket</Button>
            </Surface>

            <div className="space-y-2">
              {tickets.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No tickets yet.</p>}
              {tickets.map(t => (
                <Surface key={t.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--warm-ink)]">{t.subject}</div>
                    <div className="flex gap-2">
                      <Badge tone={t.priority === 'URGENT' || t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'info'}>{t.priority}</Badge>
                      <Badge tone={t.status === 'OPEN' ? 'info' : t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'success' : 'warning'}>{t.status}</Badge>
                    </div>
                  </div>
                  {t.description && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{t.description}</div>}
                  <div className="text-xs mt-2" style={{ color: tokens.color.textDim }}>{t.category} · {new Date(t.createdAt).toLocaleString()}</div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Knowledge Base ──────────────────────────────────────────────── */}
        {tab === 'knowledge' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Article</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={articleForm.title} onChange={e => setArticleForm({ ...articleForm, title: e.target.value })} placeholder="Article title *" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={articleForm.slug} onChange={e => setArticleForm({ ...articleForm, slug: e.target.value })} placeholder="URL slug *" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={articleForm.category} onChange={e => setArticleForm({ ...articleForm, category: e.target.value })} placeholder="Category" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={articleForm.tags} onChange={e => setArticleForm({ ...articleForm, tags: e.target.value })} placeholder="Tags (comma-separated)" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={articleForm.content} onChange={e => setArticleForm({ ...articleForm, content: e.target.value })} placeholder="Article content (HTML supported)" rows={6} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createArticle} className="mt-4">Save Article</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {knowledgeArticles.map(a => (
                <Surface key={a.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{a.title}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{a.category} · {a.status}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{a.viewCount} views · {a.helpfulCount} helpful</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>/kb/{a.slug}</div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Events ─────────────────────────────────────────────────────── */}
        {tab === 'events' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Event</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Event title *" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="MEETING">Meeting</option>
                  <option value="CALL">Call</option>
                  <option value="TASK">Task</option>
                  <option value="REMINDER">Reminder</option>
                </select>
                <input value={eventForm.startAt} onChange={e => setEventForm({ ...eventForm, startAt: e.target.value })} type="datetime-local" placeholder="Start" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={eventForm.endAt} onChange={e => setEventForm({ ...eventForm, endAt: e.target.value })} type="datetime-local" placeholder="End" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={eventForm.location} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Location" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={eventForm.contactId} onChange={e => setEventForm({ ...eventForm, contactId: e.target.value })} placeholder="Contact ID" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Description" rows={3} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base md:col-span-2" />
              </div>
              <Button onClick={createEvent} className="mt-4">Save Event</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map(ev => (
                <Surface key={ev.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{ev.title}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{ev.type} · {ev.status}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{new Date(ev.startAt).toLocaleString()}</div>
                  {ev.location && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>📍 {ev.location}</div>}
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── Integrations ────────────────────────────────────────────────── */}
        {tab === 'integrations' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Add Integration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={integrationForm.type} onChange={e => setIntegrationForm({ ...integrationForm, type: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="GOOGLE_CALENDAR">Google Calendar</option>
                  <option value="OUTLOOK">Outlook</option>
                  <option value="SLACK">Slack</option>
                  <option value="ZAPIER">Zapier</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="CUSTOM">Custom</option>
                </select>
                <input value={integrationForm.name} onChange={e => setIntegrationForm({ ...integrationForm, name: e.target.value })} placeholder="Integration name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={integrationForm.config} onChange={e => setIntegrationForm({ ...integrationForm, config: e.target.value })} placeholder="Config (JSON)" rows={4} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base md:col-span-2" />
              </div>
              <Button onClick={createIntegration} className="mt-4">Save Integration</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map(i => (
                <Surface key={i.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{i.name}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{i.type} · {i.isActive ? 'Active' : 'Inactive'}</div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── API Keys ────────────────────────────────────────────────────── */}
        {tab === 'apiKeys' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create API Key</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={apiKeyForm.name} onChange={e => setApiKeyForm({ ...apiKeyForm, name: e.target.value })} placeholder="Key name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <input value={apiKeyForm.expiresAt} onChange={e => setApiKeyForm({ ...apiKeyForm, expiresAt: e.target.value })} type="date" placeholder="Expires at (optional)" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createApiKey} className="mt-4">Generate Key</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apiKeys.map(k => (
                <Surface key={k.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{k.name}</div>
                  <div className="text-xs mt-1 font-mono break-all" style={{ color: tokens.color.textDim }}>{k.key}</div>
                  {k.expiresAt && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Expires: {new Date(k.expiresAt).toLocaleDateString()}</div>}
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* ── AI ─────────────────────────────────────────────────────────── */}
        {tab === 'ai' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Surface className="p-4">
                <div className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Unread Insights</div>
                <div className="text-2xl font-bold text-[var(--warm-ink)]">{aiInsights.filter(i => !i.isRead).length}</div>
              </Surface>
              <Surface className="p-4">
                <div className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Pending Actions</div>
                <div className="text-2xl font-bold text-[var(--warm-ink)]">{nextActions.filter(a => !a.isCompleted).length}</div>
              </Surface>
              <Surface className="p-4">
                <div className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Scored Contacts</div>
                <div className="text-2xl font-bold text-[var(--warm-ink)]">{scorePredictions.length}</div>
              </Surface>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Surface className="p-6">
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">AI Insights</h3>
                <div className="space-y-3">
                  {aiInsights.length === 0 && <div className="text-sm text-[var(--soft-stone)]">No insights yet. Insights are generated automatically based on your data.</div>}
                  {aiInsights.map(insight => (
                    <div key={insight.id} className={`p-3 rounded-lg border ${insight.isRead ? 'bg-[var(--warm-sand)] border-[rgba(191,179,163,0.2)]' : 'bg-[var(--clay)]/10 border-[var(--clay)]/30'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-[var(--warm-ink)] text-sm">{insight.title}</div>
                        <Badge tone={insight.type === 'CHURN_RISK' ? 'danger' : insight.type === 'ANOMALY' ? 'warning' : 'info'}>{insight.type}</Badge>
                      </div>
                      {insight.description && <div className="text-xs text-[var(--soft-stone)] mb-2">{insight.description}</div>}
                      {insight.confidence && <div className="text-xs text-[var(--soft-stone)] mb-2">Confidence: {Math.round(insight.confidence * 100)}%</div>}
                      {!insight.isRead && (
                        <Button onClick={() => markInsightRead(insight.id)} className="text-xs mt-2">Mark as read</Button>
                      )}
                    </div>
                  ))}
                </div>
              </Surface>

              <Surface className="p-6">
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Next Best Actions</h3>
                <div className="space-y-3">
                  {nextActions.length === 0 && <div className="text-sm text-[var(--soft-stone)]">No actions yet. Click on a contact to generate recommendations.</div>}
                  {nextActions.map(action => (
                    <div key={action.id} className={`p-3 rounded-lg border ${action.isCompleted ? 'bg-[var(--warm-sand)] border-[rgba(191,179,163,0.2)] opacity-60' : 'bg-[var(--sage)]/10 border-[var(--sage)]/30'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-[var(--warm-ink)] text-sm">{action.title}</div>
                        <Badge tone={action.priority === 'HIGH' ? 'danger' : action.priority === 'MEDIUM' ? 'warning' : 'info'}>{action.priority}</Badge>
                      </div>
                      {action.description && <div className="text-xs text-[var(--soft-stone)] mb-1">{action.description}</div>}
                      {action.reasoning && <div className="text-xs text-[var(--soft-stone)] mb-2 italic">"{action.reasoning}"</div>}
                      {!action.isCompleted && (
                        <Button onClick={() => setNextActions(prev => prev.map(a => a.id === action.id ? { ...a, isCompleted: true, completedAt: new Date().toISOString() } : a))} className="text-xs mt-2">Mark done</Button>
                      )}
                    </div>
                  ))}
                </div>
              </Surface>
            </div>

            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Lead Score Predictions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scorePredictions.length === 0 && <div className="text-sm text-[var(--soft-stone)]">No predictions yet. Generate scores from the Contacts tab.</div>}
                {scorePredictions.map(pred => {
                  const contact = contacts.find(c => c.id === pred.contactId);
                  return (
                    <div key={pred.id} className="p-4 rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)]">
                      <div className="font-semibold text-[var(--warm-ink)] text-sm mb-1">{contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : 'Unknown Contact'}</div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-2xl font-bold text-[var(--clay)]">{pred.score}</div>
                        <div className="text-xs text-[var(--soft-stone)]">/ 100</div>
                      </div>
                      <div className="text-xs text-[var(--soft-stone)] mb-1">Confidence: {Math.round(pred.confidence * 100)}%</div>
                      {pred.explanation && <div className="text-xs text-[var(--soft-stone)] italic">"{pred.explanation}"</div>}
                    </div>
                  );
                })}
              </div>
            </Surface>

            {emailDraft && (
              <Surface className="p-6">
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">AI Email Draft</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-[var(--soft-stone)] mb-1">Subject</div>
                    <div className="text-sm text-[var(--warm-ink)] font-medium">{emailDraft.subject}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--soft-stone)] mb-1">Body</div>
                    <div className="text-sm text-[var(--warm-ink)] whitespace-pre-wrap bg-[var(--warm-sand)] p-3 rounded-lg border border-[rgba(191,179,163,0.2)]">{emailDraft.body}</div>
                  </div>
                  <Button onClick={() => setEmailDraft(null)} className="text-sm">Close</Button>
                </div>
              </Surface>
            )}
          </div>
        )}

        {/* ── Campaigns ──────────────────────────────────────────────────── */}
        {tab === 'campaigns' && (
          <div className="space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Create Campaign</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={campaignForm.name} onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="Campaign name" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <select value={campaignForm.type} onChange={e => setCampaignForm({ ...campaignForm, type: e.target.value })} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="MIXED">Mixed</option>
                </select>
                <input value={campaignForm.subject} onChange={e => setCampaignForm({ ...campaignForm, subject: e.target.value })} placeholder="Subject" className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
                <textarea value={campaignForm.body} onChange={e => setCampaignForm({ ...campaignForm, body: e.target.value })} placeholder="Body" rows={4} className="w-full bg-[var(--warm-sand)]est/50 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
              </div>
              <Button onClick={createCampaign} className="mt-4">Create Campaign</Button>
            </Surface>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map(c => (
                <Surface key={c.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{c.name}</div>
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

      {/* ── Deal Detail Modal ────────────────────────────────────────────── */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSelectedDeal(null)}>
          <div className="max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <Surface className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline">{selectedDeal.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone={STAGE_TONE[selectedDeal.stage] || 'info'}>{selectedDeal.stage}</Badge>
                    <span className="text-lg font-bold text-[var(--clay)]">${selectedDeal.value.toLocaleString()}</span>
                    {selectedDeal.contact && <span className="text-sm text-[var(--soft-stone)]">· {selectedDeal.contact.firstName} {selectedDeal.contact.lastName}</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedDeal(null)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-xl leading-none">&times;</button>
              </div>

              {selectedDeal.description && (
                <div className="mb-4 p-3 bg-[var(--warm-sand)] rounded-lg text-sm text-[var(--warm-ink)]">{selectedDeal.description}</div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="p-3 bg-[var(--warm-sand)] rounded-lg">
                  <div className="text-xs text-[var(--soft-stone)]">Probability</div>
                  <div className="text-sm font-bold text-[var(--warm-ink)]">{selectedDeal.probability}%</div>
                </div>
                <div className="p-3 bg-[var(--warm-sand)] rounded-lg">
                  <div className="text-xs text-[var(--soft-stone)]">Expected Close</div>
                  <div className="text-sm font-bold text-[var(--warm-ink)]">{selectedDeal.expectedCloseDate ? new Date(selectedDeal.expectedCloseDate).toLocaleDateString() : '—'}</div>
                </div>
                <div className="p-3 bg-[var(--warm-sand)] rounded-lg">
                  <div className="text-xs text-[var(--soft-stone)]">Lost Reason</div>
                  <div className="text-sm font-bold text-[var(--warm-ink)]">{selectedDeal.lostReason || '—'}</div>
                </div>
                <div className="p-3 bg-[var(--warm-sand)] rounded-lg">
                  <div className="text-xs text-[var(--soft-stone)]">Created</div>
                  <div className="text-sm font-bold text-[var(--warm-ink)]">{new Date(selectedDeal.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-bold text-[var(--warm-ink)] mb-3">📝 Tasks</h3>
                  <div className="space-y-2 mb-3">
                    {dealTasks.length === 0 && <p className="text-xs text-[var(--soft-stone)]">No tasks yet.</p>}
                    {dealTasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2 bg-[var(--warm-sand)] rounded-lg">
                        <div>
                          <div className="text-sm text-[var(--warm-ink)]">{t.title}</div>
                          <div className="text-xs text-[var(--soft-stone)]">{t.priority} {t.dueDate && `· ${new Date(t.dueDate).toLocaleDateString()}`}</div>
                        </div>
                        {t.status !== 'COMPLETED' && <Button onClick={() => completeTask(t.id)} size="sm" className="text-xs">Done</Button>}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[var(--warm-ink)] mb-3">💬 Communications</h3>
                  <div className="space-y-2 mb-3">
                    {dealComms.length === 0 && <p className="text-xs text-[var(--soft-stone)]">No communications yet.</p>}
                    {dealComms.map(c => (
                      <div key={c.id} className="p-2 bg-[var(--warm-sand)] rounded-lg">
                        <div className="text-sm text-[var(--warm-ink)]">{c.type} {c.direction && <span className="text-xs text-[var(--soft-stone)]">({c.direction})</span>}</div>
                        {c.subject && <div className="text-xs text-[var(--warm-ink)]">{c.subject}</div>}
                        <div className="text-xs text-[var(--soft-stone)]">{new Date(c.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[rgba(191,179,163,0.2)]">
                <h3 className="text-base font-bold text-[var(--warm-ink)] mb-3">Move Stage</h3>
                <div className="flex gap-2 flex-wrap">
                  {STAGES.map(stage => (
                    <button key={stage} onClick={() => moveDeal(selectedDeal.id, stage)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedDeal.stage === stage ? 'ring-2 ring-white/50' : 'opacity-70 hover:opacity-100'}`}
                      style={{ background: STAGE_COLORS[stage], color: 'white' }}>
                      {stage}
                    </button>
                  ))}
                </div>
              </div>
            </Surface>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesCRMPage;