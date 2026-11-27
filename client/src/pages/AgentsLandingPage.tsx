import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Key, Zap, Code, ShieldCheck, Cpu, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { API_HOST } from '../services/api';
import M2MSimulator from '../components/M2MSimulator';
import GlassNavHeader from '../components/GlassNavHeader';

const CODE_TABS = [
  {
    id: 'mcp',
    label: 'mcp.json',
    code: `{
  "mcpServers": {
    "pabandi": {
      "url": "https://api.pabandi.com/mcp"
    }
  }
}`,
  },
  {
    id: 'python',
    label: 'langchain_agent.py',
    code: `from pabandi import PabandiClient

client = PabandiClient(api_key="pab_m2m_...")

# 1. Predict risk & human-in-the-loop policy before locking funds
risk = client.predict_task_risk(
    scope_complexity="medium",
    budget_usd=250.0,
    requires_vcap_proof=True
)

# 2. Fund job with programmable escrow using a Session Key
result = client.pabandi_m2m_post_project(
    title="Build API integration",
    description="Need help integrating webhook handlers",
    budget_usdc=250.0,
    session_key="sk_session_...",
    escrow_enabled=True
)
print(f"Project funded: {result['project_id']} · policy={risk['hitlPolicy']}")`,
  },
  {
    id: 'curl',
    label: 'predict_and_escalate.sh',
    code: `# Ask a real human coordinator to approve an agent proposal
curl -X POST https://api.pabandi.com/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "pabandi_request_human_review",
      "arguments": {
        "agentId": "agent_sentinel_01",
        "businessId": "biz_123",
        "title": "Approve emergency dispatch ($450 USDC)",
        "proposedAction": { "technicianId": "tech_9", "notifyWhatsApp": true }
      }
    }
  }'`,
  },
];

export default function AgentsLandingPage() {
  const { isAuthenticated } = useAuthStore();
  const [activeCode, setActiveCode] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleGenerateKey = async () => {
    if (!isAuthenticated) {
      window.location.href = '/signup';
      return;
    }
    try {
      const response = await fetch('/api/v1/agents/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data?.apiKey) {
        alert(`M2M API Key generated:\n\n${data.data.apiKey}\n\nSave this key securely - it won't be shown again.`);
      } else {
        alert('Failed to generate API key');
      }
    } catch {
      alert('Error generating API key');
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(CODE_TABS[activeCode].code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pg-root">
      <div className="pg-grid-bg" aria-hidden="true" />
      <div className="pg-aurora a1" aria-hidden="true" />
      <div className="pg-aurora a2" aria-hidden="true" />

      <GlassNavHeader />

      <main className="pg-container" style={{ paddingTop: 56, paddingBottom: 96 }}>
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono mb-6" style={{ background: 'rgba(124,140,255,0.12)', border: '1px solid rgba(124,140,255,0.35)', color: '#c4cbff' }}>
            <Bot className="w-3.5 h-3.5" />
            <span>MCP NATIVE · BAYESIAN RISK · A2H BRIDGE</span>
          </div>

          <h1 style={{ fontFamily: 'var(--pg-display)', fontSize: 'clamp(36px, 5vw, 58px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 700, margin: '0 0 18px' }}>
            The runtime for <span className="pg-grad">agent-to-human commerce.</span>
          </h1>
          <p style={{ color: 'var(--pg-muted)', fontSize: 18, lineHeight: 1.6, maxWidth: 640, margin: '0 auto 28px' }}>
            Give AI agents a safe way to discover providers, predict fulfillment risk, lock non-custodial escrow, and escalate to real humans when policy requires it.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={handleGenerateKey} className="pg-btn pg-btn-primary pg-btn-lg">
              <Key className="w-4 h-4" />
              Generate Agent API Key
            </button>
            <Link to="/developers" className="pg-btn pg-btn-ghost pg-btn-lg">
              <Zap className="w-4 h-4" />
              Explore API &amp; MCP Docs
            </Link>
            <a
              href={`${API_HOST}/.well-known/agent.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="pg-btn pg-btn-ghost pg-btn-lg"
            >
              Agent Card (.well-known)
            </a>
          </div>
        </section>

        {/* Core Agent Capabilities */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {[
            {
              icon: <Cpu className="w-5 h-5" style={{ color: 'var(--pg-amber)' }} />,
              tag: 'PREDICTIVE ML',
              title: 'Bayesian Risk Engine',
              desc: 'Call pabandi_predict_task_risk and pabandi_predict_deal_risk before locking funds to get completion odds, dynamic collateral, and XAI factors.',
            },
            {
              icon: <ShieldCheck className="w-5 h-5" style={{ color: 'var(--pg-green)' }} />,
              tag: 'SESSION ABSTRACTION',
              title: 'Gasless Session Keys',
              desc: 'Open one spending tab priced by Trust Score, execute 50+ metered MCP tool calls, and settle once on Solana with ed25519 receipts.',
            },
            {
              icon: <Bot className="w-5 h-5" style={{ color: 'var(--pg-teal)' }} />,
              tag: 'HUMAN-IN-THE-LOOP',
              title: '1-Tap Human Escalation',
              desc: 'When risk exceeds your autonomy policy, call pabandi_request_human_review to route proposals to a live coordinator queue.',
            },
          ].map((card) => (
            <div key={card.title} className="pg-glass p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--pg-line)' }}>
                  {card.icon}
                </div>
                <span className="pg-badge">{card.tag}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--pg-display)', fontSize: 18, fontWeight: 700, margin: 0 }}>{card.title}</h3>
              <p style={{ color: 'var(--pg-muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{card.desc}</p>
            </div>
          ))}
        </section>

        {/* Interactive M2M Simulator wrapped in Glass */}
        <section className="mb-16">
          <div className="pg-glass p-3 sm:p-5">
            <M2MSimulator />
          </div>
        </section>

        {/* Quick Integration Code Block */}
        <section className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="pg-eyebrow">Quick Integration</span>
            <h2 style={{ fontFamily: 'var(--pg-display)', fontSize: 'clamp(26px, 3.2vw, 36px)', fontWeight: 700, margin: '8px 0 8px' }}>
              Connect in under two minutes
            </h2>
            <p style={{ color: 'var(--pg-muted)', fontSize: 15, margin: 0 }}>
              Native Model Context Protocol, Python SDK, or plain HTTP JSON-RPC.
            </p>
          </div>

          <div className="pg-glass overflow-hidden">
            <div className="flex items-center gap-1 px-3 pt-2 border-b" style={{ borderColor: 'var(--pg-line)', background: 'rgba(0,0,0,0.25)' }}>
              <Code className="w-4 h-4 mr-2" style={{ color: 'var(--pg-clay)' }} />
              {CODE_TABS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setActiveCode(i)}
                  className="px-3 py-2 text-xs font-mono transition-colors"
                  style={{
                    color: activeCode === i ? 'var(--pg-ink)' : 'var(--pg-dim)',
                    borderBottom: activeCode === i ? '2px solid var(--pg-clay)' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={copyCode}
                className="ml-auto mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono"
                style={{ background: 'var(--pg-glass-2)', border: '1px solid var(--pg-line)', color: 'var(--pg-muted)' }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <pre className="p-6 overflow-x-auto text-sm leading-relaxed m-0" style={{ fontFamily: 'var(--pg-mono)', color: '#d7dbe6' }}>
              <code>{CODE_TABS[activeCode].code}</code>
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}
