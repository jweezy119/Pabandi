import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code2,
  Terminal,
  Cpu,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  Layers,
  FileCode,
  Key,
  Globe2,
  Send,
  Play
} from 'lucide-react';
import '../styles/pbn-tokens.css';

const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "pabandi": {
      "command": "node",
      "args": ["dist/mcp/pabandiMcpServer.js"],
      "env": {
        "PABANDI_API_URL": "https://pabandi.onrender.com",
        "PABANDI_API_KEY": "YOUR_PABANDI_API_KEY"
      }
    }
  }
}`;

const SHARIA_TOOL_CALL = `{
  "tool": "pabandi_check_sharia_compliance",
  "arguments": {
    "standard": "AAOIFI",
    "requireRibaFree": true
  }
}`;

const SHARIA_TOOL_RESPONSE = `{
  "is_compliant": true,
  "standard": "AAOIFI Sharia Standards",
  "principles": {
    "riba_free": true,
    "gharar_mitigated": true,
    "mudarabah_profit_share": true,
    "asset_backed": true
  },
  "settlement_rails": ["raast", "solana_usdc", "square"],
  "certificate_url": "https://pabandi.com/sharia-compliance"
}`;

const RECOMMEND_RAIL_CURL = `curl -s "https://pabandi.onrender.com/api/v1/payments/recommend-rail?amount=100&currency=USD"`;

const ANCHOR_ESCROW_CODE = `import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

