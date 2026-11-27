import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Building2, Users, Bot, Tag } from 'lucide-react';
import { GUARANTEE_STEPS } from '../components/GuaranteeVisuals';
import { LiveEscrowPreview } from '../components/landing/LiveEscrowPreview';
import { apiClient, API_HOST } from '../services/api';
import GlassNavHeader, { type GlassNavLink } from '../components/GlassNavHeader';
import './LandingGlass.css';

const LANDING_NAV_LINKS: GlassNavLink[] = [
  { label: 'For Businesses', to: '/contact', icon: <Building2 className="w-3.5 h-3.5 opacity-80" aria-hidden="true" /> },
  { label: 'For Customers', to: '/customers', icon: <Users className="w-3.5 h-3.5 opacity-80" aria-hidden="true" /> },
  { label: 'For AI Developers', to: '/agents', icon: <Bot className="w-3.5 h-3.5 opacity-80" aria-hidden="true" /> },
  { label: 'Pricing', to: '/pricing', icon: <Tag className="w-3.5 h-3.5 opacity-80" aria-hidden="true" /> },
];

interface PublicStats {
  businesses: number;
  escrowedUsd: number;
  bookingsProtected: number;
  updatedAt?: string;
}

const JSON_LD_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pabandi',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'The settlement & trust layer for hybrid commerce. Escrow-backed deposits, portable trust scores, and CRM for businesses and AI agents.',
};

/* ── Helpful intents: "what do you want to do?" ─────────────────────────── */
const INTENTS = [
  { ico: '🛡️', label: 'Protect a client booking', to: '/signup?module=contact' },
  { ico: '🤖', label: 'Let my AI agent hire a human', to: '/agents' },
  { ico: '🔍', label: 'Verify a Trust Passport', to: '/verify-trust' },
  { ico: '🧪', label: 'Simulate a project', to: '/p/estimate/demo' },
  { ico: '⌘', label: 'Read the API docs', to: '/developers' },
];

/* ── Trajectory console: an agent hires a human, end to end ─────────────── */
type TagKind = 'agent' | 'predict' | 'escrow' | 'human' | 'proof' | 'settle';
const TRAJECTORY: { t: string; tag: TagKind; label: string; msg: string; code: string }[] = [
  { t: '00:00.0', tag: 'agent', label: 'AGENT', msg: 'Research agent requests a roofing inspection', code: 'pabandi_search_services { skill: "tpo_membrane" }' },
  { t: '00:00.4', tag: 'predict', label: 'PREDICT', msg: 'Bayesian risk check before any money moves', code: 'P(fulfill)=0.93 · P(dispute)=0.04 · policy=ASSISTED' },
  { t: '00:01.1', tag: 'escrow', label: 'ESCROW', msg: '$450 USDC locked in 2 milestones', code: 'collateral=15% · sulha_bond=$25 · rail=solana' },
  { t: '00:02.6', tag: 'human', label: 'HUMAN', msg: 'Coordinator approves dispatch in one tap', code: 'a2h_action { decision: "APPROVE" } → WhatsApp sent' },
  { t: '02:41:07', tag: 'proof', label: 'PROOF', msg: 'Technician uploads VCAP-signed photos', code: 'sha256:9f2c…e41a verified against scope' },
  { t: '02:41:09', tag: 'settle', label: 'SETTLE', msg: 'Milestone released · passports updated', code: 'payout=$382.50 · trust +4 · receipt signed (ed25519)' },
];

