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
  Play,
  RotateCcw,
  Sparkles,
  Server,
  BookOpen,
  ArrowRight,
  Share2,
  Package
} from 'lucide-react';
import { PabandiPaymentElement } from '../components/sdk/PabandiPaymentElement';
import '../styles/pbn-tokens.css';

const ORCHESTRATION_POST_CURL = `curl -X POST "https://pabandi.onrender.com/api/v1/payments" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: idemp_${Date.now()}" \\
  -d '{
    "amount": 100,
    "currency": "USD",
    "reference": "order_78942",
    "preferredRail": "auto",
    "requireSharia": true,
    "payer": { "email": "client@example.com" },
    "payee": { "wallet": "GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre" }
  }'`;

const CONNECTOR_RAAST_CURL = `curl -X POST "https://pabandi.onrender.com/api/v1/connectors/raast/payments" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 28000,
    "currency": "PKR",
    "reference": "invoice_pk_9901",
    "payee": { "raastId": "03001234567" }
  }'`;

const HTTP_402_AGENT_CURL = `curl -i -X GET "https://pabandi.onrender.com/api/v1/agent/premium-resource" \\
  -H "User-Agent: AutonomousAgent/1.0"`;

const HTTP_402_RESPONSE_EXAMPLE = `HTTP/2 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cHM6Ly...
WWW-Authenticate: X-Pabandi-Payment-Required amount="0.05", currency="USDC", network="solana"

{
  "status": 402,
  "error": "Payment Required",
  "message": "This resource requires an autonomous agent micropayment of 0.05 USDC.",
  "paymentDetails": {
    "scheme": "exact",
    "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    "amount": "50000",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "payTo": "GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre"
  }
}`;

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

const MCP_INTENT_TOOL_CALL = `{
  "tool": "pabandi_create_payment_intent",
  "arguments": {
    "amount": 100,
    "currency": "USD",
    "preferredRail": "auto",
    "requireSharia": true,
    "reference": "booking_agent_991"
  }
}`;

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

const PAYMENT_LINKS_POST_CURL = `curl -X POST "https://pabandi.onrender.com/api/v1/payment-links" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "ali-roofing",
    "title": "Roof Inspection & Repair",
    "amount": 75,
    "currency": "USD",
    "merchantName": "Ali Roofing Services",
    "merchantRaastId": "03001234567"
  }'`;

const SDK_HTML_SNIPPET = `<!-- 1. Load Pabandi Universal Checkout SDK -->
<script src="https://pabandi.com/sdk/v1/pabandi.js"></script>

<!-- 2. Mount Container -->
<div id="pabandi-checkout"></div>

<script>
  const checkout = new PabandiCheckout({
    elementId: 'pabandi-checkout',
    amount: 100,
    currency: 'USD',
    reference: 'order_12345',
    requireSharia: true,
    onSuccess: (details) => {
      console.log('Payment settled in escrow:', details);
    }
  });
  checkout.mount();
</script>`;

const SDK_REACT_SNIPPET = `import { PabandiPaymentElement } from '@pabandi/react';

export function CheckoutPage() {
  return (
    <PabandiPaymentElement
      amount={100}
      currency="USD"
      referenceId="inv_88192"
      merchantName="Karachi Tech Hub"
      merchantRaastId="03001234567"
      requireSharia={true}
      onSuccess={(rail, details) => {
        alert('Settled via ' + rail);
      }}
    />
  );
}`;

