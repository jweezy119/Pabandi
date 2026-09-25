import { useState, useEffect, useRef, useCallback } from 'react';
import ClayEarthScene from '../components/clay/ClayEarthScene';
import { FiBell, FiUser, FiChevronDown, FiLogIn, FiLogOut, FiSettings, FiBriefcase, FiMenu, FiX } from 'react-icons/fi';

const MODULES = [
  { id: 'booking', name: 'BookingOS', tagline: 'Book with trust', description: 'Customers book with confidence. Businesses get escrow-backed deposits.', icon: 'calendar', colorClass: 'module-icon-booking', tint: '#A85A3C', path: '/booking' },
  { id: 'freight', name: 'FreightOS', tagline: 'Move with escrow', description: 'Shippers pay into escrow. Carriers get paid on delivery.', icon: 'package', colorClass: 'module-icon-freight', tint: '#8A9A7B', path: '/freight' },
  { id: 'property', name: 'PropertyOS', tagline: 'Buy, rent, manage with trust.', description: 'Landlords screen tenants. Buyers verify documents. Every deal escrow-backed.', icon: 'house', colorClass: 'module-icon-property', tint: '#D4A5A5', path: '/property' },
  { id: 'contact', name: 'ContactOS', tagline: 'Every relationship, one trusted record.', description: 'Track clients, close deals, and know who\'s reliable before you commit.', icon: 'funnel', colorClass: 'module-icon-contact', tint: '#D9A854', path: '/contact' },
  { id: 'ledger', name: 'LedgerOS', tagline: 'Track with clarity', description: 'Send invoices, record expenses, see profit in real time.', icon: 'coin', colorClass: 'module-icon-ledger', tint: '#B8C9D4', path: '/ledger' },
];

const TRUST_SIGNALS = [
  { number: '100%', label: 'Escrow-backed', detail: 'Funds held securely until service delivered' },
  { number: '$PAB', label: 'Reward token', detail: 'Earn for every verified transaction' },
  { number: 'Portable', label: 'Trust Passport', detail: 'Your reputation travels with you' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Post your business', desc: 'Tell us what you do — cleaning, plumbing, real estate, freelance.' },
  { step: '2', title: 'Get your CRM', desc: 'Instant pipeline, client tracking, scheduling, and trust scoring.' },
  { step: '3', title: 'Earn & grow', desc: 'Close deals with escrow protection. Earn $PAB on every transaction.' },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, isVisible };
}

function ScrollReveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal();
  return <div ref={ref} className={`scroll-reveal ${isVisible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function WaveDivider() {
  return (
    <div className="wave-divider">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path className="wave-anim" d="M0,30 C200,50 400,10 600,30 C800,50 1000,10 1200,30 L1200,60 L0,60 Z" fill="var(--warm-sand)" />
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
    setOffset({ x: (e.clientX - rect.left - rect.width / 2) * 0.15, y: (e.clientY - rect.top - rect.height / 2) * 0.15 });
  };
  return (
    <button ref={btnRef} className={`magnetic-btn ${className}`} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} onMouseMove={handleMouseMove} onMouseLeave={() => setOffset({ x: 0, y: 0 })} {...props}>
      {children}
    </button>
  );
}

function ModuleIcon({ type, className = '' }: { type: string; className?: string }) {
  const icons: Record<string, string> = { calendar: '📅', package: '📦', house: '🏠', funnel: '📊', coin: '🪙' };
  return <span className={className}>{icons[type] || '◈'}</span>;
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem('token');
  const user = token ? JSON.parse(localStorage.getItem('user') || '{}') : null;

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  if (!token) {
    return (
      <div className="flex items-center gap-2">
        <a href="/login" className="px-4 py-2 text-sm font-medium text-[var(--warm-ink)] hover:text-[var(--clay)] transition">Sign In</a>
        <a href="/register" className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium hover:bg-[var(--terracotta)] transition">Get Started</a>
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--warm-sand)] transition">
        <div className="w-8 h-8 rounded-full bg-[var(--clay)] flex items-center justify-center text-white text-sm font-bold">
          {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
        </div>
        <span className="text-sm font-medium text-[var(--warm-ink)] hidden sm:block">{user?.fullName || user?.email}</span>
        <FiChevronDown className="w-4 h-4 text-[var(--soft-stone)]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white shadow-lg border border-[var(--soft-stone)]/30 z-50 py-2">
            <a href="/crm" className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">
              <FiBriefcase className="w-4 h-4" /> Dashboard
            </a>
            <a href="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">
              <FiSettings className="w-4 h-4" /> Settings
            </a>
            <hr className="my-1 border-[var(--soft-stone)]/30" />
            <button onClick={logout} className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--terracotta)] hover:bg-red-50 w-full text-left">
              <FiLogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setNotifications(data.data || []))
      .catch(() => {});
  }, [token]);

  if (!token) return null;

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 rounded-xl hover:bg-[var(--warm-sand)] transition relative">
        <FiBell className="w-5 h-5 text-[var(--warm-ink)]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--terracotta)] text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-white shadow-lg border border-[var(--soft-stone)]/30 z-50">
            <div className="p-4 border-b border-[var(--soft-stone)]/30">
              <h3 className="font-bold text-[var(--warm-ink)]">Notifications</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[var(--soft-stone)] text-sm">No notifications yet</div>
              ) : (
                notifications.slice(0, 10).map(n => (
                  <div key={n.id} className={`px-4 py-3 border-b border-[var(--soft-stone)]/20 hover:bg-[var(--warm-sand)] transition ${!n.read ? 'bg-blue-50/50' : ''}`}>
                    <p className="text-sm font-medium text-[var(--warm-ink)]">{n.subject}</p>
                    <p className="text-xs text-[var(--soft-stone)] mt-1">{n.message}</p>
                    <p className="text-xs text-[var(--soft-stone)] mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [pageTint, setPageTint] = useState<string>("#F5EFE6");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const blendColors = (color1: string, color2: string, ratio: number): string => {
    const r1 = parseInt(color1.slice(1, 3), 16), g1 = parseInt(color1.slice(3, 5), 16), b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16), g2 = parseInt(color2.slice(3, 5), 16), b2 = parseInt(color2.slice(5, 7), 16);
    const r = Math.round(r1 * ratio + r2 * (1 - ratio));
    const g = Math.round(g1 * ratio + g2 * (1 - ratio));
    const b = Math.round(b1 * ratio + b2 * (1 - ratio));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCardHover = useCallback((tint: string) => {
    setPageTint(blendColors(tint, "#F5EFE6", 0.1));
  }, []);

  const handleCardLeave = useCallback(() => {
    setPageTint("#F5EFE6");
  }, []);

  const handleCardClick = (e: React.MouseEvent, path: string, moduleId: string) => {
    e.preventDefault();
    setExpandedCard(moduleId);
    setTimeout(() => { window.location.href = path; }, 600);
  };

  return (
    <div className="landing" ref={landingRef} style={{ '--page-tint': pageTint } as any}>
      {/* Header */}
      <header className="header">
        <div className="container">
          <a href="/" className="logo">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </a>
          <nav className="nav-list" aria-label="Main">
            <a href="/contact">Contact</a>
            <a href="/property">Property</a>
            <a href="/booking">Booking</a>
            <a href="/freight">Freight</a>
            <a href="/ledger">Ledger</a>
          </nav>
          <div className="header-right">
            <a href="/post-business" className="cta-nav-outline hidden sm:flex">Post Business</a>
            <NotificationBell />
            <UserMenu />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-xl hover:bg-[var(--warm-sand)]">
              {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--soft-stone)]/30 bg-white px-4 py-4 space-y-2">
            <a href="/booking" className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Booking</a>
            <a href="/freight" className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Freight</a>
            <a href="/property" className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Property</a>
            <a href="/contact" className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Contact</a>
            <a href="/ledger" className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Ledger</a>
            <hr className="border-[var(--soft-stone)]/30" />
            <a href="/post-business" className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--clay)] font-bold hover:bg-[var(--warm-sand)]">Post Business</a>
            <a href="/crm" className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Dashboard</a>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="hero" aria-labelledby="hero-title" style={{ minHeight: '85vh', display: 'flex', alignItems: 'center' }}>
          <div className="container" style={{ width: '100%' }}>
            <div className="hero-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: '4rem' }}>
              <div className="hero-content">
                <p className="hero-kicker">The trust operating system</p>
                <h1 id="hero-title" className="hero-title">
                  <span className="word">Commitment,</span><br />
                  <span className="word hero-accent">Secured.</span>
                </h1>
                <p className="hero-subtitle">
                  Post your business. Get your CRM. Start earning with escrow-backed trust.
                  <br />Built for service providers, property managers, and freelancers.
                </p>
                <div className="hero-actions">
                  <MagneticButton className="btn btn-primary" onClick={() => window.location.href = '/post-business'}>
                    Post Your Business
                  </MagneticButton>
                  <a href="/crm" className="btn btn-secondary">
                    View Dashboard
                  </a>
                </div>
              </div>

              <div className="hero-visual" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                <div className="clay-earth" style={{ width: '55vh', height: '55vh', maxWidth: '480px', maxHeight: '480px' }}>
                  <ClayEarthScene />
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

        {/* CTA */}
        <section className="cta-section" aria-labelledby="cta-title">
          <div className="container">
            <ScrollReveal>
              <h2 id="cta-title" className="section-title">Ready to Build Trust?</h2>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="section-subtitle">Post your business in 2 minutes. Get your CRM instantly. No crypto knowledge required.</p>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <MagneticButton className="btn btn-large btn-primary" onClick={() => window.location.href = '/post-business'}>
                Post Your Business
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