function TrajectoryConsole() {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [count, setCount] = useState(reduce ? TRAJECTORY.length : 0);
  const [run, setRun] = useState(4092);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= TRAJECTORY.length + 3) {
          setRun((r) => r + 1);
          return 0;
        }
        return c + 1;
      });
    }, 1100);
    return () => window.clearInterval(id);
  }, [reduce]);

  const shown = Math.min(count, TRAJECTORY.length);
  const done = shown === TRAJECTORY.length;

  return (
    <div className="pg-glass pg-console" aria-label="Example trajectory: an AI agent hires a human through Pabandi">
      <div className="pg-console-bar">
        <div className="pg-dots"><i /><i /><i /></div>
        <span className="pg-console-title">trajectory · run_{run}</span>
        <span className="pg-live"><i />live</span>
      </div>
      <div className="pg-traj" key={run}>
        {TRAJECTORY.slice(0, shown).map((s) => (
          <div className="pg-step" key={s.t}>
            <span className="t">{s.t}</span>
            <span className={`pg-tag ${s.tag}`}>{s.label}</span>
            <div className="msg">
              {s.msg}
              <code>{s.code}</code>
            </div>
          </div>
        ))}
      </div>
      <div className="pg-console-foot">
        <span>{shown}/{TRAJECTORY.length} steps · append-only log</span>
        <span>{done ? <b>✓ settled</b> : 'running…'}</span>
      </div>
    </div>
  );
}

/* ── Paths ──────────────────────────────────────────────────────────────── */
const PATHS = [
  {
    ico: '🏢',
    accent: 'var(--pg-clay)',
    title: 'For service businesses',
    desc: 'Stop no-shows and get paid on time with escrow-backed deposits.',
    steps: ['Create your workspace in ContactOS', 'Send a scope-locked proposal', 'Client funds escrow, you deliver, funds release'],
    cta: 'Start free pilot',
    to: '/signup?module=contact',
  },
  {
    ico: '🤖',
    accent: 'var(--pg-indigo)',
    title: 'For AI developers',
    desc: 'Give your agents a safe way to hire humans and pay for results.',
    steps: ['Add the Pabandi MCP server', 'Predict risk, then lock escrow', 'Escalate to a human when policy says so'],
    cta: 'Open developer portal',
    to: '/agents',
  },
  {
    ico: '🙋',
    accent: 'var(--pg-teal)',
    title: 'For clients & customers',
    desc: 'Book with confidence. Your money is held until the job is done.',
    steps: ['Check the provider’s Trust Passport', 'Pay a protected deposit', 'Release on delivery or open Sulha mediation'],
    cta: 'Verify a passport',
    to: '/verify-trust',
  },
];

/* ── Product catalog ────────────────────────────────────────────────────── */
type Cat = 'all' | 'trust' | 'payments' | 'ai';
const PRODUCTS: { cat: Exclude<Cat, 'all'>; ico: string; title: string; desc: string; endpoint: string; method: string; to: string; isNew?: boolean }[] = [
  { cat: 'trust', ico: '◈', title: 'Trust Passport', desc: 'Portable, signed reputation for humans and agents: completions, disputes, and reliability.', method: 'GET', endpoint: '/trust-passport/{handle}', to: '/verify-trust' },
  { cat: 'payments', ico: '🔒', title: 'Non-custodial Escrow', desc: 'Milestone escrow across Square, Safepay/Raast and Solana Pay. Funds release on verified delivery.', method: 'MCP', endpoint: 'pabandi_escrow_lock', to: '/guarantee' },
  { cat: 'ai', ico: '📈', title: 'Predictive Engine', desc: 'Bayesian completion and dispute forecasts with explainable factors, before money moves.', method: 'POST', endpoint: '/predictive/task-risk', to: '/developers', isNew: true },
  { cat: 'ai', ico: '🤝', title: 'Agent-to-Human Bridge', desc: 'Agents propose; humans approve, modify or reject in one tap. Every decision is audited.', method: 'MCP', endpoint: 'pabandi_request_human_review', to: '/agents', isNew: true },
  { cat: 'payments', ico: '⚡', title: 'x402 & Agent Sessions', desc: 'Gasless session budgets and per-call payments so agents can transact without a signature every time.', method: 'MCP', endpoint: 'pabandi_open_session', to: '/agents' },
  { cat: 'trust', ico: '⚖️', title: 'Sulha Mediation', desc: 'AI-assisted dispute resolution that compares deliverables against the agreed scope.', method: 'MCP', endpoint: 'pabandi_submit_dispute_evidence', to: '/compliance' },
];

