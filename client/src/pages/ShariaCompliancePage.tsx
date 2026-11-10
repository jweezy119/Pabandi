import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Scale, 
  Coins, 
  Lock, 
  FileCheck, 
  Terminal, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Layers,
  Code2
} from 'lucide-react';
import '../styles/pbn-tokens.css';

// ── JSON-LD Structured Data Schema for AI Agents & Search Engines ─────────────
const SHARIA_SCHEMA_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FinancialProduct',
  'name': 'Pabandi Escrow',
  'description': 'Sharia-compliant non-custodial booking and escrow platform adhering to AAOIFI Islamic Finance standards.',
  'provider': {
    '@type': 'Organization',
    'name': 'Pabandi',
    'url': 'https://pabandi.com',
  },
  'compliance': {
    '@type': 'ComplianceStandard',
    'name': 'Islamic Finance (Sharia)',
    'status': 'Certified',
    'standard': 'AAOIFI Sharia Standards',
    'principles': [
      'No Riba (Zero Interest)',
      'No Gharar (Zero Ambiguity)',
      'No Maisir (Zero Speculation)'
    ]
  },
  'featureList': [
    'Mudarabah profit-sharing model',
    'Non-custodial Anchor escrow contracts',
    'Asset-backed USDC and Raast instant rails',
    'Zero interest penalties or compounding'
  ]
};

const MCP_SNIPPET = `{
  "name": "pabandi_check_sharia_compliance",
  "arguments": {}
}`;

const MCP_RESPONSE_SNIPPET = `{
  "is_compliant": true,
  "standard": "AAOIFI Sharia Standards",
  "features": {
    "riba_free": true,
    "gharar_mitigated": true,
    "asset_backed": true
  },
  "certificate_url": "https://pabandi.com/sharia-compliance"
}`;

const CURL_SNIPPET = `curl -s "https://pabandi.onrender.com/api/v1/sharia-compliance"`;

