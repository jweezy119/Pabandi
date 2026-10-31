import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GuaranteeSplitVisual, GUARANTEE_STEPS } from '../components/GuaranteeVisuals';
import { useAuthStore } from '../store/authStore';

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
  // FreightOS removed from public view to focus on A2A
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
    name: 'Contact OS',
    tagline: 'Every relationship, one trusted record.',
    description: 'Track clients, close deals, and know who\'re reliable before you commit.',
    icon: 'funnel',
    colorClass: 'module-icon-contact',
    tint: '#D9A854',
    path: '/contact',
  },
  {
    id: 'capital',
    name: 'CapitalOS',
    tagline: 'Track with clarity',
    description: 'Send invoices, record expenses, see profit in real time.',
    icon: 'coin',
    colorClass: 'module-icon-ledger',
    tint: '#B8C9D4',
    path: '/capital',
  },
];

const TRUST_SIGNALS = [
  { number: '100%', label: 'Escrow-backed', detail: 'Funds held securely until service delivered' },
  { number: '$PAB', label: 'Reward token', detail: 'Earn for every verified transaction' },
  { number: 'Portable', label: 'Trust Passport', detail: 'Your reputation travels with you' },
];

/**
 * The four escrow steps, written for the hero-adjacent strip. Same story as
 * GUARANTEE_STEPS; this is the short version that fits in a scroll.
 */
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