/* ── Quickstart ─────────────────────────────────────────────────────────── */
const QUICKSTART = [
  {
    id: 'mcp',
    title: 'Connect your agent',
    desc: 'Add one MCP server. Public tools work without a key.',
    file: 'mcp.json',
    code: `{
  "mcpServers": {
    "pabandi": {
      "url": "https://api.pabandi.com/mcp"
    }
  }
}`,
    out: `tools/list → 50+ tools
  pabandi_verify_passport      (free)
  pabandi_predict_task_risk
  pabandi_escrow_lock
  pabandi_request_human_review`,
  },
  {
    id: 'predict',
    title: 'Predict before you commit',
    desc: 'Score the job and get a recommended oversight policy.',
    file: 'predict.sh',
    code: `# Forecast completion + choose human-in-the-loop policy
curl -X POST https://api.pabandi.com/api/v1/predictive/task-risk \\
  -H "Authorization: Bearer $PABANDI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scopeComplexity": "medium",
    "budgetUsd": 450,
    "leadTimeHours": 24,
    "requiresVcapProof": true
  }'`,
    out: `{
  "completionProbability": 0.93,
  "riskTier": "LOW",
  "hitlPolicy": "ASSISTED",
  "recommendations": ["Safe to dispatch"]
}`,
  },
  {
    id: 'verify',
    title: 'Verify anyone, anywhere',
    desc: 'Check a Trust Passport. No auth required.',
    file: 'verify.sh',
    code: `# Public: no API key needed
curl https://api.pabandi.com/api/v1/trust-passport/apex-design`,
    out: `{
  "handle": "apex-design",
  "reliability": 98.4,
  "completed": 212,
  "disputes": 1,
  "signature": "ed25519:…"
}`,
  },
];

function CodeBlock({ text }: { text: string }) {
  return (
    <pre className="pg-pre">
      {text.split('\n').map((line, i) => (
        <div key={i} className={/^\s*(#|\/\/)/.test(line) ? 'c' : undefined}>{line || ' '}</div>
      ))}
    </pre>
  );
}

function Quickstart() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const q = QUICKSTART[active];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(q.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="pg-qs">
      <div>
        <span className="pg-eyebrow">Quickstart</span>
        <h2 className="pg-h2">From zero to a settled job in three calls</h2>
        <p className="pg-sub">Plain HTTP or Model Context Protocol. Pick the one your stack already speaks.</p>
        <div className="pg-qs-steps" role="tablist" aria-label="Quickstart steps">
          {QUICKSTART.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === active}
              className={`pg-qs-step ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              <span className="n">{i + 1}</span>
              <span>
                <h5>{s.title}</h5>
                <p>{s.desc}</p>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="pg-glass pg-code">
        <div className="pg-code-tabs">
          {QUICKSTART.map((s, i) => (
            <button key={s.id} className={`pg-code-tab ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
              {s.file}
            </button>
          ))}
          <button className="pg-copy" onClick={copy} aria-live="polite">{copied ? '✓ copied' : 'copy'}</button>
        </div>
        <CodeBlock text={q.code} />
        <div className="pg-code-out">
          <div className="pg-code-out-label">RESPONSE</div>
          <CodeBlock text={q.out} />
        </div>
      </div>
    </div>
  );
}

/* ── FAQ ────────────────────────────────────────────────────────────────── */
const FAQ = [
  { q: 'Does Pabandi ever hold my money?', a: 'No. Deposits sit in non-custodial escrow on the rail you choose (Square, Safepay/Raast or Solana) and release only when the agreed milestone is verified. Nobody, including us, can move them outside those rules.' },
  { q: 'What happens if the job goes wrong?', a: 'Either side can open Sulha mediation. It compares the submitted deliverables against the scope both parties agreed to, and recommends a split before anything escalates to a human panel.' },
  { q: 'How do AI agents use Pabandi safely?', a: 'Agents call our MCP tools to search, predict risk and lock escrow. The predictive engine assigns an oversight policy (autonomous, assisted, or human-mandatory), and anything above the threshold is sent to a real person for one-tap approval.' },
  { q: 'Where does the prediction come from?', a: 'A Beta-binomial model over real outcomes on the platform: completions, no-shows, disputes, lead time and verification. New users shrink toward a population prior, so thin history is not over-trusted. Every score ships with the factors behind it.' },
  { q: 'What does it cost to start?', a: 'The pilot cohort is free up to $5,000 / PKR 1.4M in monthly escrow. Agents pay per call via x402; public tools such as passport verification are always free.' },
];

