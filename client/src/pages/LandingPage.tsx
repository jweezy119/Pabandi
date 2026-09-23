import { useState, useEffect, useRef, useCallback } from 'react';

const MODULES = [
  {
    id: 'booking',
    name: 'BookingOS',
    tagline: 'Book with trust',
    description: 'Customers book with confidence. Businesses get escrow-backed deposits.',
    icon: 'calendar',
    colorClass: 'module-icon-booking',
    tint: '#A85A3C',
    path: '/booking',
  },
  {
    id: 'freight',
    name: 'FreightOS',
    tagline: 'Move with escrow',
    description: 'Shippers pay into escrow. Carriers get paid on delivery.',
    icon: 'package',
    colorClass: 'module-icon-freight',
    tint: '#8A9A7B',
    path: '/freight',
  },
  {
    id: 'property',
    name: 'PropertyOS',
    tagline: 'Buy, rent, manage with trust.',
    description: 'Landlords screen tenants. Buyers verify documents. Every deal escrow-backed.',
    icon: 'house',
    colorClass: 'module-icon-property',
    tint: '#D4A5A5',
    path: '/property',
  },
  {
    id: 'contact',
    name: 'ContactOS',
    tagline: 'Every relationship, one trusted record.',
    description: 'Track clients, close deals, and know who\'re reliable before you commit.',
    icon: 'funnel',
    colorClass: 'module-icon-contact',
    tint: '#D9A854',
    path: '/contact',
  },
  {
    id: 'ledger',
    name: 'LedgerOS',
    tagline: 'Track with clarity',
    description: 'Send invoices, record expenses, see profit in real time.',
    icon: 'coin',
    colorClass: 'module-icon-ledger',
    tint: '#B8C9D4',
    path: '/ledger',
  },
];