export default function DevelopersPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orchestrator' | 'links' | 'sdk' | 'connectors' | 'agent402' | 'mcp'>('orchestrator');

  // Mode A Interactive Sandbox State
  const [orchestratorAmount, setOrchestratorAmount] = useState('100');
  const [orchestratorCurrency, setOrchestratorCurrency] = useState('USD');
  const [orchestratorRail, setOrchestratorRail] = useState('auto');
  const [orchestratorSharia, setOrchestratorSharia] = useState(true);
  const [orchestratorLoading, setOrchestratorLoading] = useState(false);
  const [orchestratorResponse, setOrchestratorResponse] = useState<string | null>(null);

  // HTTP 402 Simulator State
  const [sim402State, setSim402State] = useState<'idle' | 'challenged' | 'paid'>('idle');

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunOrchestration = async () => {
    setOrchestratorLoading(true);
    setOrchestratorResponse(null);
    try {
      const res = await fetch('https://pabandi.onrender.com/api/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `demo_${Date.now()}`,
        },
        body: JSON.stringify({
          amount: Number(orchestratorAmount),
          currency: orchestratorCurrency,
          reference: `demo_${Date.now()}`,
          preferredRail: orchestratorRail,
          requireSharia: orchestratorSharia,
          payer: { email: 'developer@sandbox.pabandi.com' },
          payee: { wallet: 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre', raastId: '03001234567' },
        }),
      });
      const data = await res.json();
      setOrchestratorResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setOrchestratorResponse(JSON.stringify({ error: 'Network error', message: e?.message }, null, 2));
    } finally {
      setOrchestratorLoading(false);
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
              Payment Orchestration & Agent Infrastructure
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/sharia-compliance"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8a9aa8] hover:text-[#e8eef4] bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg hover:border-[#4fd1c5]/40 transition-colors"
            >
              <ShieldCheck size={13} className="text-[#34d399]" />
              <span className="hidden sm:inline">AAOIFI Compliance</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-14 pb-16 border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-[#4fd1c5] bg-[#4fd1c5]/10 border border-[#4fd1c5]/30">
            <Layers size={14} />
            <span>Open Payment Infrastructure Layer (Hyperswitch Model)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#e8eef4] leading-tight">
            One API for Cards, SBP Raast, & <br className="hidden sm:inline" />
            <span className="text-[#4fd1c5]">Autonomous Solana Agent Payments</span>
          </h1>

          <p className="text-base text-[#8a9aa8] max-w-2xl mx-auto leading-relaxed">
            Pabandi normalizes multiple heterogeneous payment rails behind a single, resilient API contract.
            Route automatically based on fees, speed, and Islamic Finance compliance — or connect directly beneath your stack.
          </p>

          {/* Quick Jump Pills */}
          <div className="pt-3 flex flex-wrap justify-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('orchestrator')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'orchestrator'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold shadow-[0_0_15px_rgba(79,209,197,0.3)]'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              Mode A: Orchestrator API
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'links'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold shadow-[0_0_15px_rgba(79,209,197,0.3)]'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              Universal Payment Links
            </button>
            <button
              onClick={() => setActiveTab('sdk')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'sdk'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold shadow-[0_0_15px_rgba(79,209,197,0.3)]'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              Drop-in Checkout SDK
            </button>
            <button
              onClick={() => setActiveTab('connectors')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'connectors'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold shadow-[0_0_15px_rgba(79,209,197,0.3)]'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              Mode B: Direct Connectors
            </button>
            <button
              onClick={() => setActiveTab('agent402')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'agent402'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold shadow-[0_0_15px_rgba(79,209,197,0.3)]'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              HTTP 402 / MPP
            </button>
            <button
              onClick={() => setActiveTab('mcp')}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'mcp'
                  ? 'bg-[#4fd1c5] text-[#0a1118] font-bold shadow-[0_0_15px_rgba(79,209,197,0.3)]'
                  : 'bg-white/[0.04] text-[#8a9aa8] hover:text-[#e8eef4] border border-white/10'
              }`}
            >
              Agent MCP Tools
            </button>
          </div>
        </div>
      </section>

      {/* ── The 4-Layer Stack Architecture Visualization ── */}
      <section className="py-12 border-b border-white/5 bg-[#101a24]/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">The Four-Layer Infrastructure Stack</h2>
            <p className="text-xs sm:text-sm text-[#8a9aa8] mt-1">
              Engineered for resilience, automated failover, and strict double-entry ledgering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0a1118] border border-white/10 space-y-2">
              <span className="text-[10px] font-mono text-[#4fd1c5] uppercase tracking-wider font-bold">Layer 1</span>
              <h3 className="text-sm font-bold text-[#e8eef4]">Provider Connectors</h3>
              <p className="text-xs text-[#8a9aa8] leading-relaxed">
                Isolated adapters for Solana Pay, SBP Raast ISO 20022, Stripe, and JazzCash/EasyPaisa mobile money.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0a1118] border border-white/10 space-y-2">
              <span className="text-[10px] font-mono text-[#34d399] uppercase tracking-wider font-bold">Layer 2</span>
              <h3 className="text-sm font-bold text-[#e8eef4]">Orchestration Brain</h3>
              <p className="text-xs text-[#8a9aa8] leading-relaxed">
                Dynamic routing engine evaluating cost, speed, Sharia compliance, and automatic failover retries.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0a1118] border border-white/10 space-y-2">
              <span className="text-[10px] font-mono text-purple-300 uppercase tracking-wider font-bold">Layer 3</span>
              <h3 className="text-sm font-bold text-[#e8eef4]">Unified API & x402</h3>
              <p className="text-xs text-[#8a9aa8] leading-relaxed">
                Rail-agnostic endpoints for human checkouts, webhook dispatch, and HTTP 402 Machine Payments.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0a1118] border border-white/10 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">Layer 4</span>
              <h3 className="text-sm font-bold text-[#e8eef4]">Double-Entry Ledger</h3>
              <p className="text-xs text-[#8a9aa8] leading-relaxed">
                Immutable journal of debits and credits that cryptographically updates user Trust Scores upon settlement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content Tabs ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        {/* TAB 1: MODE A - PAYMENT ORCHESTRATOR */}
        {activeTab === 'orchestrator' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4fd1c5]/10 border border-[#4fd1c5]/20 flex items-center justify-center text-[#4fd1c5]">
                <Layers size={20} />
              </div>
              <div>
                <span className="text-xs font-mono text-[#4fd1c5] uppercase tracking-wider">Mode A (On Top)</span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">Pabandi as the Universal Orchestrator</h2>
              </div>
            </div>

            <p className="text-sm text-[#8a9aa8] leading-relaxed">
              Integrate with a single endpoint: <code className="text-[#4fd1c5]">POST /api/v1/payments</code>. 
              Pabandi selects the optimal rail, performs idempotency checks, and handles failovers automatically.
            </p>

            <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#4fd1c5]/20 text-[#4fd1c5] border border-[#4fd1c5]/30">
                    POST
                  </span>
                  <span className="font-mono text-xs sm:text-sm text-[#e8eef4]">/api/v1/payments</span>
                </div>
                <button
                  onClick={() => handleCopy('curl-orchestrator', ORCHESTRATION_POST_CURL)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors"
                >
                  {copiedKey === 'curl-orchestrator' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>Copy cURL</span>
                </button>
              </div>

              {/* Interactive Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#8a9aa8] mb-1.5">Amount</label>
                  <input
                    type="number"
                    value={orchestratorAmount}
                    onChange={(e) => setOrchestratorAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-sm font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#8a9aa8] mb-1.5">Currency</label>
                  <select
                    value={orchestratorCurrency}
                    onChange={(e) => setOrchestratorCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-sm font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                  >
                    <option value="USD">USD</option>
                    <option value="PKR">PKR</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#8a9aa8] mb-1.5">Routing Mode</label>
                  <select
                    value={orchestratorRail}
                    onChange={(e) => setOrchestratorRail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a1118] border border-white/10 text-sm font-mono text-[#e8eef4] focus:outline-none focus:border-[#4fd1c5]"
                  >
                    <option value="auto">Auto (Smart Brain)</option>
                    <option value="solana">Solana USDC Escrow</option>
                    <option value="raast">SBP Raast Rail</option>
                    <option value="jazzcash">JazzCash / EasyPaisa</option>
                    <option value="stripe">Stripe / Card</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-mono text-[#e8eef4]">
                    <input
                      type="checkbox"
                      checked={orchestratorSharia}
                      onChange={(e) => setOrchestratorSharia(e.target.checked)}
                      className="rounded border-white/20 text-[#4fd1c5] focus:ring-[#4fd1c5]"
                    />
                    <span>Require Sharia</span>
                  </label>
                </div>
              </div>

              <div>
                <button
                  onClick={handleRunOrchestration}
                  disabled={orchestratorLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-xs font-mono inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play size={14} />
                  <span>{orchestratorLoading ? 'Orchestrating...' : 'Trigger Orchestrated Payment'}</span>
                </button>
              </div>

              {orchestratorResponse && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-mono text-[#8a9aa8]">Orchestrator Unified Response:</span>
                  <pre className="p-4 rounded-xl bg-[#0a1118] border border-white/10 font-mono text-xs text-[#34d399] overflow-x-auto max-h-80 leading-relaxed">
                    {orchestratorResponse}
                  </pre>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB: UNIVERSAL PAYMENT LINKS */}
        {activeTab === 'links' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4fd1c5]/10 border border-[#4fd1c5]/20 flex items-center justify-center text-[#4fd1c5]">
                <Share2 size={20} />
              </div>
              <div>
                <span className="text-xs font-mono text-[#4fd1c5] uppercase tracking-wider">No-Code Commerce</span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">Shareable Universal Payment Links</h2>
              </div>
            </div>

            <p className="text-sm text-[#8a9aa8] leading-relaxed">
              Generate instant, shareable escrow payment links that work seamlessly over WhatsApp, SMS, and invoices.
              Overseas clients pay in USD with cards or Solana USDC; workers receive 0%-fee PKR via SBP Raast.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: API Endpoint */}
              <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-mono font-bold text-[#4fd1c5]">POST /api/v1/payment-links</span>
                  <button
                    onClick={() => handleCopy('curl-links', PAYMENT_LINKS_POST_CURL)}
                    className="p-1 text-[#8a9aa8] hover:text-[#4fd1c5]"
                  >
                    {copiedKey === 'curl-links' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="text-xs text-[#8a9aa8]">
                  Creates a persistent link with merchant trust score, customized title, optional fixed or flexible amounts, and pre-formatted WhatsApp share URLs.
                </p>
                <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-[#34d399] overflow-x-auto">
                  {PAYMENT_LINKS_POST_CURL}
                </pre>
              </div>

              {/* Card 2: Live Link Showcase */}
              <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-xs font-mono text-[#8a9aa8] uppercase tracking-wider font-bold">Zero-Config Instant Handles</span>
                  <h3 className="text-base font-bold text-[#e8eef4]">Dynamic URL Pattern</h3>
                  <div className="p-3 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-emerald-400 break-all">
                    https://pabandi.com/pay/link/<span className="text-white font-bold">:slug</span>?amount=100&currency=USD
                  </div>
                  <p className="text-xs text-[#8a9aa8] leading-relaxed">
                    Any freelancer or contractor can immediately start accepting escrow payments by sharing their customized handle over WhatsApp.
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 flex gap-3">
                  <Link
                    to="/pay/link/quick-escrow"
                    className="px-4 py-2.5 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-xs font-mono inline-flex items-center gap-2 transition-colors"
                  >
                    <span>Open Live Payment Link Demo</span>
                    <ExternalLink size={14} />
                  </Link>
                  <Link
                    to="/payment-links"
                    className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#e8eef4] border border-white/10 text-xs font-mono inline-flex items-center gap-2 transition-colors"
                  >
                    <span>Launch Link Creator</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB: EMBEDDABLE DROP-IN CHECKOUT SDK */}
        {activeTab === 'sdk' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Package size={20} />
              </div>
              <div>
                <span className="text-xs font-mono text-purple-300 uppercase tracking-wider">Embeddable UI</span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">Drop-in Universal Checkout SDK</h2>
              </div>
            </div>

            <p className="text-sm text-[#8a9aa8] leading-relaxed">
              Embed Pabandi into any React application, Shopify storefront, Webflow site, or custom HTML page.
              Supports both script-tag embeds and direct React component exports.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left Column: Documentation & Code Snippets */}
              <div className="space-y-5">
                {/* Script Tag Embed */}
                <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-[#e8eef4]">HTML / Vanilla JS Drop-in</span>
                    <button
                      onClick={() => handleCopy('sdk-html', SDK_HTML_SNIPPET)}
                      className="p-1 text-[#8a9aa8] hover:text-[#4fd1c5]"
                    >
                      {copiedKey === 'sdk-html' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-[#34d399] overflow-x-auto">
                    {SDK_HTML_SNIPPET}
                  </pre>
                </div>

                {/* React Component Embed */}
                <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-[#e8eef4]">React Component Integration</span>
                    <button
                      onClick={() => handleCopy('sdk-react', SDK_REACT_SNIPPET)}
                      className="p-1 text-[#8a9aa8] hover:text-[#4fd1c5]"
                    >
                      {copiedKey === 'sdk-react' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-purple-300 overflow-x-auto">
                    {SDK_REACT_SNIPPET}
                  </pre>
                </div>
              </div>

              {/* Right Column: Live Working Drop-in Preview */}
              <div className="p-6 rounded-2xl bg-[#0d1620] border border-[#4fd1c5]/30 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-mono text-[#4fd1c5] font-bold uppercase tracking-wider">
                    Interactive Live SDK Component
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                    Live Demo
                  </span>
                </div>
                <p className="text-xs text-[#8a9aa8]">
                  This is the exact element your users will see when you mount the Pabandi SDK:
                </p>

                {/* Render the actual React Component live */}
                <div className="flex justify-center pt-2">
                  <PabandiPaymentElement
                    amount={100}
                    currency="USD"
                    referenceId="demo_live_widget"
                    merchantName="Karachi Engineering Works"
                    merchantRaastId="03001234567"
                    requireSharia={true}
                    onSuccess={(rail) => alert(`Interactive component demo succeeded on rail: ${rail}`)}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: MODE B - DIRECT CONNECTORS */}
        {activeTab === 'connectors' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Globe2 size={20} />
              </div>
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">Mode B (Beneath)</span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">Bring Your Own Processor (BYOP) Connectors</h2>
              </div>
            </div>

            <p className="text-sm text-[#8a9aa8] leading-relaxed">
              If your platform already maintains its own routing logic, plug directly into individual Pabandi rail connectors.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Connector Card 1: Raast */}
              <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400">POST /api/v1/connectors/raast/payments</span>
                  <button
                    onClick={() => handleCopy('curl-raast', CONNECTOR_RAAST_CURL)}
                    className="p-1 text-[#8a9aa8] hover:text-[#4fd1c5]"
                  >
                    {copiedKey === 'curl-raast' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="text-xs text-[#8a9aa8]">
                  State Bank of Pakistan instant rail. Generates EMVCo interoperable QR and processes 0% fee settlement.
                </p>
                <pre className="p-3 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-[11px] text-[#34d399] overflow-x-auto">
                  {CONNECTOR_RAAST_CURL}
                </pre>
              </div>

              {/* Connector Card 2: Solana Pay */}
              <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-purple-300">POST /api/v1/connectors/solana/payments</span>
                  <button
                    onClick={() => handleCopy('curl-solana-conn', `curl -X POST "https://pabandi.onrender.com/api/v1/connectors/solana/payments" -d '{"amount": 100, "currency": "USDC"}'`)}
                    className="p-1 text-[#8a9aa8] hover:text-[#4fd1c5]"
                  >
                    {copiedKey === 'curl-solana-conn' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="text-xs text-[#8a9aa8]">
                  Generates canonical <code>solana:</code> URI specification with reference public keys and Anchor escrow hooks.
                </p>
                <pre className="p-3 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-[11px] text-purple-300 overflow-x-auto">
{`curl -X POST "https://pabandi.onrender.com/api/v1/connectors/solana/payments" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "currency": "USDC"}'`}
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: HTTP 402 MACHINE PAYMENTS PROTOCOL */}
        {activeTab === 'agent402' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Cpu size={20} />
              </div>
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">Agent Economy</span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">HTTP 402 Machine Payments Protocol (x402 / MPP)</h2>
              </div>
            </div>

            <p className="text-sm text-[#8a9aa8] leading-relaxed">
              Monetize APIs and permit autonomous AI agents to negotiate, pay, and consume paid resources without humans in the loop.
              Compatible with the Coinbase CDP Facilitator and x402 v2 spec.
            </p>

            <div className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-mono text-[#e8eef4] font-semibold">GET /api/v1/agent/premium-resource</span>
                <button
                  onClick={() => handleCopy('curl-402', HTTP_402_AGENT_CURL)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors"
                >
                  {copiedKey === 'curl-402' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>Copy cURL</span>
                </button>
              </div>

              {/* Interactive 402 Challenge Walkthrough */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSim402State('challenged')}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-semibold hover:bg-amber-500/30 transition-colors"
                  >
                    1. Send Unauthenticated Request (Receive 402)
                  </button>
                  <button
                    onClick={() => setSim402State('paid')}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
                  >
                    2. Agent Resolves 402 & Retries With Proof
                  </button>
                  <button
                    onClick={() => setSim402State('idle')}
                    className="p-2 rounded-xl text-[#8a9aa8] hover:text-[#e8eef4]"
                    title="Reset"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {sim402State === 'challenged' && (
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-amber-400">Server Response: 402 Payment Required</span>
                    <pre className="p-4 rounded-xl bg-[#0a1118] border border-amber-500/30 font-mono text-xs text-amber-300 overflow-x-auto">
                      {HTTP_402_RESPONSE_EXAMPLE}
                    </pre>
                  </div>
                )}

                {sim402State === 'paid' && (
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-emerald-400">Agent Succeeded: HTTP 200 OK</span>
                    <pre className="p-4 rounded-xl bg-[#0a1118] border border-emerald-500/30 font-mono text-xs text-emerald-300 overflow-x-auto">
{`HTTP/2 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "resource": "Pabandi Premium Liquidity & Trust Telemetry",
    "networkHealth": {
      "solanaAnchor": "HEALTHY (0.4s finality)",
      "sbpRaast": "ONLINE (Instant clearing)",
      "jazzCashP2M": "ONLINE"
    },
    "verifiedTrustScoreAverage": 788,
    "authenticatedProof": "sig_confirmed_on_chain"
  }
}`}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: AGENT MCP TOOLS */}
        {activeTab === 'mcp' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4fd1c5]/10 border border-[#4fd1c5]/20 flex items-center justify-center text-[#4fd1c5]">
                <Cpu size={20} />
              </div>
              <div>
                <span className="text-xs font-mono text-[#4fd1c5] uppercase tracking-wider">Model Context Protocol</span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#e8eef4]">MCP Server for AI Agents</h2>
              </div>
            </div>

            <p className="text-sm text-[#8a9aa8] leading-relaxed">
              Connect Claude Desktop, Cursor, and autonomous agents directly to Pabandi’s Payment Orchestration tools.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-3">
                <span className="text-xs font-mono text-[#e8eef4] font-semibold">claude_desktop_config.json</span>
                <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-[#34d399] overflow-x-auto">
                  {MCP_CONFIG_JSON}
                </pre>
              </div>
              <div className="p-5 rounded-2xl bg-[#101a24] border border-white/10 space-y-3">
                <span className="text-xs font-mono text-[#e8eef4] font-semibold">Tool: pabandi_create_payment_intent</span>
                <pre className="p-3.5 rounded-xl bg-[#0a1118] border border-white/5 font-mono text-xs text-[#4fd1c5] overflow-x-auto">
                  {MCP_INTENT_TOOL_CALL}
                </pre>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[rgba(255,255,255,0.08)] py-8 text-center text-xs font-mono text-[#8a9aa8]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 Pabandi. Open Payment Orchestration & Trust Infrastructure.</span>
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
