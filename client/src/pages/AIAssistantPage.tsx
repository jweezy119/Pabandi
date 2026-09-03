import React, { useState } from 'react';
import { Surface, Button, Badge } from '../design-system';
import { propertyManagerService, aiRealEstateService } from '../services/api';

type Insight = {
  id: string;
  type: 'info' | 'warning' | 'success' | 'action';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
};

export const AIAssistantPage: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [issue, setIssue] = useState('');
  const [maintenanceAdvice, setMaintenanceAdvice] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const res = await propertyManagerService.dashboard();
      const data = res.data?.data;
      const tenants = data?.tenants || [];
      const properties = data?.properties || [];
      const leases = data?.leases || [];

      const newInsights: Insight[] = [];

      if (properties.length === 0) {
        newInsights.push({ id: '1', type: 'info', title: 'No properties yet', description: 'Add your first property to start getting AI insights.', priority: 'high' });
      }

      const screeningNeeded = tenants.filter((t: any) => t.status === 'APPLIED' && !t.riskBand).length;
      if (screeningNeeded > 0) {
        newInsights.push({ id: '2', type: 'warning', title: 'Pending screenings', description: `${screeningNeeded} applicants need CourtListener screening before approval.`, priority: 'high' });
      }

      const activeLeases = (leases as any[]).filter((l: any) => l.status === 'ACTIVE').length;
      if (activeLeases > 0) {
        newInsights.push({ id: '3', type: 'success', title: 'Active leases', description: `You have ${activeLeases} active lease${activeLeases !== 1 ? 's' : ''}. Track renewals 30 days before expiry.`, priority: 'medium' });
      }

      if (properties.length > 0 && leases.length > 0) {
        newInsights.push({ id: '4', type: 'action', title: 'Rent optimization', description: 'Market analysis suggests potential rent adjustment on 1-2 properties based on comparable listings.', priority: 'medium' });
      }

      setInsights(newInsights);
    } catch (e) {
      console.error('insights failed', e);
    } finally {
      setLoading(false);
    }
  };

  const askAI = async () => {
    if (!question.trim()) return;
    setChatLoading(true);
    try {
      const res = await aiRealEstateService.aiChat(question, { context: 'property_manager' });
      const answer = res.data?.data?.reply || res.data?.reply || 'No response';
      setChat(prev => [...prev, { q: question, a: answer }]);
      setQuestion('');
    } catch (e) {
      setChat(prev => [...prev, { q: question, a: 'AI is temporarily unavailable. Try again later.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getMaintenanceAdvice = async () => {
    if (!issue.trim()) return;
    setAnalyzing(true);
    setMaintenanceAdvice('');
    try {
      const res = await aiRealEstateService.maintenanceAdvice(issue, 'apartment', 'medium', 'MEDIUM');
      const advice = res.data?.data?.advice || res.data?.advice || 'No advice available.';
      setMaintenanceAdvice(advice);
    } catch (e) {
      setMaintenanceAdvice('Could not load maintenance advice.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0" style={{ background: 'radial-gradient(circle at top left, #0f172a, #020617)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-headline text-slate-100">AI Assistant</h1>
          <p className="text-sm mt-1 text-slate-400">Property insights, tenant recommendations, and maintenance guidance.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Surface className="p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-100">📊 Portfolio Insights</h3>
              <Button onClick={generateInsights} disabled={loading} size="sm">{loading ? 'Analyzing…' : 'Refresh'}</Button>
            </div>
            {insights.length === 0 && !loading && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400 mb-3">Generate insights based on your current portfolio.</p>
                <Button onClick={generateInsights}>Generate Insights</Button>
              </div>
            )}
            <div className="space-y-2">
              {insights.map(i => (
                <div key={i.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{i.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{i.description}</div>
                    </div>
                    <Badge tone={i.priority === 'high' ? 'danger' : i.priority === 'medium' ? 'warning' : 'info'}>{i.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 md:p-6 space-y-4">
            <h3 className="font-bold text-slate-100">💬 Ask AI</h3>
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {chat.length === 0 && <p className="text-xs text-slate-400">Ask anything about leases, screening, rent, or maintenance.</p>}
              {chat.map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs font-semibold text-indigo-300">You: {m.q}</div>
                  <div className="text-xs text-slate-300 bg-white/5 rounded-lg px-3 py-2">{m.a}</div>
                </div>
              ))}
              {chatLoading && <div className="text-xs text-slate-400">Thinking…</div>}
            </div>
            <div className="flex gap-2">
              <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="Ask about a property, tenant, or lease…" className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
              <Button onClick={askAI} disabled={chatLoading}>Send</Button>
            </div>
          </Surface>

          <Surface className="p-4 md:p-6 space-y-4">
            <h3 className="font-bold text-slate-100">🛠️ Maintenance Advisor</h3>
            <input value={issue} onChange={e => setIssue(e.target.value)} placeholder="Describe the issue, e.g. water leak in bathroom" className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
            <Button onClick={getMaintenanceAdvice} disabled={analyzing} className="w-full">{analyzing ? 'Analyzing…' : 'Get Maintenance Advice'}</Button>
            {maintenanceAdvice && <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 whitespace-pre-wrap">{maintenanceAdvice}</div>}
          </Surface>

          <Surface className="p-4 md:p-6 space-y-4">
            <h3 className="font-bold text-slate-100">🧪 Tenant Intelligence</h3>
            <p className="text-xs text-slate-400">Analyze tenant behavior, payment patterns, and renewal risk.</p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white/5"><div className="text-xl font-bold text-slate-100">AI</div><div className="text-[10px] text-slate-400">Payment Risk</div></div>
              <div className="p-3 rounded-xl bg-white/5"><div className="text-xl font-bold text-slate-100">AI</div><div className="text-[10px] text-slate-400">Renewal Likelihood</div></div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
};
