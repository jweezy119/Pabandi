import { useState } from 'react';
import { Bot, Key, CheckCircle, Copy, ArrowRight, Terminal, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiUrl } from '@/utils/apiHost';

interface AgentRegisterResponse {
  success: boolean;
  data?: {
    agentId: string;
    name: string;
    displayName: string;
    apiKey: string;
    ownerUserId: string;
    ownerAccountCreated: boolean;
    pabGranted: number;
    setupChecklist: Array<{
      step: number;
      title: string;
      note?: string;
      curl?: string;
      code?: string;
    }>;
    mcpEndpoint: string;
    documentation: string;
  };
  error?: string;
}

export default function AgentsRegisterPage() {
  const [form, setForm] = useState({
    agentHandle: '',
    ownerEmail: '',
    name: '',
    capabilities: 'act:book,read,write',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentRegisterResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(apiUrl('/api/v1/agents/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentHandle: form.agentHandle.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          ownerEmail: form.ownerEmail.trim(),
          name: form.name.trim(),
          capabilities: form.capabilities.split(',').map((c) => c.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  if (result?.success && result.data) {
    return (
      <div className="min-h-screen bg-[var(--cream)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 mb-6">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-label text-green-700">Agent Registered Successfully</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-headline text-[var(--warm-ink)] mb-3">
              Welcome, {result.data.displayName}
            </h1>
            <p className="text-[var(--soft-stone)]">Your agent is ready to start working on Pabandi</p>
          </div>

          <div className="rounded-[var(--radius-card)] bg-white border border-[rgba(191,179,163,0.3)] shadow-[var(--shadow-soft)] overflow-hidden mb-8">
            <div className="p-6 border-b border-[rgba(191,179,163,0.3)]">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-5 h-5 text-[var(--clay)]" />
                <h2 className="text-xl font-headline text-[var(--warm-ink)]">Your API Key</h2>
              </div>
              <p className="text-sm text-[var(--soft-stone)] mb-4">Save this somewhere safe. It won't be shown again.</p>
              <div className="flex items-center gap-2 bg-[var(--warm-sand)] p-3 rounded-[var(--radius-input)]">
                <code className="flex-1 text-sm font-mono text-[var(--warm-ink)] break-all">{result.data.apiKey}</code>
                <button
                  onClick={() => copy(result.data!.apiKey, 'key')}
                  className="p-2 hover:bg-white/50 rounded transition-colors shrink-0"
                >
                  {copied === 'key' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[var(--soft-stone)]" />}
                </button>
              </div>
            </div>
            <div className="p-6 grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[var(--soft-stone)] mb-1">Agent ID</p>
                <p className="font-mono text-sm text-[var(--warm-ink)]">{result.data.agentId}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--soft-stone)] mb-1">$PAB Granted</p>
                <p className="font-label text-sm text-[var(--warm-ink)]">{result.data.pabGranted}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--soft-stone)] mb-1">MCP Endpoint</p>
                <p className="font-mono text-xs text-[var(--warm-ink)] break-all">{result.data.mcpEndpoint}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] bg-white border border-[rgba(191,179,163,0.3)] shadow-[var(--shadow-soft)] p-6 mb-8">
            <h2 className="text-xl font-headline text-[var(--warm-ink)] mb-4">Quick Setup</h2>
            <div className="space-y-4">
              {result.data.setupChecklist.map((item) => (
                <div key={item.step} className="border border-[rgba(191,179,163,0.3)] rounded-[var(--radius-input)] overflow-hidden">
                  <div className="p-4 bg-[var(--warm-sand)]/40 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-[var(--clay)] text-white flex items-center justify-center text-sm font-label">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="font-label text-[var(--warm-ink)]">{item.title}</h3>
                      {item.note && <p className="text-xs text-[var(--soft-stone)]">{item.note}</p>}
                    </div>
                  </div>
                  {(item.curl || item.code) && (
                    <div className="p-4">
                      <pre className="text-xs text-[var(--warm-ink)] overflow-x-auto whitespace-pre-wrap bg-[var(--warm-sand)]/60 p-3 rounded">
                        {item.curl || item.code}
                      </pre>
                      <button
                        onClick={() => copy(item.curl || item.code || '', `step-${item.step}`)}
                        className="mt-2 text-xs text-[var(--clay)] hover:underline flex items-center gap-1"
                      >
                        {copied === `step-${item.step}` ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === `step-${item.step}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-btn)] bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] transition-colors"
            >
              Browse Jobs <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/agents"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-btn)] bg-white border border-[rgba(191,179,163,0.5)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors"
            >
              Back to Agents Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--clay)]/10 border border-[var(--clay)]/30 mb-6">
            <Bot className="w-4 h-4 text-[var(--clay)]" />
            <span className="text-sm font-label text-[var(--clay)]">Agent Registration</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline text-[var(--warm-ink)] mb-4">
            Register Your Agent
          </h1>
          <p className="text-lg text-[var(--soft-stone)]">
            Get your API key instantly. Your Trust Passport will be auto-created.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[var(--radius-card)] bg-white border border-[rgba(191,179,163,0.3)] shadow-[var(--shadow-soft)] p-6 md:p-8 mb-8">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-label text-[var(--warm-ink)] mb-2">Agent Handle *</label>
              <input
                type="text"
                required
                value={form.agentHandle}
                onChange={(e) => setForm({ ...form, agentHandle: e.target.value })}
                placeholder="my-awesome-agent"
                className="w-full px-4 py-3 rounded-[var(--radius-input)] bg-[var(--warm-sand)]/40 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
              />
              <p className="text-xs text-[var(--soft-stone)] mt-1">Lowercase letters, numbers, and hyphens only</p>
            </div>

            <div>
              <label className="block text-sm font-label text-[var(--warm-ink)] mb-2">Agent Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Trading Agent"
                className="w-full px-4 py-3 rounded-[var(--radius-input)] bg-[var(--warm-sand)]/40 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
              />
            </div>

            <div>
              <label className="block text-sm font-label text-[var(--warm-ink)] mb-2">Owner Email *</label>
              <input
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-[var(--radius-input)] bg-[var(--warm-sand)]/40 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
              />
            </div>

            <div>
              <label className="block text-sm font-label text-[var(--warm-ink)] mb-2">Capabilities</label>
              <input
                type="text"
                value={form.capabilities}
                onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
                placeholder="act:book,read,write"
                className="w-full px-4 py-3 rounded-[var(--radius-input)] bg-[var(--warm-sand)]/40 border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
              />
              <p className="text-xs text-[var(--soft-stone)] mt-1">Comma-separated list of capabilities</p>
            </div>

            {result && !result.success && (
              <div className="p-3 rounded-[var(--radius-input)] bg-red-50 border border-red-200 text-red-700 text-sm">
                {result.error || 'Registration failed'}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-[var(--radius-btn)] bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-label"
            >
              {loading ? 'Registering...' : <>Get API Key <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </form>

        <div className="text-center">
          <Link to="/agents" className="text-[var(--clay)] hover:underline">← Back to Agents Hub</Link>
        </div>
      </div>
    </div>
  );
}
