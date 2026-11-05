import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { GUARANTEE_STEPS } from '../components/GuaranteeVisuals';
import { useAuthStore } from '../store/authStore';
import { LiveEscrowPreview } from '../components/landing/LiveEscrowPreview';
import { apiClient } from '../services/api';

interface PublicStats {
  businesses: number;
  escrowedUsd: number;
  bookingsProtected: number;
  updatedAt?: string;
}

const TRUST_SIGNALS = [
  { number: '100%', label: 'Escrow-backed', detail: 'Funds held securely until service delivered' },
  { number: '$PAB', label: 'Reward token', detail: 'Earn for every verified milestone' },
  { number: 'Portable', label: 'Trust Passport', detail: 'Your reputation travels across platforms' },
];

const HOW_IT_WORKS = GUARANTEE_STEPS.map((s) => ({
  step: s.n,
  title: s.title,
  desc: s.body,
}));

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function ScrollReveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`scroll-reveal ${isVisible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function CursorTrail() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      setVisible(true);
    };
    const handleLeave = () => setVisible(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="cursor-trail"
      style={{ left: pos.x, top: pos.y }}
    />
  );
}

function WaveDivider() {
  return (
    <div className="wave-divider">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path
          className="wave-anim"
          d="M0,30 C200,50 400,10 600,30 C800,50 1000,10 1200,30 L1200,60 L0,60 Z"
          fill="var(--warm-sand)"
        />
      </svg>
    </div>
  );
}

function MagneticButton({ children, className = '', ...props }: { children: React.ReactNode; className?: string; [key: string]: unknown }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * 0.15;
    const deltaY = (e.clientY - centerY) * 0.15;
    setOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  return (
    <button
      ref={btnRef}
      className={`magnetic-btn ${className}`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
}

const JSON_LD_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pabandi',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description: 'The settlement & trust layer for hybrid commerce. Escrow-backed deposits, portable trust scores, and CRM for businesses and AI agents.',
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const landingRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<{ success: boolean; data: PublicStats }>('/public/stats')
      .then((res) => {
        if (isMounted && res.data?.success && res.data.data) {
          setStats(res.data.data);
        }
      })
      .catch(() => {
        // Stats fallback handled gracefully in render
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const hasSubstantialStats = (stats?.businesses ?? 0) >= 10 || (stats?.escrowedUsd ?? 0) >= 1000;

  return (
    <div className="landing" ref={landingRef}>
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
        <meta name="twitter:title" content="Pabandi — Guarantee Your Next Project. Pay Only When It's Done." />
        <meta
          name="twitter:description"
          content="Stop no-shows and secure client revenue. Escrow deposits with multi-rail settlement across Square, Safepay, and Solana."
        />
        <script type="application/ld+json">{JSON.stringify(JSON_LD_DATA)}</script>
      </Helmet>

      <CursorTrail />

      {/* Floating Ambient Orbs */}
      <div className="orbs-container" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Header */}
      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </Link>
          <nav className="nav-list" aria-label="Main">
            <Link to="/contact">For Businesses</Link>
            <Link to="/agents">For AI Developers</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/p/estimate/demo">Live Demo</Link>
          </nav>
          {isAuthenticated ? (
            <Link to="/dashboard" className="cta-nav">Dashboard</Link>
          ) : (
            <Link to="/signup?module=contact" className="cta-nav">Get Started</Link>
          )}
        </div>
      </header>

      <main>
        {/* Split Hero Section */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="container">
            <div className="hero-inner">
              {/* Left Side: Pitch */}
              <div className="hero-content">
                <p className="hero-kicker">THE SETTLEMENT & TRUST LAYER FOR HYBRID COMMERCE</p>
                <h1 id="hero-title" className="hero-title">
                  <span className="word">Guarantee Your</span>{' '}
                  <span className="word">Next Project.</span><br />
                  <span className="word hero-accent">Pay Only When</span>{' '}
                  <span className="word hero-accent">It's Done.</span>
                </h1>
                <p className="hero-subtitle">
                  AI-powered trust scores, non-custodial escrow, and a full CRM for humans and AI agents.
                  Stop no-shows, secure revenue, and let autonomous agents handle the rest.
                </p>

                <div className="hero-actions">
                  <MagneticButton
                    className="btn btn-large btn-primary"
                    onClick={() => navigate('/signup?module=contact')}
                    style={{ padding: '0.875rem 1.75rem', fontSize: '1rem', fontWeight: 700 }}
                  >
                    Start Guaranteeing Bookings
                  </MagneticButton>
                  <MagneticButton
                    className="btn btn-large btn-secondary"
                    onClick={() => navigate('/p/estimate/demo')}
                    style={{ padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                  >
                    Run a Project Simulation →
                  </MagneticButton>
                </div>

                {/* Trust Badges Row */}
                <div className="hero-trust-row">
                  <span>Settlement Rails:</span>
                  <div className="hero-trust-badge">
                    <span>💳</span>
                    <span>Square (USD Cards)</span>
                  </div>
                  <div className="hero-trust-badge">
                    <span>🏦</span>
                    <span>Safepay & Raast (PKR)</span>
                  </div>
                  <div className="hero-trust-badge">
                    <span>⚡</span>
                    <span>Solana Pay (USDC)</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Live Product Preview */}
              <div className="hero-visual">
                <LiveEscrowPreview />
              </div>
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* Bento Grid Feature Section */}
        <section className="bento-section" aria-labelledby="bento-title">
          <div className="container">
            <ScrollReveal>
              <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto' }}>
                <span className="bento-tag">PROVEN INFRASTRUCTURE</span>
                <h2 id="bento-title" className="section-title">
                  Programmable Trust for the Hybrid Economy
                </h2>
                <p className="section-subtitle">
                  Everything you need to close high-ticket client deals and settle machine-to-machine bounties without counterparty risk.
                </p>
              </div>
            </ScrollReveal>

            <div className="bento-grid">
              {/* Large Card: Trust Passport & AI Scoring */}
              <div className="bento-card bento-card-large">
                <span className="bento-tag">REPUTATION LAYER</span>
                <h3 className="bento-title">Trust Passport & AI Scoring</h3>
                <p className="bento-desc">
                  Verify any human or AI agent's reliability before you commit. Portable soulbound credentials track verified on-time completions, dispute history, and liquidity capacity.
                </p>
                <div className="bento-visual-slot">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #C97B5A, #A85A3C)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        ◈
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--warm-ink)' }}>Verified Trust Passport #4092</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--soft-stone)' }}>Cryptographically signed · Zero fraud rate</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--soft-stone)', fontWeight: 600 }}>RELIABILITY SCORE</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8A9A7B' }}>98.4 / 100</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tall Card: Non-Custodial Escrow */}
              <div className="bento-card bento-card-tall">
                <span className="bento-tag">ESCROW SECURITY</span>
                <h3 className="bento-title">Non-Custodial Escrow</h3>
                <p className="bento-desc">
                  Lock client deposits in tamper-proof escrow contracts. Funds disburse only when deliverables match agreed scope milestones.
                </p>
                <div className="bento-visual-slot" style={{ marginTop: 'auto', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(201, 123, 90, 0.15)',
                      border: '2px solid var(--clay)',
                      color: 'var(--clay)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.75rem',
                      margin: '0 auto 1rem',
                    }}
                  >
                    🔒
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--warm-ink)', marginBottom: '0.25rem' }}>
                    Multi-Rail Settlement Vault
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--soft-stone)', lineHeight: 1.5 }}>
                    Supports Square (USD Cards), Safepay/Raast (PKR Direct Bank), and Solana Pay (Instant USDC).
                  </div>
                </div>
              </div>

              {/* Medium Card: Scope-Locked Interactive Proposals */}
              <div className="bento-card bento-card-medium">
                <span className="bento-tag">SCOPING & CLOSING</span>
                <h3 className="bento-title">Scope-Locked Interactive Proposals</h3>
                <p className="bento-desc">
                  Generate instant proposals with dynamic pricing and milestone schedules. Clients approve with one click and fund escrow deposits without leaving the proposal.
                </p>
                <div className="bento-visual-slot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--soft-stone)', fontWeight: 600 }}>SAMPLE DEMO</span>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--warm-ink)' }}>Public Client Proposal Widget</div>
                  </div>
                  <Link
                    to="/p/estimate/demo"
                    style={{
                      background: 'var(--clay)',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                    }}
                  >
                    Try Live Proposal →
                  </Link>
                </div>
              </div>

              {/* Small Card: Agentic CRM */}
              <div className="bento-card">
                <span className="bento-tag">CONTACTOS</span>
                <h3 className="bento-title">Agentic CRM</h3>
                <p className="bento-desc">
                  A full CRM that works for humans and autonomous agents. Tracks deals, appointments, clients, and automated payment triggers in one unified dashboard.
                </p>
                <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                  <Link to="/contact" className="module-link">Open ContactOS →</Link>
                </div>
              </div>

              {/* Small Card: Sulha Arbitration */}
              <div className="bento-card">
                <span className="bento-tag">DISPUTE MEDIATION</span>
                <h3 className="bento-title">Sulha Arbitration</h3>
                <p className="bento-desc">
                  AI-assisted dispute resolution that acts as digital mediation for your deals. Evaluates proposal terms against submitted deliverables before any escalation.
                </p>
                <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                  <Link to="/compliance" className="module-link">Mediation & Compliance →</Link>
                </div>
              </div>

              {/* Wide Banner Card: Agent-Ready Architecture */}
              <div className="bento-card bento-card-wide">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                  <div style={{ maxWidth: '640px' }}>
                    <span className="bento-tag">MACHINE COMMERCE READY</span>
                    <h3 className="bento-title" style={{ fontSize: '1.5rem' }}>Model Context Protocol (MCP) & Agent Wallets</h3>
                    <p className="bento-desc" style={{ marginBottom: 0 }}>
                      Expose your business services directly to AI agents. Native MCP endpoints, x402 payment headers, and programmatic escrow triggers allow agents to discover, hire, and pay you autonomously.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Link
                      to="/agents"
                      style={{
                        background: 'var(--warm-ink)',
                        color: 'white',
                        padding: '0.75rem 1.25rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                      }}
                    >
                      For AI Developers →
                    </Link>
                    <Link
                      to="/developers"
                      style={{
                        background: 'white',
                        color: 'var(--warm-ink)',
                        border: '1px solid rgba(191,179,163,0.4)',
                        padding: '0.75rem 1.25rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                      }}
                    >
                      API Docs
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* Dynamic Honest Social Proof */}
        <section className="social-proof-section" aria-labelledby="social-proof-title">
          <div className="container">
            <ScrollReveal>
              <span className="bento-tag">PROVEN NETWORK</span>
              <h2 id="social-proof-title" className="section-title">
                Settling Deals with Integrity & Transparency
              </h2>
              <p className="section-subtitle">
                Built with industry standard payment processors and decentralized trust infrastructure.
              </p>
            </ScrollReveal>

            {/* Partner & Payment Rails Strip */}
            <div className="partner-logo-bar">
              <div className="partner-pill">
                <span>💳</span>
                <span>Square</span>
              </div>
              <div className="partner-pill">
                <span>🇵🇰</span>
                <span>Safepay</span>
              </div>
              <div className="partner-pill">
                <span>🏦</span>
                <span>Raast P2M</span>
              </div>
              <div className="partner-pill">
                <span>⚡</span>
                <span>Solana</span>
              </div>
              <div className="partner-pill">
                <span>🔐</span>
                <span>Privy Auth</span>
              </div>
            </div>

            {/* Dynamic Metric Counter (Threshold-gated) */}
            <div className="platform-metrics-grid">
              <div className="platform-metric-card">
                <div className="platform-metric-number">
                  {hasSubstantialStats ? stats?.businesses : 'Cohort 1'}
                </div>
                <div className="platform-metric-label">
                  {hasSubstantialStats ? 'Businesses Onboarded' : 'Pilot Businesses'}
                </div>
                <div className="platform-metric-sub">
                  Active service providers in Lahore & Chicago
                </div>
              </div>

              <div className="platform-metric-card">
                <div className="platform-metric-number">
                  {hasSubstantialStats ? `$${(stats?.escrowedUsd ?? 0).toLocaleString()}` : '$0'}
                </div>
                <div className="platform-metric-label">
                  Escrow Funds Guaranteed
                </div>
                <div className="platform-metric-sub">
                  Protected across non-custodial milestones
                </div>
              </div>

              <div className="platform-metric-card">
                <div className="platform-metric-number">
                  100%
                </div>
                <div className="platform-metric-label">
                  No-Show Protection
                </div>
                <div className="platform-metric-sub">
                  Milestone-locked upfront deposits
                </div>
              </div>
            </div>

            {/* Testimonials */}
            <div className="testimonials-grid">
              <div className="testimonial-card">
                <p className="testimonial-quote">
                  "Clients used to reschedule three times and ghost when invoice day came. With Pabandi's 50% escrow deposit, we eliminated no-shows entirely on our web dev agency bookings."
                </p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">HA</div>
                  <div>
                    <div className="testimonial-name">Hamza A.</div>
                    <div className="testimonial-role">Founder, Apex Design Studio (Lahore) · Verified Pilot</div>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-quote">
                  "We connected our autonomous research agent via the Pabandi MCP tool. It now hires human subject-matter experts, funds escrow in USDC, and releases funds upon file verification."
                </p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">EK</div>
                  <div>
                    <div className="testimonial-name">Elena K.</div>
                    <div className="testimonial-role">AI Systems Engineer, SwarmLogic (Chicago) · Pilot User</div>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-quote">
                  "Safepay and Square settlement in one place means I can charge US clients in USD and local clients via Raast without maintaining two separate systems. The Trust Passport gives us instant credibility."
                </p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">ZM</div>
                  <div>
                    <div className="testimonial-name">Zain M.</div>
                    <div className="testimonial-role">Managing Partner, Crescent Legal Consultancy</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* The Escrow Flow */}
        <section className="how-it-works" aria-labelledby="how-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="how-title" className="section-title">The Escrow Flow in Four Moves</h2>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <p className="section-subtitle">
                The deposit never sits in anyone's personal bank account. It sits securely in escrow, and releases only upon verified delivery.{' '}
                <Link to="/guarantee" className="module-link">The full guarantee →</Link>
              </p>
            </ScrollReveal>
            <div className="steps-container">
              {HOW_IT_WORKS.map((step) => (
                <ScrollReveal key={step.step} delay={Number(step.step) * 80}>
                  <div className="step-card">
                    <div className="step-number">{step.step}</div>
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-desc">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* Pricing Teaser Section */}
        <section className="pricing-teaser-section" aria-labelledby="pricing-teaser-title">
          <div className="container">
            <ScrollReveal>
              <span className="bento-tag">SIMPLE PRICING</span>
              <h2 id="pricing-teaser-title" className="section-title">
                Transparent Pricing for Growing Businesses
              </h2>
              <p className="section-subtitle">
                Start with our zero-fee pilot program. Upgrade as your deal volume scales.
              </p>
            </ScrollReveal>

            <div className="pricing-cards-grid">
              {/* Pilot Tier */}
              <div className="pricing-card">
                <div className="pricing-card-tier">Pilot Cohort</div>
                <div className="pricing-card-price">$0 <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--soft-stone)' }}>/ month</span></div>
                <p className="pricing-card-desc">For service businesses joining our launch program in Lahore & Chicago.</p>
                <ul className="pricing-card-features">
                  <li><span className="check">✓</span> Up to $5,000 / PKR 1,400,000 monthly escrow</li>
                  <li><span className="check">✓</span> ContactOS CRM & deal pipeline</li>
                  <li><span className="check">✓</span> Square & Safepay payment links</li>
                  <li><span className="check">✓</span> Portable Trust Passport minting</li>
                </ul>
                <button
                  type="button"
                  onClick={() => navigate('/signup?module=contact')}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  Join Free Pilot
                </button>
              </div>

              {/* Pro Tier */}
              <div className="pricing-card featured">
                <div className="pricing-card-tier">Pro Business</div>
                <div className="pricing-card-price">$29 <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--soft-stone)' }}>/ month</span></div>
                <p className="pricing-card-desc">For scaling agencies and consultancies needing higher limits and automation.</p>
                <ul className="pricing-card-features">
                  <li><span className="check">✓</span> Unlimited escrow volume & milestones</li>
                  <li><span className="check">✓</span> Custom branded proposals (`/p/estimate`)</li>
                  <li><span className="check">✓</span> Priority Sulha arbitration support</li>
                  <li><span className="check">✓</span> Automated SMS & WhatsApp reminders</li>
                </ul>
                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 'auto', background: 'var(--terracotta)' }}
                >
                  View Pro Features →
                </button>
              </div>

              {/* Agent / Enterprise Tier */}
              <div className="pricing-card">
                <div className="pricing-card-tier">Autonomous Agents</div>
                <div className="pricing-card-price">Custom <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--soft-stone)' }}>/ usage</span></div>
                <p className="pricing-card-desc">For developers building M2M swarms, MCP servers, and autonomous agent systems.</p>
                <ul className="pricing-card-features">
                  <li><span className="check">✓</span> Dedicated MCP server endpoint</li>
                  <li><span className="check">✓</span> x402 programmatic settlement headers</li>
                  <li><span className="check">✓</span> Session budget authorization</li>
                  <li><span className="check">✓</span> 99.99% SLA webhook guarantees</li>
                </ul>
                <button
                  type="button"
                  onClick={() => navigate('/agents')}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  Explore Developer Portal
                </button>
              </div>
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* Final CTA */}
        <section className="cta-section" aria-labelledby="cta-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="cta-title" className="section-title">Ready to Guarantee Your Next Booking?</h2>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="section-subtitle">
                Lock your next client with escrow protection. Five minutes to set up. Multi-currency settlement in USD, PKR, and USDC.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <div className="cta-buttons" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <MagneticButton className="btn btn-large btn-primary" onClick={() => navigate('/signup?module=contact')}>
                  Start Guaranteeing Bookings
                </MagneticButton>
                <MagneticButton className="btn btn-large btn-secondary" onClick={() => navigate('/sandbox')}>
                  Try the Interactive Sandbox
                </MagneticButton>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-brand">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </div>
          <p className="footer-tagline">The Settlement & Trust Layer for Service Businesses & AI Agents</p>
          <nav className="footer-nav" aria-label="Footer">
            <Link to="/guarantee">The Guarantee</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/compliance">Compliance & Refunds</Link>
            <Link to="/p/estimate/demo">Live Proposal Demo</Link>
            <Link to="/sandbox">See How Trust Works</Link>
            <Link to="/verify-trust">Verify Trust Passport</Link>
            <Link to="/developers">Developers</Link>
            <Link to="/agents">For AI Developers</Link>
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
          <p className="footer-copy">© 2026 Pabandi. The Settlement & Trust Layer for Hybrid Commerce. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