function TrustedBySection() {
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [samples, setSamples] = useState<{ id: string; initial: string; category: string; avgScore: number }[]>([]);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    fetch(`${baseUrl}/api/v1/trust-profile/stats/count`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTotalBusinesses(data.data.totalBusinesses);
          setSamples(data.data.samples);
        }
      })
      .catch(() => { /* graceful degradation */ });
  }, []);

  const tierColor = (score: number) =>
    score >= 700 ? '#2D6A4F' : score >= 450 ? '#B08D57' : '#BFB3A3';

  const tierBg = (score: number) =>
    score >= 700 ? '#D8F3DC' : score >= 450 ? '#FFF3E0' : '#F0ECE6';

  return (
    <section className="trust-social-proof" aria-labelledby="social-proof-title" style={{
      padding: '4rem 0',
    }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <ScrollReveal>
          <h2 id="social-proof-title" className="section-title">
            Trusted by {totalBusinesses > 0 ? totalBusinesses.toLocaleString() : '—'} businesses
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <p className="section-subtitle" style={{ marginBottom: '2rem' }}>
            Real businesses building real trust on the Pabandi network
          </p>
        </ScrollReveal>

        {samples.length > 0 && (
          <ScrollReveal delay={200}>
            <div style={{
              display: 'flex', gap: '12px', justifyContent: 'center',
              flexWrap: 'wrap', marginBottom: '2rem',
            }}>
              {samples.map((s) => (
                <a
                  key={s.id}
                  href={`/trust/${s.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', borderRadius: 14,
                    background: '#fff',
                    boxShadow: '0 2px 8px rgba(58,50,43,0.06)',
                    textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s',
                    border: '1px solid #F0ECE6',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(58,50,43,0.12)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(58,50,43,0.06)';
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #C4A882, #A85A3C)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 15,
                  }}>
                    {s.initial}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#7A736E' }}>
                      {s.category.replace(/_/g, ' ')}
                    </p>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 700,
                      color: tierColor(s.avgScore),
                      background: tierBg(s.avgScore),
                      padding: '1px 8px', borderRadius: 8, display: 'inline-block',
                    }}>
                      {s.avgScore}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal delay={300}>
          {samples.length > 0 && (
            <Link to={`/trust/profile/${samples[0].id}`} className="module-link" style={{
              fontSize: '15px', fontWeight: 600,
              color: 'var(--clay)',
            }}>
              See how trust works →
            </Link>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [scrollY, setScrollY] = useState(0);
  const [pageTint, setPageTint] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCardHover = useCallback((tint: string) => {
    setPageTint(tint);
  }, []);

  const handleCardLeave = useCallback(() => {
    setPageTint(null);
  }, []);

  const handleCardClick = (e: React.MouseEvent, path: string, moduleId: string) => {
    e.preventDefault();
    setExpandedCard(moduleId);
    
    // Navigate after animation
    setTimeout(() => {
      navigate(path);
    }, 600);
  };

  return (
    <div className="landing" ref={landingRef} style={pageTint ? { '--page-tint': `color-mix(in srgb, ${pageTint} 10%, #F5EFE6)` } as React.CSSProperties : undefined}>
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
          <Link to="/" className="logo">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </Link>
          <nav className="nav-list" aria-label="Main">
            <Link to="/guarantee">The Guarantee</Link>
            <Link to="/contact">CRM</Link>
            <Link to="/booking">Booking</Link>
            <Link to="/property">Property</Link>
            <Link to="/capital">Capital</Link>
          </nav>
          {isAuthenticated ? (
            <Link to="/contact" className="cta-nav">Dashboard</Link>
          ) : (
            <Link to="/signup?module=contact" className="cta-nav">Get Started</Link>
          )}
        </div>
      </header>

      <main>
{/* Hero */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="container">
            <div className="hero-inner">
              <div className="hero-content">
                <p className="hero-kicker">The high-ticket guarantee engine</p>
                <h1 id="hero-title" className="hero-title">
                  <span className="word">Get Paid Before</span><br />
                  <span className="word">You Show Up.</span><br />
                  <span className="word hero-accent">Guaranteed.</span>
                </h1>
                <p className="hero-subtitle">
                  Pabandi locks client deposits in secure crypto escrow. If they ghost, you keep the
                  money. If they show, the funds release instantly. Built for high-ticket service
                  providers — wedding photographers, contractors, roofers, agencies, and the agents
                  that book them.
                </p>
                <div className="hero-actions">
                  {isAuthenticated ? (
                    <MagneticButton className="btn btn-primary" onClick={() => navigate('/contact')}>
                      Open My Vault
                    </MagneticButton>
                  ) : (
                    <>
                      <MagneticButton className="btn btn-primary" onClick={() => navigate('/signup?module=contact')}>
                        Protect My Revenue
                      </MagneticButton>
                      <Link to="/guarantee" className="btn btn-secondary">
                        See how the guarantee works
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="hero-visual">
                <GuaranteeSplitVisual />
              </div>
            </div>
          </div>
        </section>

        <WaveDivider />

        {/* Modules */}
        <section className="modules" aria-labelledby="modules-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="modules-title" className="section-title">Every Module Runs on the Same Escrow</h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <p className="section-subtitle">Bookings, property, invoicing — the guarantee engine underneath is the product. The CRM is just where it lives.</p>
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
                    <Link to={mod.path} className="module-link">Explore {mod.name} →</Link>
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

        {/* How It Works — the escrow flow */}
        <section className="how-it-works" aria-labelledby="how-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="how-title" className="section-title">The Escrow Flow, in Four Moves</h2>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <p className="section-subtitle">
                The deposit never sits in anyone's bank account. It sits in escrow, and the only
                thing that decides where it goes is whether you show up. <Link to="/guarantee" className="module-link">The full guarantee →</Link>
              </p>
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

        {/* Social Proof */}
        <TrustedBySection />

        <WaveDivider />

        {/* CTA */}
        <section className="cta-section" aria-labelledby="cta-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="cta-title" className="section-title">Ready to Guarantee Your Next Booking?</h2>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="section-subtitle">Lock your next high-ticket client in escrow. Five minutes to set up. No crypto knowledge required.</p>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              {isAuthenticated ? (
                <MagneticButton className="btn btn-large btn-primary" onClick={() => navigate('/contact')}>
                  Open My Vault
                </MagneticButton>
              ) : (
                <MagneticButton className="btn btn-large btn-primary" onClick={() => navigate('/signup?module=contact')}>
                  Protect My Revenue
                </MagneticButton>
              )}
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
          <p className="footer-tagline">BookingOS · PropertyOS · Contact OS · CapitalOS — Powered by TrustOS</p>
          <nav className="footer-nav" aria-label="Footer">
            <Link to="/guarantee">The Guarantee</Link>
            <Link to="/developers">Developers</Link>
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
          <p className="footer-copy">© 2026 Pabandi. The high-ticket guarantee engine.</p>
        </div>
      </footer>
    </div>
  );
}