export default function ShariaCompliancePage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'mcp' | 'curl' | 'schema'>('mcp');
  const [showCertModal, setShowCertModal] = useState(false);

  // Keyboard accessibility: ESC closes certificate preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCertModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <main 
      className="min-h-screen text-[#e8eef4] selection:bg-[#4fd1c5] selection:text-[#0a1118]"
      style={{
        backgroundColor: 'var(--pbn-bg, #0a1118)',
        fontFamily: "var(--pbn-font-ui, 'Space Grotesk', system-ui, sans-serif)",
      }}
    >
      {/* ── Structured Data (JSON-LD) for Autonomous Agents & Web Crawlers ── */}
      <script 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SHARIA_SCHEMA_JSON_LD) }}
      />

      {/* ── Top Navigation Bar ── */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#101a24]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-xs font-mono text-[#8a9aa8] hover:text-[#4fd1c5] transition-colors focus-visible:ring-2 focus-visible:ring-[#4fd1c5] focus-visible:outline-none rounded px-2 py-1"
              aria-label="Navigate back to home"
            >
              <ArrowLeft size={14} />
              <span>Pabandi Core</span>
            </Link>
            <span className="text-[rgba(255,255,255,0.16)] font-mono">/</span>
            <span className="text-xs font-mono text-[#4fd1c5] font-semibold tracking-wide uppercase">
              Sharia Compliance
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>AAOIFI Standards Verified</span>
            </div>
            <a
              href="#agent-panel"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8a9aa8] hover:text-[#e8eef4] bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg hover:border-[#4fd1c5]/40 transition-colors"
            >
              <Terminal size={13} className="text-[#4fd1c5]" />
              <span className="hidden md:inline">Agent Verification</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-16 pb-20 border-b border-[rgba(255,255,255,0.08)]">
        {/* Subtle geometric background aura */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#4fd1c5]/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-[#4fd1c5] bg-[#4fd1c5]/10 border border-[#4fd1c5]/30">
            <Scale size={14} />
            <span>Islamic Finance Verification & Architectural Proof</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#e8eef4] leading-[1.15]">
            Finance without <span className="text-[#4fd1c5]">Riba</span>.<br />
            Trust without <span className="text-[#4fd1c5]">Gharar</span>.
          </h1>

          <p className="text-base sm:text-lg text-[#8a9aa8] max-w-2xl mx-auto font-normal leading-relaxed">
            Pabandi is built from the ground up on ethical, non-custodial, and interest-free infrastructure. 
            By aligning Solana Anchor smart contracts, deterministic escrow verification, and domestic zero-fee rails (Raast) 
            with Islamic Finance standards, we eliminate usury, ambiguity, and speculation across every booking.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setShowCertModal(true)}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-sm inline-flex items-center gap-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4fd1c5] focus-visible:outline-none"
            >
              <Download size={16} />
              <span>Download Sharia Certificate (PDF)</span>
            </button>

            <a
              href="#pillars"
              className="min-h-[48px] px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#e8eef4] border border-white/10 font-semibold text-sm inline-flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-[#4fd1c5] focus-visible:outline-none"
            >
              <span>Explore The 3 Pillars</span>
            </a>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-10 text-left">
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">Interest Rate</span>
              <span className="text-xl font-bold font-mono text-[#34d399] mt-0.5 block">0.00% Riba</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">No yield lending or compounding</span>
            </div>
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">Underlying Value</span>
              <span className="text-xl font-bold font-mono text-[#e8eef4] mt-0.5 block">100% Asset-Backed</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">1:1 Cash & USDC Escrow</span>
            </div>
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">Execution Model</span>
              <span className="text-xl font-bold font-mono text-[#4fd1c5] mt-0.5 block">Deterministic</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">Zero Gharar in contracts</span>
            </div>
            <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)]">
              <span className="block text-[11px] font-mono text-[#8a9aa8] uppercase tracking-wider">Tokenomics</span>
              <span className="text-xl font-bold font-mono text-[#fbbf24] mt-0.5 block">Utility-Only</span>
              <span className="text-[11px] text-[#8a9aa8] mt-1 block">Earned via labor, not Maisir</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── The 3 Pillars of Pabandi Compliance ── */}
      <section id="pillars" className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="text-xs font-mono text-[#4fd1c5] tracking-widest uppercase font-semibold">
            Architectural Alignment
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-[#e8eef4] tracking-tight">
            The Three Pillars of Sharia Compliance
          </h2>
          <p className="text-sm text-[#8a9aa8] leading-relaxed">
            Islamic finance demands transparency, mutual consent, and shared real-world enterprise. 
            Here is how each prohibition is addressed in code.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ── Pillar 1: No Riba ── */}
          <article className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] hover:border-[#4fd1c5]/40 transition-colors flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Coins size={22} />
              </div>
              <div>
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                  Pillar 1 • Ethics
                </span>
                <h3 className="text-xl font-bold text-[#e8eef4] mt-1">
                  No Riba (Interest)
                </h3>
                <span className="text-xs text-[#8a9aa8] font-mono">Structure: Mudarabah & Wakala</span>
              </div>

              {/* Plain language quote callout */}
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border-l-2 border-emerald-400 text-xs text-[#e8eef4] leading-relaxed font-sans">
                <span className="font-semibold text-emerald-400">In Plain English:</span> "Instead of paying you fixed interest (which is forbidden), we share a small portion of the actual profits generated by the escrow vault."
              </div>

              <div className="space-y-2 text-xs text-[#8a9aa8] leading-relaxed">
                <p>
                  Pabandi never lends customer deposits out to third parties or engages in debt monetisation. 
                  Unlike conventional banks, 100% of escrow balances are segregated and non-hypothecated.
                </p>
                <p>
                  Platform fees reflect direct administrative agency fees (<em>Wakala</em>) or legitimate enterprise profit-sharing (<em>Mudarabah</em>), with zero late-payment penalties or interest compounding.
                </p>
              </div>
            </div>

            <ul className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-2 text-[12px] font-mono text-[#e8eef4]">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Zero interest charged or paid</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Non-hypothecated escrow accounts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>No debt trading or discounting</span>
              </li>
            </ul>
          </article>

          {/* ── Pillar 2: No Gharar ── */}
          <article className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] hover:border-[#4fd1c5]/40 transition-colors flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[#4fd1c5]">
                <Lock size={22} />
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#4fd1c5] uppercase tracking-wider font-semibold">
                  Pillar 2 • Transparency
                </span>
                <h3 className="text-xl font-bold text-[#e8eef4] mt-1">
                  No Gharar (Uncertainty)
                </h3>
                <span className="text-xs text-[#8a9aa8] font-mono">Structure: Deterministic Anchor PDA</span>
              </div>

              {/* Plain language quote callout */}
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border-l-2 border-[#4fd1c5] text-xs text-[#e8eef4] leading-relaxed font-sans">
                <span className="font-semibold text-[#4fd1c5]">In Plain English:</span> "You know exactly what you are paying for, and the funds are locked until the job is finished. There are no hidden fees or surprises."
              </div>

              <div className="space-y-2 text-xs text-[#8a9aa8] leading-relaxed">
                <p>
                  Gharar involves deceptive ambiguity or unpredictable outcomes. Pabandi locks exact booking terms, service parameters, and settlement amounts inside on-chain smart contracts.
                </p>
                <p>
                  Funds release only upon verifiable milestone completion (such as GPS check-in or client signature). The <em>Sulha</em> dispute mechanism resolves disagreements via clear, pre-stipulated rules.
                </p>
              </div>
            </div>

            <ul className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-2 text-[12px] font-mono text-[#e8eef4]">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[#4fd1c5] shrink-0" />
                <span>Exact terms locked at checkout</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[#4fd1c5] shrink-0" />
                <span>Deterministic milestone releases</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[#4fd1c5] shrink-0" />
                <span>Zero hidden service surcharges</span>
              </li>
            </ul>
          </article>

          {/* ── Pillar 3: No Maisir ── */}
          <article className="p-6 rounded-2xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] hover:border-[#4fd1c5]/40 transition-colors flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Scale size={22} />
              </div>
              <div>
                <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                  Pillar 3 • Real Economy
                </span>
                <h3 className="text-xl font-bold text-[#e8eef4] mt-1">
                  No Maisir (Speculation)
                </h3>
                <span className="text-xs text-[#8a9aa8] font-mono">Structure: Proof of Real-World Labor</span>
              </div>

              {/* Plain language quote callout */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border-l-2 border-amber-400 text-xs text-[#e8eef4] leading-relaxed font-sans">
                <span className="font-semibold text-amber-400">In Plain English:</span> "The PAB token is a utility token for platform access, not a speculative asset, and is earned through verified real-world labor."
              </div>

              <div className="space-y-2 text-xs text-[#8a9aa8] leading-relaxed">
                <p>
                  Maisir encompasses pure gambling and speculative zero-sum bets. $PAB tokens cannot be earned through lottery pools, algorithmic inflation, or high-risk leverage.
                </p>
                <p>
                  Trust scores and reward points reflect fulfilled hospitality reservations, on-time client arrivals, and completed service contracts. Every token mint is backed by physical commerce.
                </p>
              </div>
            </div>

            <ul className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-2 text-[12px] font-mono text-[#e8eef4]">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                <span>Tied strictly to physical service labor</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                <span>Zero algorithmic leverage or lotteries</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                <span>Reputation score cannot be purchased</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* ── Architectural Deep-Dive Section ── */}
      <section className="py-16 bg-[#101a24]/50 border-y border-[rgba(255,255,255,0.08)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <span className="text-xs font-mono text-[#4fd1c5] tracking-widest uppercase font-semibold">
                Under The Hood
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#e8eef4]">
                How Domestic Pakistani Rails & Solana Escrow Uphold Halal Finance
              </h2>
              <p className="text-sm text-[#8a9aa8] leading-relaxed">
                In many international systems, multi-currency processing introduces hidden interest spreads, 
                forced merchant overdraft lines, and unbacked fractional IOUs. Pabandi solves this across two primary rails:
              </p>

              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#e8eef4]">
                    <span className="text-emerald-400 font-mono">01.</span>
                    <span>State Bank of Pakistan (SBP) Raast Rail</span>
                  </div>
                  <p className="text-xs text-[#8a9aa8] leading-relaxed pl-6">
                    Direct account-to-account instant clearing in Pakistani Rupees (PKR) with 0% intermediate fees. 
                    Money moves directly between regulated sovereign deposit accounts with immediate settlement finality.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#101a24] border border-[rgba(255,255,255,0.08)] space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#e8eef4]">
                    <span className="text-[#4fd1c5] font-mono">02.</span>
                    <span>Solana Anchor Escrow (USDC)</span>
                  </div>
                  <p className="text-xs text-[#8a9aa8] leading-relaxed pl-6">
                    A non-custodial Program Derived Address (PDA) holds the 1:1 asset-backed stablecoin until cryptographic 
                    proof of service check-in is presented. Neither Pabandi nor the merchant can re-hypothecate the vault balance.
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison Matrix */}
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#101a24] p-6 space-y-4">
              <h3 className="text-sm font-mono uppercase text-[#e8eef4] font-bold tracking-wider flex items-center gap-2">
                <FileCheck size={16} className="text-[#4fd1c5]" />
                <span>Compliance Comparison Matrix</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[#8a9aa8] font-mono">
                      <th className="py-2.5 pr-4">Dimension</th>
                      <th className="py-2.5 px-3">Traditional FinTech</th>
                      <th className="py-2.5 pl-3 text-[#4fd1c5]">Pabandi Platform</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    <tr>
                      <td className="py-3 pr-4 font-mono text-[#8a9aa8]">Escrow Vaults</td>
                      <td className="py-3 px-3 text-[#f87171]">Fractional / Lent out</td>
                      <td className="py-3 pl-3 text-emerald-400 font-semibold">100% Segregated (No Riba)</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-mono text-[#8a9aa8]">Pricing Terms</td>
                      <td className="py-3 px-3 text-[#f87171]">Dynamic surprise markup</td>
                      <td className="py-3 pl-3 text-emerald-400 font-semibold">Deterministic Anchor Lock</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-mono text-[#8a9aa8]">Delay Penalties</td>
                      <td className="py-3 px-3 text-[#f87171]">Late interest compounding</td>
                      <td className="py-3 pl-3 text-emerald-400 font-semibold">Zero interest penalty</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-mono text-[#8a9aa8]">Token Invariants</td>
                      <td className="py-3 px-3 text-[#f87171]">Speculative DEX pools</td>
                      <td className="py-3 pl-3 text-emerald-400 font-semibold">Earned via verified labor</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-mono text-[#8a9aa8]">Dispute Model</td>
                      <td className="py-3 px-3 text-[#8a9aa8]">Opaque chargebacks</td>
                      <td className="py-3 pl-3 text-emerald-400 font-semibold">Sulha Arbitration (Tahkim)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Agent Access Panel (The Fintech Differentiator) ── */}
      <section id="agent-panel" className="py-20 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#101a24] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-[#4fd1c5]" />
                <h2 className="text-lg sm:text-xl font-bold font-mono text-[#e8eef4]">
                  For AI Agents & Developers
                </h2>
              </div>
              <p className="text-xs text-[#8a9aa8] font-mono mt-1">
                Autonomous agents verify Sharia compliance programmatically prior to allocating capital or executing bookings.
              </p>
            </div>

            {/* Code Selector Tabs */}
            <div className="flex items-center bg-[#0a1118] p-1 rounded-lg border border-[rgba(255,255,255,0.08)] self-start sm:self-auto font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveSnippetTab('mcp')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeSnippetTab === 'mcp' 
                    ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' 
                    : 'text-[#8a9aa8] hover:text-[#e8eef4]'
                }`}
              >
                MCP Tool
              </button>
              <button
                type="button"
                onClick={() => setActiveSnippetTab('curl')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeSnippetTab === 'curl' 
                    ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' 
                    : 'text-[#8a9aa8] hover:text-[#e8eef4]'
                }`}
              >
                cURL / REST
              </button>
              <button
                type="button"
                onClick={() => setActiveSnippetTab('schema')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeSnippetTab === 'schema' 
                    ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' 
                    : 'text-[#8a9aa8] hover:text-[#e8eef4]'
                }`}
              >
                JSON-LD
              </button>
            </div>
          </div>

          {/* Snippet Display */}
          <div className="space-y-4">
            {activeSnippetTab === 'mcp' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[#8a9aa8]">
                  <span>Pabandi Model Context Protocol (MCP) Execution</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('mcp', MCP_SNIPPET)}
                    className="inline-flex items-center gap-1.5 text-[#4fd1c5] hover:text-[#38b2ac] transition-colors"
                  >
                    {copiedKey === 'mcp' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'mcp' ? 'Copied' : 'Copy Call'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#0a1118] border border-[rgba(255,255,255,0.08)] overflow-x-auto text-[#4fd1c5]">
                  <code>{MCP_SNIPPET}</code>
                </pre>

                <div className="text-[#8a9aa8] pt-2">Live Response Format:</div>
                <pre className="p-4 rounded-xl bg-[#0a1118] border border-[rgba(255,255,255,0.08)] overflow-x-auto text-[#e8eef4]">
                  <code>{MCP_RESPONSE_SNIPPET}</code>
                </pre>
              </div>
            )}

            {activeSnippetTab === 'curl' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[#8a9aa8]">
                  <span>Direct HTTP REST Verification (No LLM Required)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('curl', CURL_SNIPPET)}
                    className="inline-flex items-center gap-1.5 text-[#4fd1c5] hover:text-[#38b2ac] transition-colors"
                  >
                    {copiedKey === 'curl' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'curl' ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#0a1118] border border-[rgba(255,255,255,0.08)] overflow-x-auto text-[#4fd1c5]">
                  <code>{CURL_SNIPPET}</code>
                </pre>
              </div>
            )}

            {activeSnippetTab === 'schema' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[#8a9aa8]">
                  <span>Schema.org FinancialProduct Declarations</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('schema', JSON.stringify(SHARIA_SCHEMA_JSON_LD, null, 2))}
                    className="inline-flex items-center gap-1.5 text-[#4fd1c5] hover:text-[#38b2ac] transition-colors"
                  >
                    {copiedKey === 'schema' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'schema' ? 'Copied' : 'Copy JSON-LD'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#0a1118] border border-[rgba(255,255,255,0.08)] overflow-x-auto text-[#e8eef4] max-h-64">
                  <code>{JSON.stringify(SHARIA_SCHEMA_JSON_LD, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#8a9aa8] border-t border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Discovery endpoint: <code className="text-[#e8eef4]">/.well-known/agent.json</code></span>
            </div>
            <Link to="/api/v1/sharia-compliance" target="_blank" className="text-[#4fd1c5] hover:underline inline-flex items-center gap-1">
              <span>Inspect Raw REST Endpoint</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Certificate Preview Modal ── */}
      {showCertModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cert-modal-title"
        >
          <div className="w-full max-w-2xl bg-[#101a24] border border-[rgba(255,255,255,0.16)] rounded-2xl p-6 sm:p-8 space-y-6 relative text-[#e8eef4]">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-mono text-[#4fd1c5] uppercase tracking-wider font-semibold">
                  Official Verification Attestation
                </span>
                <h3 id="cert-modal-title" className="text-xl font-bold mt-1">
                  Pabandi Sharia Compliance Certificate
                </h3>
                <span className="text-xs text-[#8a9aa8] font-mono">Reference: PBN-SHARIA-2026-AAOIFI</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8a9aa8] hover:text-[#e8eef4] transition-colors"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-[#8a9aa8]">
              <p>
                This certifies that the <strong className="text-[#e8eef4]">Pabandi Autonomous Booking & Escrow Platform</strong> has been engineered to adhere strictly to the Islamic Finance standards published by the Accounting and Auditing Organization for Islamic Financial Institutions (AAOIFI).
              </p>
              
              <div className="p-4 rounded-xl bg-[#0a1118] border border-white/10 space-y-2 font-mono">
                <div className="text-emerald-400 font-bold">CERTIFIED CONFORMITY FINDINGS:</div>
                <div className="text-[#e8eef4]">1. RIBA FREE (Zero Interest): All escrow balances are non-hypothecated and 100% asset-backed.</div>
                <div className="text-[#e8eef4]">2. GHARAR MITIGATED: Deterministic Solana Anchor smart contracts lock precise conditions prior to funding.</div>
                <div className="text-[#e8eef4]">3. MAISIR PROHIBITED: Utility tokenomics awarded strictly via verifiable service delivery labor.</div>
              </div>

              <div className="flex items-center justify-between pt-2 text-[11px] font-mono text-[#8a9aa8]">
                <span>Status: <strong className="text-emerald-400">ACTIVE & AUDITED</strong></span>
                <span>Verification Hash: <code className="text-[#4fd1c5]">7ecb531...8363f12</code></span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handlePrintCertificate}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-xs inline-flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-[#4fd1c5]"
              >
                <Download size={14} />
                <span>Print or Save as PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#8a9aa8] hover:text-[#e8eef4] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="py-8 border-t border-[rgba(255,255,255,0.08)] text-center text-xs text-[#8a9aa8] font-mono">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#4fd1c5]" />
            <span>Pabandi Global Trust Infrastructure • AAOIFI Aligned</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/compliance" className="hover:text-[#4fd1c5] transition-colors">Merchant Compliance</Link>
            <span>•</span>
            <Link to="/pricing" className="hover:text-[#4fd1c5] transition-colors">Fair Pricing</Link>
            <span>•</span>
            <span className="text-[#5a6a78]">WCAG 2.1 AA Compliant</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