// Initialize Anchor Escrow for verified service delivery
async function createPabandiEscrow({
  provider,
  programId,
  bookingId,
  amountUsdc,
  sellerPubkey
}) {
  const program = new Program(IDL, programId, provider);
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('booking_escrow'), Buffer.from(bookingId)],
    program.programId
  );

  // Escrow locks funds non-custodially until milestone verification
  const tx = await program.methods
    .initializeBookingEscrow(bookingId, new BN(amountUsdc * 1e6))
    .accounts({
      buyer: provider.wallet.publicKey,
      seller: sellerPubkey,
      escrowAccount: escrowPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log('Escrow confirmed on-chain:', tx);
  return { escrowPda: escrowPda.toBase58(), tx };
}`;

export default function DevelopersPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mcp' | 'api' | 'anchor'>('mcp');
  const [testAmount, setTestAmount] = useState('100');
  const [testCurrency, setTestCurrency] = useState('USD');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunRailTest = async () => {
    setApiLoading(true);
    setApiResponse(null);
    try {
      const res = await fetch(
        `https://pabandi.onrender.com/api/v1/payments/recommend-rail?amount=${encodeURIComponent(
          testAmount
        )}&currency=${encodeURIComponent(testCurrency)}`
      );
      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setApiResponse(
        JSON.stringify(
          {
            error: 'Failed to contact API',
            message: e?.message || 'Network error',
          },
          null,
          2
        )
      );
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen text-[#e8eef4] selection:bg-[#4fd1c5] selection:text-[#0a1118]"
      style={{
        backgroundColor: 'var(--pbn-bg, #0a1118)',
        fontFamily: "var(--pbn-font-ui, 'Space Grotesk', system-ui, sans-serif)",
      }}
    >
      {/* ── Top Header ── */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#101a24]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-mono text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors focus-visible:ring-2 focus-visible:ring-[#4fd1c5] focus-visible:outline-none rounded px-2 py-1"
            >
              <ArrowLeft size={14} />
              <span>Pabandi Core</span>
            </Link>
            <span className="text-[rgba(255,255,255,0.16)] font-mono">/</span>
            <span className="text-xs font-mono text-[#4fd1c5] font-semibold tracking-wide uppercase">
              Developer & Agent Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/sharia-compliance"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8a9aa8] hover:text-[#e8eef4] bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg hover:border-[#4fd1c5]/40 transition-colors"
            >
              <ShieldCheck size={13} className="text-[#34d399]" />
              <span className="hidden sm:inline">Sharia Certificate</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-14 pb-16 border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-[#4fd1c5] bg-[#4fd1c5]/10 border border-[#4fd1c5]/30">
            <Cpu size={14} />
            <span>Autonomous Agent Protocol & Developer SDK</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#e8eef4] leading-tight">
            Programmable Commerce & <br className="hidden sm:inline" />
            <span className="text-[#4fd1c5]">Sharia-Compliant Agent Rails</span>
          </h1>

          <p className="text-base text-[#8a9aa8] max-w-2xl mx-auto leading-relaxed">
            Build with Pabandi’s Model Context Protocol (MCP) server, REST APIs, and Anchor smart contracts.
            Empower AI agents to negotiate bookings, verify Islamic Finance compliance, and trigger zero-fee multi-rail escrows.
          </p>

          {/* Quick Jump Pills */}
          <div className="pt-2 flex flex-wrap justify-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('mcp')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'mcp'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              1. MCP Server for Agents
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'api'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              2. Interactive REST API
            </button>
            <button
              onClick={() => setActiveTab('anchor')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'anchor'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              3. Solana Anchor Escrow
            </button>
          </div>
        </div>
      </section>

      {/* ── Content Sections ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        {/* SECTION 1: MCP Server for AI Agents */}
        <section id="mcp-section" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4fd1c5]/10 border border-[#4fd1c5]/20 flex items-center justify-center text-[#4fd1c5]">
              <Cpu size={20} />
            </div>
            <div>
              <span className="text-xs font-mono text-[#4fd1c5] uppercase tracking-wider">Section 1</span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">MCP Server for AI Agents</h2>
            </div>
          </div>

          <p className="text-sm text-[#8a9aa8] leading-relaxed">
            The Pabandi Model Context Protocol (MCP) server enables Claude, OpenAI, Cursor, and autonomous agents to 
            query Sharia compliance, calculate smart settlement routes, and automate escrow releases.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sub-card A: Configuration */}
            <div className="p-5 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-[#e8eef4]">claude_desktop_config.json</span>
                  <button
                    onClick={() => handleCopy('mcp-config', MCP_CONFIG_JSON)}
                    className="p-1.5 rounded-md hover:bg-white/10 text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors"
                    title="Copy configuration"
                  >
                    {copiedKey === 'mcp-config' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-[#34d399] overflow-x-auto">
                  {MCP_CONFIG_JSON}
                </pre>
              </div>
              <p className="text-xs text-[#8a9aa8] mt-3">
                Mounts the official stdio transport layer for sub-millisecond local execution.
              </p>
            </div>

            {/* Sub-card B: Sharia Tool Call */}
            <div className="p-5 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-[#e8eef4]">Tool: pabandi_check_sharia_compliance</span>
                  <button
                    onClick={() => handleCopy('mcp-tool', SHARIA_TOOL_CALL)}
                    className="p-1.5 rounded-md hover:bg-white/10 text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors"
                  >
                    {copiedKey === 'mcp-tool' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-[#4fd1c5] overflow-x-auto">
                  {SHARIA_TOOL_CALL}
                </pre>
                <div className="text-[11px] font-mono text-[#8a9aa8] pt-1">Response Output:</div>
                <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-[11px] text-[#8a9aa8] overflow-x-auto">
                  {SHARIA_TOOL_RESPONSE}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: API Documentation & Live Test */}
        <section id="api-section" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Globe2 size={20} />
            </div>
            <div>
              <span className="text-xs font-mono text-[#34d399] uppercase tracking-wider">Section 2</span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">API Documentation & Interactive Tester</h2>
            </div>
          </div>

          <p className="text-sm text-[#8a9aa8] leading-relaxed">
            REST endpoints for multi-rail settlement routing, Sharia compliance verification, and deterministic escrow state.
          </p>

          <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  GET
                </span>
                <span className="font-mono text-xs sm:text-sm text-[#e8eef4]">/api/v1/payments/recommend-rail</span>
              </div>
              <button
                onClick={() => handleCopy('curl-recommend', RECOMMEND_RAIL_CURL)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors"
              >
                {copiedKey === 'curl-recommend' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>Copy cURL</span>
              </button>
            </div>

            {/* Interactive Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-[#8a9aa8] mb-1.5">Amount</label>
                <input
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-sm font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#8a9aa8] mb-1.5">Currency</label>
                <select
                  value={testCurrency}
                  onChange={(e) => setTestCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-sm font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                >
                  <option value="USD">USD</option>
                  <option value="PKR">PKR</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleRunRailTest}
                  disabled={apiLoading}
                  className="w-full h-[42px] px-4 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-xs font-mono inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play size={13} />
                  <span>{apiLoading ? 'Querying API...' : 'Run Live Query'}</span>
                </button>
              </div>
            </div>

            {/* Live Response Box */}
            {apiResponse && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-mono text-[#8a9aa8]">Server JSON Response:</span>
                <pre className="p-4 rounded-xl bg-[#0a1118] border border-white/10 font-mono text-xs text-[#34d399] overflow-x-auto max-h-72">
                  {apiResponse}
                </pre>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3: Solana Escrow Integration */}
        <section id="anchor-section" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Layers size={20} />
            </div>
            <div>
              <span className="text-xs font-mono text-purple-300 uppercase tracking-wider">Section 3</span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">Solana Anchor Escrow Integration</h2>
            </div>
          </div>

          <p className="text-sm text-[#8a9aa8] leading-relaxed">
            Pabandi’s smart contracts are compiled using the Anchor Framework on Solana. All buyer deposits are held in 
            deterministic Program Derived Addresses (PDAs) with zero custodial commingling.
          </p>

          <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-mono font-semibold text-[#e8eef4]">escrow_client.ts (Anchor v0.30+)</span>
              <button
                onClick={() => handleCopy('anchor-code', ANCHOR_ESCROW_CODE)}
                className="p-1.5 rounded-md hover:bg-white/10 text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors"
              >
                {copiedKey === 'anchor-code' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-[#e8eef4] overflow-x-auto leading-relaxed">
              {ANCHOR_ESCROW_CODE}
            </pre>
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[rgba(255,255,255,0.08)] py-8 text-center text-xs font-mono text-[#8a9aa8]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 Pabandi. Developer API & Protocol Tools.</span>
          <div className="flex items-center gap-4">
            <Link to="/sharia-compliance" className="hover:text-[#4fd1c5] transition-colors">
              Sharia Compliance
            </Link>
            <Link to="/impact" className="hover:text-[#4fd1c5] transition-colors">
              Financial Inclusion
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

