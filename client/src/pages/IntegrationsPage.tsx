import { Bot, Terminal, FileText, Network, ArrowRight, CheckCircle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function IntegrationsPage() {
  const integrations = [
    {
      name: 'MCP (Model Context Protocol)',
      status: 'live',
      description: 'Connect to Pabandi from Claude, Cursor, Cline, Continue, RooCode, and any MCP client.',
      url: 'https://pabandi.onrender.com/mcp',
      docs: '/agents',
    },
    {
      name: 'A2A (Agent-to-Agent)',
      status: 'live',
      description: 'Agent Card for A2A protocol discovery and inter-agent collaboration.',
      url: '/.well-known/agent.json',
      docs: '/agents',
    },
    {
      name: 'OpenAPI',
      status: 'live',
      description: 'Auto-generate tools and integrations from our OpenAPI spec.',
      url: '/.well-known/openapi.json',
      docs: '/developers',
    },
    {
      name: 'Sign in with Pabandi',
      status: 'live',
      description: 'OAuth2/OIDC for external apps to authenticate with Trust Passports.',
      url: '/.well-known/openid-configuration',
      docs: '/developers',
    },
    {
      name: 'Verifiable Credentials',
      status: 'live',
      description: 'Portable, cryptographically verifiable trust credentials (W3C VC, did:web).',
      url: '/verify',
      docs: '/trust/passports',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--clay)]/10 border border-[var(--clay)]/30 mb-6">
            <Zap className="w-4 h-4 text-[var(--clay)]" />
            <span className="text-sm font-label text-[var(--clay)]">Integrations</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline text-[var(--warm-ink)] mb-4">
            Integrate Pabandi Anywhere
          </h1>
          <p className="text-lg text-[var(--soft-stone)] max-w-2xl mx-auto">
            Connect Pabandi's trust layer to your agents, tools, and workflows. MCP-first for instant compatibility.
          </p>
        </div>

        <div className="grid gap-4 mb-12">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="p-6 rounded-[var(--radius-card)] bg-white border border-[rgba(191,179,163,0.3)] shadow-[var(--shadow-soft)] flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-headline text-[var(--warm-ink)]">{integration.name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-label flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {integration.status}
                  </span>
                </div>
                <p className="text-[var(--soft-stone)] mb-2">{integration.description}</p>
                <code className="text-xs bg-[var(--warm-sand)] px-2 py-1 rounded">{integration.url}</code>
              </div>
              <div className="flex gap-2">
                <Link
                  to={integration.docs}
                  className="px-4 py-2 rounded-[var(--radius-btn)] bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] transition-colors text-sm flex items-center gap-1"
                >
                  Docs <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--clay)]/5 to-transparent border border-[rgba(201,123,90,0.3)] p-8">
          <h2 className="text-2xl font-headline text-[var(--warm-ink)] mb-4 text-center">MCP Quick Config</h2>
          <p className="text-center text-[var(--soft-stone)] mb-6">Add to your Claude, Cursor, Cline, or Continue config</p>
          <pre className="bg-[var(--warm-sand)]/60 p-4 rounded-[var(--radius-input)] overflow-x-auto text-xs">
{`{
  "mcpServers": {
    "pabandi": {
      "url": "https://pabandi.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer pab_YOUR_API_KEY"
      }
    }
  }
}`}
          </pre>
          <div className="text-center mt-4">
            <Link to="/agents/register" className="text-[var(--clay)] hover:underline">
              Get your API key →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
