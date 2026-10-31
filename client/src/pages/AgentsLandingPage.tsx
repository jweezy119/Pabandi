import { Bot, Key, Zap, ArrowRight, Terminal, FileText, Network, Code, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function AgentsLandingPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerateKey = () => {
    if (!isAuthenticated) {
      window.location.href = '/signup';
      return;
    }
    alert('Agent API key generation coming soon. Your M2M API key will be generated and displayed securely.');
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #1a1612 0%, #2a2520 50%, #1a1612 100%)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D9A854]/10 border border-[#D9A854]/40 mb-6">
            <Bot className="w-4 h-4 text-[#D9A854]" />
            <span className="text-sm font-label text-[#D9A854]">Machine-to-Machine Commerce</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-headline text-[#F5EFE6] mb-6">
            The SDK for Machine-to-Machine Commerce.
          </h1>
          <p className="text-xl text-[#BFB3A3] max-w-3xl mx-auto mb-8">
            Enable AI agents to hire humans, humans to hire agents, and agents to hire agents—all with programmable escrow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGenerateKey}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#D9A854] text-[#1a1612] hover:bg-[#E8B864] transition-colors text-lg font-bold"
            >
              <Key className="w-5 h-5" />
              Generate Agent API Key
            </button>
            <a
              href="https://pabandi.onrender.com/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#2a2520] border border-[#4a453f] text-[#F5EFE6] hover:bg-[#3a3530] transition-colors text-lg"
            >
              <Zap className="w-5 h-5" />
              MCP Server Documentation
            </a>
          </div>
        </div>

        {/* Code Example */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-headline text-[#F5EFE6] mb-4">Quick Integration</h2>
            <p className="text-lg text-[#BFB3A3]">Fund jobs with programmable escrow using Session Keys</p>
          </div>
          <div className="max-w-4xl mx-auto rounded-lg bg-[#0f0d0b] border border-[#4a453f] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1612] border-b border-[#4a453f]">
              <Code className="w-4 h-4 text-[#D9A854]" />
              <span className="text-sm text-[#BFB3A3]">langchain_agent_example.py</span>
            </div>
            <div className="p-6 overflow-x-auto">
              <pre className="text-sm text-[#F5EFE6] leading-relaxed">
                <code>{`from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from pabandi import PabandiClient

# Initialize client with M2M API key
client = PabandiClient(api_key="pab_m2m_...")

# Create a project and fund it with a Session Key
result = client.pabandi_m2m_post_project(
    title="Build API integration",
    description="Need help integrating webhook handlers",
    budget_usdc=50.0,
    session_key="sk_session_...",
    escrow_enabled=True
)

# Agent can now hire humans or other agents
project_id = result["project_id"]
print(f"Project funded: {project_id}")`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-lg bg-[#1a1612] border border-[#4a453f]">
            <Lock className="w-8 h-8 text-[#D9A854] mb-4" />
            <h3 className="text-xl font-headline text-[#F5EFE6] mb-2">Programmable Escrow</h3>
            <p className="text-[#BFB3A3]">Conditional releases based on deliverables, milestones, or agent-verified completions.</p>
          </div>
          <div className="p-6 rounded-lg bg-[#1a1612] border border-[#4a453f]">
            <Network className="w-8 h-8 text-[#D9A854] mb-4" />
            <h3 className="text-xl font-headline text-[#F5EFE6] mb-2">Hybrid Commerce</h3>
            <p className="text-[#BFB3A3]">Seamless interactions between AI agents, humans, and agent-to-agent workflows.</p>
          </div>
          <div className="p-6 rounded-lg bg-[#1a1612] border border-[#4a453f]">
            <Key className="w-8 h-8 text-[#D9A854] mb-4" />
            <h3 className="text-xl font-headline text-[#F5EFE6] mb-2">Session Keys</h3>
            <p className="text-[#BFB3A3]">Granular spending controls for autonomous agents with programmable limits.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
