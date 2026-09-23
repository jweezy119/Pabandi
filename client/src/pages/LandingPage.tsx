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
        {/* Hero — full viewport, earth dominates right side */}
        <section className="hero" aria-labelledby="hero-title" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
          <div className="container" style={{ width: '100%' }}>
            <div className="hero-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: '4rem' }}>
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

              <div className="hero-visual" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                  <div className="clay-earth" style={{ width: '60vh', height: '60vh', maxWidth: '500px', maxHeight: '500px' }}>
                    <svg width="100%" height="100%" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        {/* Sphere shading — 3D depth */}
                        <radialGradient id="earth-sphere" cx="38%" cy="32%" r="65%">
                          <stop offset="0%" stop-color="#8EC5E0" />
                          <stop offset="40%" stop-color="#5C8A9E" />
                          <stop offset="70%" stop-color="#3D6B7E" />
                          <stop offset="100%" stop-color="#1A3A4A" />
                        </radialGradient>
                        {/* Continent green — clay sage */}
                        <linearGradient id="cont-green" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#B5D4A8" />
                          <stop offset="100%" stop-color="#6B8F5E" />
                        </linearGradient>
                        {/* Continent brown — clay terracotta */}
                        <linearGradient id="cont-brown" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#D4B896" />
                          <stop offset="100%" stop-color="#9A7B4F" />
                        </linearGradient>
                        {/* Desert/tan */}
                        <linearGradient id="cont-tan" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#DCC9A8" />
                          <stop offset="100%" stop-color="#B8956A" />
                        </linearGradient>
                        {/* Atmosphere glow */}
                        <radialGradient id="atmos" cx="50%" cy="50%" r="50%">
                          <stop offset="85%" stop-color="transparent" />
                          <stop offset="100%" stop-color="rgba(180,210,230,0.15)" />
                        </radialGradient>
                        <filter id="relief" x="-10%" y="-10%" width="120%" height="120%">
                          <feDropShadow dx="3" dy="5" stdDeviation="6" flood-color="rgba(20,40,50,0.25)" />
                        </filter>
                      </defs>
                      {/* Atmosphere halo */}
                      <circle cx="150" cy="150" r="142" fill="url(#atmos)" />
                      {/* Ocean sphere */}
                      <circle cx="150" cy="150" r="135" fill="url(#earth-sphere)" />
                      {/* Continents spread across front face */}
                      <g filter="url(#relief)">
                        {/* North America — upper left front */}
                        <path d="M 75 95 Q 95 75 115 80 Q 130 90 125 110 Q 118 125 105 130 Q 90 128 80 115 Q 72 105 75 95 Z" fill="url(#cont-green)" />
                        {/* South America — lower left front */}
                        <path d="M 95 145 Q 108 138 115 150 Q 118 170 112 190 Q 105 200 95 195 Q 85 180 88 165 Q 90 150 95 145 Z" fill="url(#cont-green)" />
                        {/* Africa — center front */}
                        <path d="M 140 110 Q 160 100 175 115 Q 182 135 178 155 Q 172 175 160 180 Q 145 178 138 165 Q 132 148 135 130 Q 136 118 140 110 Z" fill="url(#cont-green)" />
                        {/* Europe — upper center */}
                        <path d="M 145 85 Q 165 78 180 88 Q 188 100 182 112 Q 172 118 158 115 Q 145 110 140 98 Q 140 90 145 85 Z" fill="url(#cont-tan)" />
                        {/* Asia — upper right front */}
                        <path d="M 190 80 Q 215 72 235 85 Q 245 100 240 118 Q 230 130 215 128 Q 198 122 190 108 Q 185 95 190 80 Z" fill="url(#cont-green)" />
                        {/* Australia — lower right front */}
                        <path d="M 215 165 Q 230 158 240 168 Q 245 180 238 192 Q 228 198 218 193 Q 208 185 210 175 Q 212 168 215 165 Z" fill="url(#cont-brown)" />
                        {/* Antarctica — bottom curve hint */}
                        <path d="M 100 220 Q 130 215 160 218 Q 190 215 220 220 Q 225 228 210 232 Q 180 235 150 232 Q 120 235 90 232 Q 80 228 100 220 Z" fill="rgba(210,200,185,0.45)" />
                        {/* Greenland-ish */}
                        <path d="M 115 62 Q 128 55 138 62 Q 142 72 135 80 Q 125 82 118 75 Q 112 68 115 62 Z" fill="url(#cont-tan)" />
                      </g>
                      {/* Specular highlight upper-left */}
                      <ellipse cx="115" cy="105" rx="45" ry="30" fill="rgba(255,255,255,0.12)" transform="rotate(-30 115 105)" />
                      {/* Terminator shadow lower-right */}
                      <circle cx="150" cy="150" r="135" fill="url(#atmos)" />
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