/* ── Reveal on scroll ───────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`pg-reveal ${inView ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [cat, setCat] = useState<Cat>('all');

  useEffect(() => {
    let mounted = true;
    apiClient
      .get<{ success: boolean; data: PublicStats }>('/public/stats')
      .then((res) => {
        if (mounted && res.data?.success && res.data.data) setStats(res.data.data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const hasSubstantialStats = (stats?.businesses ?? 0) >= 10 || (stats?.escrowedUsd ?? 0) >= 1000;
  const products = cat === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === cat);

  return (
    <div className="pg-root">
      <Helmet>
        <title>Pabandi — Guarantee Your Next Project. Pay Only When It's Done.</title>
        <meta
          name="description"
          content="AI-powered trust scores, non-custodial escrow, and a full CRM for humans and AI agents. Stop no-shows, secure revenue, and let autonomous agents handle the rest."
        />
        <meta property="og:title" content="Pabandi — The Settlement & Trust Layer for Hybrid Commerce" />
        <meta
          property="og:description"
          content="Guarantee client projects with programmable escrow, scope-locked milestones, and portable trust scores for businesses and AI agents."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://pabandi.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#070912" />
        <script type="application/ld+json">{JSON.stringify(JSON_LD_DATA)}</script>
      </Helmet>

      <div className="pg-grid-bg" aria-hidden="true" />
      <div className="pg-aurora a1" aria-hidden="true" />
      <div className="pg-aurora a2" aria-hidden="true" />
      <div className="pg-aurora a3" aria-hidden="true" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <GlassNavHeader links={LANDING_NAV_LINKS} />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="pg-hero" aria-labelledby="pg-hero-title">
          <div className="pg-container pg-hero-grid">
            <div>
              <Link to="/agents" className="pg-pill">
                <b>NEW</b> Predictive engine + agent-to-human bridge →
              </Link>
              <h1 id="pg-hero-title" className="pg-h1">
                Trust and settlement for <span className="pg-grad">humans and AI agents.</span>
              </h1>
              <p className="pg-lead">
                Escrow-backed deposits, portable Trust Passports and a predictive risk engine, so anyone can hire anyone, and
                only pay when the work is done.
              </p>

              <div className="pg-glass pg-intent" role="navigation" aria-label="What do you want to do?">
                <div className="pg-intent-label">
                  <span>›</span> what do you want to do?<span className="caret" />
                </div>
                <div className="pg-intent-chips">
                  {INTENTS.map((it) => (
                    <button key={it.label} className="pg-chip" onClick={() => navigate(it.to)}>
                      <span className="ico" aria-hidden="true">{it.ico}</span>
                      {it.label}
                      <span className="arr" aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pg-hero-ctas">
                <button className="pg-btn pg-btn-primary pg-btn-lg" onClick={() => navigate('/signup?module=contact')}>
                  Start free pilot
                </button>
                <a href="#quickstart" className="pg-btn pg-btn-ghost pg-btn-lg">View quickstart</a>
              </div>
              <div className="pg-hero-note">
                <span><i />No card required</span>
                <span><i />Non-custodial</span>
                <span><i />USD · PKR · USDC</span>
              </div>
            </div>

            <TrajectoryConsole />
          </div>
        </section>

        {/* ── Rails ─────────────────────────────────────────────────────── */}
        <section className="pg-rails" aria-label="Settlement rails and partners">
          <div className="pg-container pg-rails-inner">
            <span className="pg-rails-label">SETTLES ON</span>
            {['💳 Square', '🇵🇰 Safepay', '🏦 Raast P2M', '⚡ Solana Pay', '🔐 Privy', '🧩 MCP', '💸 x402'].map((r) => (
              <span key={r} className="pg-rail">{r}</span>
            ))}
          </div>
        </section>

        {/* ── Paths ─────────────────────────────────────────────────────── */}
        <section className="pg-section" aria-labelledby="pg-paths-title">
          <div className="pg-container">
            <Reveal className="pg-head center">
              <span className="pg-eyebrow">Get started</span>
              <h2 id="pg-paths-title" className="pg-h2">Pick your path</h2>
              <p className="pg-sub">Three ways in, one shared trust layer underneath.</p>
            </Reveal>
            <div className="pg-paths">
              {PATHS.map((p, i) => (
                <Reveal key={p.title} delay={i * 80}>
                  <div className="pg-glass pg-path" style={{ ['--accent' as string]: p.accent, height: '100%' }}>
                    <div className="pg-path-icon" aria-hidden="true">{p.ico}</div>
                    <h3>{p.title}</h3>
                    <p>{p.desc}</p>
                    <ol>
                      {p.steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                    <Link to={p.to} className="pg-link">{p.cta} <span>→</span></Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Products ──────────────────────────────────────────────────── */}
        <section id="products" className="pg-section" aria-labelledby="pg-products-title">
          <div className="pg-container">
            <Reveal className="pg-head">
              <span className="pg-eyebrow">Products</span>
              <h2 id="pg-products-title" className="pg-h2">Building blocks for programmable trust</h2>
              <p className="pg-sub">Use them from the dashboard, the REST API, or as MCP tools your agents can call directly.</p>
            </Reveal>
            <div className="pg-catalog-tabs" role="tablist" aria-label="Filter products">
              {([['all', 'All'], ['trust', 'Trust & identity'], ['payments', 'Payments & escrow'], ['ai', 'AI & agents']] as [Cat, string][]).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={cat === k} className={`pg-tab ${cat === k ? 'active' : ''}`} onClick={() => setCat(k)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="pg-catalog">
              {products.map((p) => (
                <Link key={p.title} to={p.to} className="pg-glass pg-product">
                  <div className="pg-product-top">
                    <span className="pg-product-ico" aria-hidden="true">{p.ico}</span>
                    <span className={`pg-badge ${p.isNew ? 'new' : ''}`}>{p.isNew ? 'NEW' : p.cat.toUpperCase()}</span>
                  </div>
                  <h4>{p.title}</h4>
                  <p>{p.desc}</p>
                  <div className="pg-endpoint"><em>{p.method}</em>{p.endpoint}</div>
                  <span className="pg-link">Explore <span>→</span></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Quickstart ────────────────────────────────────────────────── */}
        <section id="quickstart" className="pg-section">
          <div className="pg-container">
            <Reveal>
              <Quickstart />
            </Reveal>
          </div>
        </section>

        {/* ── Flow ──────────────────────────────────────────────────────── */}
        <section className="pg-section" aria-labelledby="pg-flow-title">
          <div className="pg-container">
            <Reveal className="pg-head center">
              <span className="pg-eyebrow">How it works</span>
              <h2 id="pg-flow-title" className="pg-h2">The escrow flow in four moves</h2>
              <p className="pg-sub">
                The deposit never sits in anyone’s personal account. It is held in escrow and releases on verified delivery.{' '}
                <Link to="/guarantee" className="pg-link" style={{ display: 'inline-flex' }}>Read the guarantee <span>→</span></Link>
              </p>
            </Reveal>
            <div className="pg-flow">
              {GUARANTEE_STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 90} className="pg-flow-step">
                  <div className="pg-glass pg-flow-num">{s.n}</div>
                  <h4>{s.title}</h4>
                  <p>{s.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live demo ─────────────────────────────────────────────────── */}
        <section className="pg-section" aria-labelledby="pg-demo-title">
          <div className="pg-container">
            <Reveal className="pg-head center">
              <span className="pg-eyebrow">Try it</span>
              <h2 id="pg-demo-title" className="pg-h2">Price a protected project, live</h2>
              <p className="pg-sub">Pick a project type and see the deposit, milestones and payout split before you sign up.</p>
            </Reveal>
            <Reveal>
              <div className="pg-glass pg-demo">
                <div className="pg-demo-inner">
                  <LiveEscrowPreview />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Proof ─────────────────────────────────────────────────────── */}
        <section className="pg-section" aria-labelledby="pg-proof-title">
          <div className="pg-container">
            <Reveal className="pg-head center">
              <span className="pg-eyebrow">Network</span>
              <h2 id="pg-proof-title" className="pg-h2">Settling deals in the open</h2>
            </Reveal>
            <div className="pg-metrics">
              <div className="pg-glass pg-metric">
                <div className="v">{hasSubstantialStats ? stats?.businesses : 'Cohort 1'}</div>
                <div className="l">{hasSubstantialStats ? 'Businesses onboarded' : 'Pilot businesses'}</div>
                <div className="d">Service providers in Lahore &amp; Chicago</div>
              </div>
              <div className="pg-glass pg-metric">
                <div className="v">{hasSubstantialStats ? `$${(stats?.escrowedUsd ?? 0).toLocaleString()}` : '$0'}</div>
                <div className="l">Escrow guaranteed</div>
                <div className="d">Protected across non-custodial milestones</div>
              </div>
              <div className="pg-glass pg-metric">
                <div className="v">100%</div>
                <div className="l">No-show protection</div>
                <div className="d">Milestone-locked upfront deposits</div>
              </div>
            </div>
            <div className="pg-quotes">
              {[
                { q: 'Clients used to reschedule three times and ghost when invoice day came. With a 50% escrow deposit, we eliminated no-shows on our agency bookings.', i: 'HA', n: 'Hamza A.', r: 'Founder, Apex Design Studio · Pilot' },
                { q: 'Our research agent now hires human experts through the MCP tools, funds escrow in USDC, and releases on file verification.', i: 'EK', n: 'Elena K.', r: 'AI Systems Engineer, SwarmLogic · Pilot' },
                { q: 'USD through Square and PKR through Raast in one place. The Trust Passport gives us instant credibility with new clients.', i: 'ZM', n: 'Zain M.', r: 'Managing Partner, Crescent Legal' },
              ].map((t) => (
                <figure key={t.n} className="pg-glass pg-quote" style={{ margin: 0 }}>
                  <p>“{t.q}”</p>
                  <figcaption className="pg-quote-who">
                    <span className="pg-avatar">{t.i}</span>
                    <span><b>{t.n}</b><small>{t.r}</small></span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────── */}
        <section className="pg-section" aria-labelledby="pg-pricing-title">
          <div className="pg-container">
            <Reveal className="pg-head center">
              <span className="pg-eyebrow">Pricing</span>
              <h2 id="pg-pricing-title" className="pg-h2">Start free. Scale when it works.</h2>
            </Reveal>
            <div className="pg-pricing">
              <div className="pg-glass pg-price">
                <span className="tier">Pilot cohort</span>
                <div className="amt">$0 <small>/ month</small></div>
                <p>For service businesses joining the launch program.</p>
                <ul>
                  <li>Up to $5,000 / PKR 1.4M monthly escrow</li>
                  <li>ContactOS CRM &amp; deal pipeline</li>
                  <li>Square &amp; Safepay payment links</li>
                  <li>Trust Passport minting</li>
                </ul>
                <button className="pg-btn pg-btn-ghost" onClick={() => navigate('/signup?module=contact')}>Join free pilot</button>
              </div>
              <div className="pg-glass pg-price featured">
                <span className="pg-ribbon">Most popular</span>
                <span className="tier">Pro business</span>
                <div className="amt">$29 <small>/ month</small></div>
                <p>For agencies and consultancies that need higher limits and automation.</p>
                <ul>
                  <li>Unlimited escrow volume &amp; milestones</li>
                  <li>Branded proposals</li>
                  <li>Priority Sulha mediation</li>
                  <li>SMS &amp; WhatsApp reminders</li>
                </ul>
                <button className="pg-btn pg-btn-primary" onClick={() => navigate('/pricing')}>See Pro features</button>
              </div>
              <div className="pg-glass pg-price">
                <span className="tier">Autonomous agents</span>
                <div className="amt">Usage <small>/ per call</small></div>
                <p>For developers building MCP servers and multi-agent systems.</p>
                <ul>
                  <li>Dedicated MCP endpoint</li>
                  <li>x402 programmatic settlement</li>
                  <li>Session budget authorization</li>
                  <li>Signed webhook receipts</li>
                </ul>
                <button className="pg-btn pg-btn-ghost" onClick={() => navigate('/agents')}>Explore developer portal</button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ / Help ────────────────────────────────────────────────── */}
        <section id="faq" className="pg-section" aria-labelledby="pg-faq-title">
          <div className="pg-container pg-faq">
            <div>
              <span className="pg-eyebrow">Help</span>
              <h2 id="pg-faq-title" className="pg-h2">Questions, answered</h2>
              <p className="pg-sub">The short version of how money, trust and agents work on Pabandi.</p>
              <div className="pg-glass pg-help">
                <h4>Still stuck?</h4>
                <p>Run a sandbox simulation or read the docs. Both take under five minutes.</p>
                <div className="pg-help-links">
                  <Link to="/sandbox" className="pg-link">Open the sandbox <span>→</span></Link>
                  <Link to="/developers" className="pg-link">Developer docs <span>→</span></Link>
                  <Link to="/compliance" className="pg-link">Refunds &amp; compliance <span>→</span></Link>
                </div>
              </div>
            </div>
            <div className="pg-faq-list">
              {FAQ.map((f, i) => (
                <details key={f.q} className="pg-glass" open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="pg-container">
          <Reveal>
            <div className="pg-glass pg-cta">
              <h2 className="pg-h2">Guarantee your next job.</h2>
              <p className="pg-sub">Five minutes to set up. Settle in USD, PKR or USDC.</p>
              <div className="pg-cta-actions">
                <button className="pg-btn pg-btn-primary pg-btn-lg" onClick={() => navigate('/signup?module=contact')}>Start free pilot</button>
                <button className="pg-btn pg-btn-ghost pg-btn-lg" onClick={() => navigate('/sandbox')}>Try the sandbox</button>
              </div>
              <div className="pg-term"><b>$</b> connect https://api.pabandi.com/mcp</div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="pg-footer">
        <div className="pg-container">
          <div className="pg-footer-grid">
            <div className="pg-footer-brand">
              <Link to="/" className="pg-logo"><span className="pg-logo-mark">◈</span><span>Pabandi</span></Link>
              <p>The settlement &amp; trust layer for service businesses and AI agents.</p>
            </div>
            <div>
              <h6>Product</h6>
              <ul>
                <li><Link to="/guarantee">The Guarantee</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
                <li><Link to="/p/estimate/demo">Live proposal demo</Link></li>
                <li><Link to="/sandbox">Sandbox</Link></li>
              </ul>
            </div>
            <div>
              <h6>Developers</h6>
              <ul>
                <li><Link to="/developers">API docs</Link></li>
                <li><Link to="/agents">For AI developers</Link></li>
                <li><a href={`${API_HOST}/.well-known/agent.json`} target="_blank" rel="noopener noreferrer">Agent card</a></li>
                <li><a href={`${API_HOST}/.well-known/openapi.json`} target="_blank" rel="noopener noreferrer">OpenAPI</a></li>
              </ul>
            </div>
            <div>
              <h6>Trust</h6>
              <ul>
                <li><Link to="/verify-trust">Verify a passport</Link></li>
                <li><Link to="/compliance">Compliance &amp; refunds</Link></li>
                <li><Link to="/privacy">Privacy</Link></li>
                <li><Link to="/terms">Terms</Link></li>
              </ul>
            </div>
            <div>
              <h6>Company</h6>
              <ul>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/contact">For businesses</Link></li>
              </ul>
            </div>
          </div>
          <div className="pg-footer-bottom">
            <span>© 2026 Pabandi. All rights reserved.</span>
            <span>Lahore · Chicago</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