const TRUST_SIGNALS = [
  { number: '100%', label: 'Escrow-backed', detail: 'Funds held securely until service delivered' },
  { number: '$PAB', label: 'Reward token', detail: 'Earn for every verified transaction' },
  { number: 'Portable', label: 'Trust Passport', detail: 'Your reputation travels with you' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Query', desc: 'Tell us what you need — service, freight, property, or help.' },
  { step: '2', title: 'Verify', desc: 'TrustOS scores the counterparty. Escrow protects your funds.' },
  { step: '3', title: 'Escrow', desc: 'Service delivered? Funds released. Disputed? Arbitration kicks in.' },
];

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

function MagneticButton({ children, className = '', ...props }: any) {
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

function ModuleIcon({ type, className = '' }: { type: string; className?: string }) {
  const icons: Record<string, string> = {
    calendar: '📅',
    package: '📦',
    house: '🏠',
    funnel: '📊',
    coin: '🪙',
  };
  return <span className={className}>{icons[type] || '◈'}</span>;
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [pageTint, setPageTint] = useState<string>("#F5EFE6");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  // Helper to blend two hex colors by a given ratio (0-1) for the first color
  const blendColors = (color1: string, color2: string, ratio: number): string => {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    
    // Blend
    const r = Math.round(r1 * ratio + r2 * (1 - ratio));
    const g = Math.round(g1 * ratio + g2 * (1 - ratio));
    const b = Math.round(b1 * ratio + b2 * (1 - ratio));
    
    // Return as hex
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const handleCardHover = useCallback((tint: string) => {
    // Blend 10% accent (tint) with 90% cream (#F5EFE6)
    const blended = blendColors(tint, "#F5EFE6", 0.1);
    setPageTint(blended);
  }, []);

  const handleCardLeave = useCallback(() => {
    setPageTint("#F5EFE6"); // Reset to cream
  }, []);
  const handleCardClick = (e: React.MouseEvent, path: string, moduleId: string) => {
    e.preventDefault();
    setExpandedCard(moduleId);
    
    // Navigate after animation
    setTimeout(() => {
      window.location.href = path;
    }, 600);
  };

  return (
    <div className="landing" ref={landingRef} style={{ '--page-tint': pageTint }}>
      <CursorTrail />

      {/* Floating Orbs */}
      <div className="orbs-container" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Header */}
      <header className="header">
        <div className="container">
          <a href="/" className="logo">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </a>
          <nav className="nav-list" aria-label="Main">
            <a href="/booking">Booking</a>
            <a href="/freight">Freight</a>
            <a href="/property">Property</a>
            <a href="/contact">Contact</a>
            <a href="/ledger">Ledger</a>
          </nav>
          <a href="/crm" className="cta-nav">Get Started</a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="container">
            <div className="hero-inner">
              <div className="hero-content">
                <p className="hero-kicker">The trust operating system</p>
                <h1 id="hero-title" className="hero-title">
                  <span className="word">Commitment,</span><br />
                  <span className="word hero-accent">Secured.</span>
                </h1>
                <p className="hero-subtitle">
                  Five modules. One shared trust engine. Built for businesses that need to be reliable.
                </p>
                <div className="hero-actions">
                  <MagneticButton className="btn btn-primary">
                    Start Your Business
                  </MagneticButton>
                  <a href="/crm" className="btn btn-secondary">
                    View Dashboard
                  </a>
                </div>
              </div>

              <div className="hero-visual">
                  <div className="clay-earth">
                    <svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        {/* Ocean base — warm clay blue */}
                        <radialGradient id="earth-base" cx="40%" cy="35%" r="60%">
                          <stop offset="0%" stop-color="#7BA4B8" />
                          <stop offset="50%" stop-color="#5C8A9E" />
                          <stop offset="100%" stop-color="#3D6B7E" />
                        </radialGradient>
                        {/* Continent green — clay sage */}
                        <radialGradient id="continent-raise" cx="35%" cy="30%" r="65%">
                          <stop offset="0%" stop-color="#A8C4A0" />
                          <stop offset="100%" stop-color="#6B8F5E" />
                        </radialGradient>
                        {/* Continent brown — clay terracotta land */}
                        <radialGradient id="continent-low" cx="40%" cy="35%" r="60%">
                          <stop offset="0%" stop-color="#C9A87C" />
                          <stop offset="100%" stop-color="#9A7B4F" />
                        </radialGradient>
                        {/* Desert/tan regions */}
                        <radialGradient id="continent-desert" cx="40%" cy="35%" r="60%">
                          <stop offset="0%" stop-color="#D4B896" />
                          <stop offset="100%" stop-color="#B8956A" />
                        </radialGradient>
                        <radialGradient id="earth-shadow" cx="60%" cy="65%" r="55%">
                          <stop offset="0%" stop-color="transparent" />
                          <stop offset="100%" stop-color="rgba(30,50,60,0.3)" />
                        </radialGradient>
                        <filter id="earth-shadow-cast" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="rgba(40,60,70,0.2)" />
                        </filter>
                      </defs>
                      {/* Ocean base */}
                      <circle cx="100" cy="100" r="82" fill="url(#earth-base)" />
                      {/* Continents — rough, raised relief shapes */}
                      <g filter="url(#earth-shadow-cast)">
                        {/* Africa — green */}
                        <path d="M 82 58 Q 95 45 108 55 Q 116 70 113 88 Q 106 108 93 113 Q 78 109 74 93 Q 75 73 82 58 Z" fill="url(#continent-raise)" />
                        {/* Eurasia — green/brown */}
                        <path d="M 118 48 Q 140 44 152 60 Q 154 78 145 90 Q 132 87 124 80 Q 118 70 118 48 Z" fill="url(#continent-raise)" />
                        {/* Americas — green */}
                        <path d="M 68 92 Q 82 108 80 132 Q 74 150 63 144 Q 55 126 58 108 Q 62 96 68 92 Z" fill="url(#continent-raise)" />
                        {/* Australia — tan/brown */}
                        <path d="M 128 118 Q 138 114 142 122 Q 140 132 132 135 Q 125 131 128 118 Z" fill="url(#continent-desert)" />
                        {/* Antarctica hint — pale */}
                        <path d="M 70 155 Q 90 150 110 155 Q 130 150 150 155 Q 150 168 130 170 Q 110 165 90 170 Q 70 168 70 155 Z" fill="rgba(220,210,195,0.5)" />
                      </g>
                      {/* Soft cast shadow lower-right */}
                      <circle cx="100" cy="100" r="82" fill="url(#earth-shadow)" />
                      {/* Upper-left highlight */}
                      <ellipse cx="80" cy="75" rx="26" ry="16" fill="rgba(255,255,255,0.15)" transform="rotate(-25 80 75)" />
                    </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* Modules */}
        <section className="modules" aria-labelledby="modules-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="modules-title" className="section-title">Five Modules. One Trust Layer.</h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <p className="section-subtitle">Each module runs independently. All share the same escrow, rewards, and reputation engine.</p>
            </ScrollReveal>
            <div className="modules-grid">
              {MODULES.map((mod, i) => (
                <ScrollReveal key={mod.id} delay={i * 80}>
                  <article
                    className={`module-card ${expandedCard === mod.id ? 'expanded' : ''}`}
                    onMouseEnter={() => handleCardHover(mod.tint)}
                    onMouseLeave={handleCardLeave}
                    onClick={(e) => handleCardClick(e, mod.path, mod.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(e as any, mod.path, mod.id); }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${mod.name} module card, opens ${mod.name} dashboard`}
                  >
                    <div className={`module-icon ${mod.colorClass}`}>
                      <ModuleIcon type={mod.icon} />
                    </div>
                    <h3 className="module-name">{mod.name}</h3>
                    <p className="module-tagline">{mod.tagline}</p>
                    <p className="module-desc">{mod.description}</p>
                    <a href={mod.path} className="module-link">Explore {mod.name} →</a>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* TrustOS Seal */}
        <section className="trust-section" aria-labelledby="trust-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="trust-title" className="section-title">Powered by TrustOS</h2>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <div className="trust-seal-container">
                <div className="trust-seal">
                  <div className="dust-mote" />
                  <div className="dust-mote" />
                  <div className="dust-mote" />
                  <div className="dust-mote" />
                  <div className="dust-mote" />
                  <div className="dust-mote" />
                  <span className="trust-seal-mark">◈</span>
                </div>
                <p className="section-subtitle">The shared trust engine protecting every transaction across all five modules.</p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <WaveDivider />

        {/* Trust Signals */}
        <section className="trust-signals" aria-labelledby="signals-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="signals-title" className="section-title">Why Trust, Why Now</h2>
            </ScrollReveal>
            <div className="trust-grid">
              {TRUST_SIGNALS.map((signal, i) => (
                <ScrollReveal key={signal.label} delay={i * 100}>
                  <div className="trust-card">
                    <p className="trust-number">{signal.number}</p>
                    <p className="trust-label">{signal.label}</p>
                    <p className="trust-detail">{signal.detail}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* How It Works */}
        <section className="how-it-works" aria-labelledby="how-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="how-title" className="section-title">How It Works</h2>
            </ScrollReveal>
            <div className="steps-container">
              {HOW_IT_WORKS.map((step, i) => (
                <ScrollReveal key={step.step} delay={i * 120}>
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

        {/* CTA */}
        <section className="cta-section" aria-labelledby="cta-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="cta-title" className="section-title">Ready to Build Trust?</h2>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="section-subtitle">Set up your business in five minutes. No crypto knowledge required.</p>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <MagneticButton className="btn btn-large btn-primary">
                Start Free
              </MagneticButton>
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
          <p className="footer-tagline">BookingOS · FreightOS · PropertyOS · ContactOS · LedgerOS — Powered by TrustOS</p>
          <nav className="footer-nav" aria-label="Footer">
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </nav>
          <p className="footer-copy">© 2026 Pabandi. The trust layer for the informal economy.</p>
        </div>
      </footer>
    </div>
  );
}
