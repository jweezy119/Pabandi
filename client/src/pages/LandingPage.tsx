import { useState } from 'react';

// ─── Module Data ──────────────────────────────────────────────────────────────

const MODULES = [
  {
    id: 'booking',
    name: 'BookingOS',
    tagline: 'Book services with trust protection',
    description: 'Customers book with confidence. Businesses get escrow-backed deposits. No more no-shows.',
    color: '#C97B5A',
    icon: '📅',
  },
  {
    id: 'freight',
    name: 'FreightOS',
    tagline: 'Move goods with escrow-backed logistics',
    description: 'Shippers pay into escrow. Carriers get paid on delivery. Tracking built in.',
    color: '#8A9A7B',
    icon: '🚛',
  },
  {
    id: 'abode',
    name: 'AbodeOS',
    tagline: 'Property management with tenant scoring',
    description: 'Landlords screen tenants. Tenants build portable rental history. Both protected.',
    color: '#D4A5A5',
    icon: '🏠',
  },
  {
    id: 'pipeline',
    name: 'PipelineOS',
    tagline: 'CRM and sales pipeline management',
    description: 'Track leads from first call to close. Built for service businesses of any size.',
    color: '#D9A854',
    icon: '📊',
  },
  {
    id: 'ledger',
    name: 'LedgerOS',
    tagline: 'Finance, invoicing, and cash flow',
    description: 'Send invoices, record expenses, see profit in real time. No accountant needed.',
    color: '#B8C9D4',
    icon: '💰',
  },
];

const TRUST_SIGNALS = [
  { number: '100%', label: 'Escrow-backed bookings', detail: 'Funds held securely until service delivered' },
  { number: '$PAB', label: 'Reward token', detail: 'Earn for every verified transaction' },
  { number: 'Portable', label: 'Trust Passport', detail: 'Your reputation travels with you' },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  return (
    <div className="landing">
      {/* No-JS Fallback */}
      <noscript>
        <div className="noscript-banner">
          <p>PabandiOS works with JavaScript disabled. For interactive features, please enable JS.</p>
        </div>
      </noscript>

      {/* Header */}
      <header className="header" role="banner">
        <div className="container">
          <a href="/" className="logo" aria-label="PabandiOS home">
            <span className="logo-mark" aria-hidden="true">◈</span>
            <span className="logo-text">PabandiOS</span>
          </a>
          <nav className="nav" role="navigation" aria-label="Main navigation">
            <ul className="nav-list">
              <li><a href="/booking">BookingOS</a></li>
              <li><a href="/freight">FreightOS</a></li>
              <li><a href="/abode">AbodeOS</a></li>
              <li><a href="/pipeline">PipelineOS</a></li>
              <li><a href="/ledger">LedgerOS</a></li>
            </ul>
          </nav>
          <a href="/crm" className="cta-nav">Get Started</a>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <div className="container">
            <p className="hero-kicker">The trust operating system</p>
            <h1 id="hero-heading" className="hero-title">
              Commitment,<br />
              <span className="hero-accent">Secured.</span>
            </h1>
            <p className="hero-subtitle">
              Five modules. One shared trust engine. Built for businesses that need to be reliable — and customers who need to know they can count on them.
            </p>
            <div className="hero-actions">
              <a href="/onboarding" className="btn btn-primary">Start Your Business</a>
              <a href="/crm" className="btn btn-secondary">View Dashboard</a>
            </div>
          </div>
        </section>

        {/* Modules Grid */}
        <section className="modules" aria-labelledby="modules-heading">
          <div className="container">
            <h2 id="modules-heading" className="section-title">Five Modules. One Trust Layer.</h2>
            <p className="section-subtitle">Each module runs independently. All share the same escrow, rewards, and reputation engine.</p>
            <div className="modules-grid" role="list">
              {MODULES.map((mod) => (
                <article
                  key={mod.id}
                  className={`module-card ${activeModule === mod.id ? 'is-active' : ''}`}
                  role="listitem"
                  onMouseEnter={() => setActiveModule(mod.id)}
                  onMouseLeave={() => setActiveModule(null)}
                  onFocus={() => setActiveModule(mod.id)}
                  onBlur={() => setActiveModule(null)}
                  tabIndex={0}
                  aria-label={`${mod.name}: ${mod.tagline}`}
                >
                  <div className="module-icon" aria-hidden="true">{mod.icon}</div>
                  <h3 className="module-name">{mod.name}</h3>
                  <p className="module-tagline">{mod.tagline}</p>
                  <p className="module-desc">{mod.description}</p>
                  <a href={`/${mod.id}`} className="module-link">Explore {mod.name} →</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="trust" aria-labelledby="trust-heading">
          <div className="container">
            <h2 id="trust-heading" className="section-title">Why Trust, Why Now</h2>
            <div className="trust-grid" role="list">
              {TRUST_SIGNALS.map((signal) => (
                <div key={signal.label} className="trust-card" role="listitem">
                  <p className="trust-number">{signal.number}</p>
                  <p className="trust-label">{signal.label}</p>
                  <p className="trust-detail">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section" aria-labelledby="cta-heading">
          <div className="container">
            <h2 id="cta-heading" className="section-title">Ready to Build Trust?</h2>
            <p className="section-subtitle">Set up your business in five minutes. No crypto knowledge required.</p>
            <a href="/onboarding" className="btn btn-large btn-primary">Start Free</a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        <div className="container">
          <div className="footer-brand">
            <span className="logo-mark" aria-hidden="true">◈</span>
            <span className="logo-text">PabandiOS</span>
          </div>
          <p className="footer-tagline">BookingOS · FreightOS · AbodeOS · PipelineOS · LedgerOS — Powered by TrustOS</p>
          <nav className="footer-nav" aria-label="Footer navigation">
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/llms.txt">Agents</a>
          </nav>
          <p className="footer-copy">© 2026 Pabandi. The trust layer for the informal economy.</p>
        </div>
      </footer>
    </div>
  );
}
