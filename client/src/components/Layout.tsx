import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import PageTransition from './PageTransition';
import GlobalAIConciergeWidget from './GlobalAIConciergeWidget';
import ParticleField from './ParticleField';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState, useRef } from 'react';

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

function DesktopNavLink({ to, children, current }: { to: string; children: React.ReactNode; current: boolean }) {
  return (
    <Link
      to={to}
      className={`font-headline text-sm transition-all duration-200 relative ${
        current ? 'text-primary font-bold scale-[1.02]' : 'text-on-surface-variant hover:text-primary hover:scale-[1.02]'
      }`}
    >
      {children}
      {current && <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-primary rounded-full" />}
    </Link>
  );
}

function Dropdown({ label, children, current }: { label: string; children: React.ReactNode; current: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        className={`font-headline text-sm transition-all duration-200 flex items-center gap-1 ${
          current ? 'text-primary font-bold scale-[1.02]' : 'text-on-surface-variant hover:text-primary hover:scale-[1.02]'
        }`}
      >
        {label}
        <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 pt-3 z-40" onClick={() => setOpen(false)}>
            <div className="bg-surface-bright/90 backdrop-blur-xl border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/30 py-2 min-w-[180px] transform transition-all duration-200 origin-top">
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DropdownItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="block px-4 py-2.5 text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-low/70 transition-all duration-150"
    >
      {children}
    </Link>
  );
}

function MobileMoreSheet({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  const sections = [
    { title: 'Marketplace', items: [
      { to: '/live-selling', icon: 'videocam', label: 'Live Selling' },
      { to: '/hospitality', icon: 'hotel', label: 'Hospitality' },
      { to: '/freelance', icon: 'group', label: 'Freelancers' },
    ]},
    { title: 'Trust & Safety', items: [
      { to: '/trust', icon: 'verified', label: 'Trust Passports' },
      { to: '/background-check', icon: 'fact_check', label: 'Background Check' },
      { to: '/protected-deposit', icon: 'shield', label: 'Protected Deposit' },
      { to: '/arbitration', icon: 'gavel', label: 'Arbitration' },
    ]},
    { title: 'Money', items: [
      { to: '/cashout', icon: 'payments', label: 'Cash Out' },
      { to: '/payroll', icon: 'account_balance_wallet', label: 'Instant Pay' },
      { to: '/economy', icon: 'trending_up', label: 'Economy' },
      { to: '/web3', icon: 'token', label: 'Web3' },
    ]},
    { title: 'Company', items: [
      { to: '/about', icon: 'info', label: 'About' },
      { to: '/sharia-compliance', icon: 'menu_book', label: 'Sharia Compliance' },
      { to: '/technology', icon: 'memory', label: 'Technology' },
      { to: '/join', icon: 'storefront', label: 'List Business' },
      { to: '/developer', icon: 'code', label: 'API Docs' },
    ]},
  ];
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-surface-bright border border-outline-variant/20 rounded-3xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-headline font-bold text-base">Explore Pabandi</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center touch-target">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="space-y-4">
          {sections.map((sec) => (
            <div key={sec.title}>
              <p className="text-[11px] uppercase tracking-widest opacity-50 px-1 mb-1.5">{sec.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {sec.items.map((it) => {
                  const current = pathname.startsWith(it.to);
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition-all touch-target ${current ? 'bg-primary-container/40 text-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{it.icon}</span>
                      <span className="font-body text-sm font-semibold">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileTab({ to, icon, label, current }: { to: string; icon: string; label: string; current: boolean }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 touch-target ${
        current
          ? 'text-primary bg-primary-container/30 scale-[1.05]'
          : 'text-on-surface-variant hover:text-primary active:scale-95'
      }`}
    >
      <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: current ? "'FILL' 1" : "'FILL' 0" }}>
        {icon}
      </span>
      <span className="font-body text-[11px] font-semibold tracking-wide">{label}</span>
    </Link>
  );
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const go = () => {
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface-bright border border-outline-variant/20 rounded-3xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 py-2">
          <span className="material-symbols-outlined text-outline">search</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="Find venues, live sellers, services..."
            className="bg-transparent w-full text-sm font-body focus:outline-none"
          />
          <button onClick={go} className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold">Search</button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {['Chicago', 'Live Selling', 'Freelance', 'Hospitality'].map((chip) => (
            <button
              key={chip}
              onClick={() => {
                if (chip === 'Live Selling') {
                  navigate('/live-selling');
                  onClose?.();
                  return;
                }
                setQ(chip);
                go();
              }}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-highest transition-colors touch-target"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { isAuthenticated, user, logout, fetchWalletData } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWalletData();
    }
  }, [isAuthenticated, fetchWalletData]);

  const handleLogout = () => { logout(); navigate('/'); };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/forgot-password' || location.pathname.startsWith('/reset-password');
  const isDetailScreen = location.pathname.includes('/book') || location.pathname.includes('/new');
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '';
  const isOwnerOrAdmin = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN';
  const scrolled = useScrolled();

  // Global scroll-reveal: activate any .reveal element on every route change
  // so pages get fade-up motion without wiring a ref per component.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (reduce) {
      els.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '-60px' },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [location.pathname]);

  return (
    <div className="bg-transparent text-on-surface font-body antialiased min-h-screen flex flex-col relative w-full overflow-x-hidden">
      {/* Deep Space & Neon Background Layer */}
      <div className="fixed inset-0 z-[-1] pointer-events-none bg-background overflow-hidden">
         <img src="/assets/bg_abstract.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-screen" />
         <ParticleField density={0.00005} />
         <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-radial-glow blur-3xl opacity-60" />
         <div className="absolute bottom-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-glow blur-3xl opacity-50" />
      </div>

      {!isAuthPage && (
        <header className={`flex justify-between items-center w-full px-3 sm:px-6 h-14 sm:h-16 fixed top-0 z-40 border-b shadow-2xl transition-all duration-300 ${scrolled ? 'bg-surface/60 backdrop-blur-2xl border-white/10 scale-[1.01]' : 'bg-surface/30 backdrop-blur-2xl border-white/5 scale-100'}`}>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link to={isOwnerOrAdmin ? '/dashboard' : '/profile'} className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs md:text-sm font-bold shrink-0 touch-target">
                {initials}
              </Link>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 touch-target">
                <span className="material-symbols-outlined">person</span>
              </div>
            )}
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-company.jpg" alt="Pabandi" className="h-6 sm:h-8 w-auto" />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-2 font-headline text-sm">
            <DesktopNavLink to="/" current={location.pathname === '/'}>Home</DesktopNavLink>
            <Dropdown label="Marketplace" current={['/live-selling', '/hospitality', '/freelance', '/profiles'].some((p) => location.pathname.startsWith(p))}>
              <DropdownItem to="/live-selling">Live Selling</DropdownItem>
              <DropdownItem to="/hospitality">Hospitality</DropdownItem>
              <DropdownItem to="/freelance">Freelancers</DropdownItem>
            </Dropdown>
            <Dropdown label="Trust & Safety" current={['/trust', '/background-check', '/protected-deposit', '/arbitration', '/agent-passport'].some((p) => location.pathname.startsWith(p))}>
              <DropdownItem to="/trust">Trust Passports</DropdownItem>
              <DropdownItem to="/agent-passport">Agent Passport</DropdownItem>
              <DropdownItem to="/background-check">Background Check</DropdownItem>
              <DropdownItem to="/protected-deposit">Protected Deposit</DropdownItem>
              <DropdownItem to="/arbitration">Arbitration</DropdownItem>
            </Dropdown>
            <Dropdown label="Money" current={['/cashout', '/payroll', '/economy', '/web3', '/revenue', '/usdy', '/agent-passport'].some((p) => location.pathname.startsWith(p))}>
              <DropdownItem to="/cashout">Cash Out</DropdownItem>
              <DropdownItem to="/payout">Instant Pay</DropdownItem>
              <DropdownItem to="/economy">Economy</DropdownItem>
              <DropdownItem to="/revenue">Revenue</DropdownItem>
              <DropdownItem to="/web3">Web3</DropdownItem>
              <DropdownItem to="/usdy">USDY Yield →</DropdownItem>
            </Dropdown>
            <Dropdown label="Company" current={['/about', '/sharia-compliance', '/technology', '/join', '/developer'].some((p) => location.pathname.startsWith(p))}>
              <DropdownItem to="/about">About</DropdownItem>
              <DropdownItem to="/sharia-compliance">Sharia Compliance</DropdownItem>
              <DropdownItem to="/technology">Technology</DropdownItem>
              <DropdownItem to="/join">List Business</DropdownItem>
              <DropdownItem to="/developer">API Docs</DropdownItem>
            </Dropdown>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(true)} className="md:hidden w-10 h-10 rounded-full bg-white/10 backdrop-blur text-on-surface flex items-center justify-center touch-target hover:bg-white/20 active:scale-95 transition-all duration-200">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            {isAuthenticated ? (
              <Dropdown label={initials} current={false}>
                <DropdownItem to="/dashboard">Dashboard</DropdownItem>
                <DropdownItem to="/wallet">Wallet</DropdownItem>
                <DropdownItem to="/refer">Refer &amp; Earn</DropdownItem>
                <DropdownItem to="/loans">Halal DeFi</DropdownItem>
                <DropdownItem to="/account-manager">Partner Portal</DropdownItem>
                <DropdownItem to="/profile">Profile</DropdownItem>
                <button onClick={handleLogout} className="block w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-all duration-150">Log Out</button>
              </Dropdown>
            ) : (
              <div className="hidden md:flex gap-2">
                <Link to="/login" className="text-sm font-medium px-3 py-1.5 text-on-surface-variant hover:text-primary transition-all duration-200">Sign In</Link>
                <Link to="/register" className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-[1px] transition-all duration-200">Sign Up</Link>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="flex-grow mobile-safe-bottom">
        <PageTransition>
          <Outlet />
        </PageTransition>
        <GlobalAIConciergeWidget />
      </main>

      {!isAuthPage && (
        <footer className="border-t border-white/5 bg-surface/30 backdrop-blur-xl mt-16">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="font-bold text-slate-100 mb-3">Product</h4>
                <div className="space-y-2">
                  <Link to="/hotels" className="block text-sm text-slate-400 hover:text-white transition-colors">Hotels</Link>
                  <Link to="/demo" className="block text-sm text-slate-400 hover:text-white transition-colors">Demo</Link>
                  <Link to="/property-manager" className="block text-sm text-slate-400 hover:text-white transition-colors">Property Manager</Link>
                  <Link to="/live-selling" className="block text-sm text-slate-400 hover:text-white transition-colors">Live Selling</Link>
                  <Link to="/freelance" className="block text-sm text-slate-400 hover:text-white transition-colors">Freelancers</Link>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-100 mb-3">Company</h4>
                <div className="space-y-2">
                  <Link to="/about" className="block text-sm text-slate-400 hover:text-white transition-colors">About</Link>
                  <Link to="/technology" className="block text-sm text-slate-400 hover:text-white transition-colors">Technology</Link>
                  <Link to="/join" className="block text-sm text-slate-400 hover:text-white transition-colors">List Business</Link>
                  <Link to="/developer" className="block text-sm text-slate-400 hover:text-white transition-colors">API Docs</Link>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-100 mb-3">Trust & Safety</h4>
                <div className="space-y-2">
                  <Link to="/trust" className="block text-sm text-slate-400 hover:text-white transition-colors">Trust Passports</Link>
                  <Link to="/background-check" className="block text-sm text-slate-400 hover:text-white transition-colors">Background Check</Link>
                  <Link to="/protected-deposit" className="block text-sm text-slate-400 hover:text-white transition-colors">Protected Deposit</Link>
                  <Link to="/arbitration" className="block text-sm text-slate-400 hover:text-white transition-colors">Arbitration</Link>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-100 mb-3">Legal</h4>
                <div className="space-y-2">
                  <Link to="/privacy" className="block text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
                  <Link to="/terms" className="block text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
                  <Link to="/sharia-compliance" className="block text-sm text-slate-400 hover:text-white transition-colors">Sharia Compliance</Link>
                </div>
              </div>
            </div>
            <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <span className="font-bold text-slate-100">Pabandi</span>
                <span className="text-xs text-slate-500">© 2026</span>
              </div>
              <p className="text-xs text-slate-500 text-center">
                Commitment, Secured. Trust layer for local commerce.
              </p>
              <div className="flex items-center gap-4">
                <a href="https://x.com/pabandiglobal" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://www.linkedin.com/company/pabandi/" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="https://instagram.com/pabandiglobal" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}

      {!isAuthPage && !isDetailScreen && (
        <nav className="fixed bottom-0 w-full z-50 bg-surface-bright/80 backdrop-blur-xl border-t border-outline-variant/10 md:hidden">
          <div className="flex justify-around items-center px-2 py-2 safe-area-bottom">
            <MobileTab to="/" icon="explore" label="Home" current={location.pathname === '/'} />
            <MobileTab to="/live-sell" icon="videocam" label="Live" current={location.pathname === '/live-sell'} />
            <button onClick={() => setSearchOpen(true)} className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all touch-target ${'text-on-surface-variant hover:text-primary active:scale-95'}`}>
              <span className="material-symbols-outlined text-[24px]">search</span>
              <span className="font-body text-[11px] font-semibold tracking-wide">Search</span>
            </button>
            <MobileTab
              to={isOwnerOrAdmin ? '/dashboard' : '/reservations'}
              icon={isOwnerOrAdmin ? 'dashboard' : 'calendar_month'}
              label={isOwnerOrAdmin ? 'Dashboard' : 'Bookings'}
              current={location.pathname === '/dashboard' || location.pathname.startsWith('/reservations')}
            />
            <MobileTab to="/profile" icon="person" label="Profile" current={location.pathname === '/profile'} />
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all touch-target ${moreOpen ? 'text-primary bg-primary-container/30 scale-[1.05]' : 'text-on-surface-variant hover:text-primary active:scale-95'}`}
            >
              <span className="material-symbols-outlined text-[24px]">apps</span>
              <span className="font-body text-[11px] font-semibold tracking-wide">More</span>
            </button>
          </div>
        </nav>
      )}

      {searchOpen && <SearchSheet onClose={() => setSearchOpen(false)} />}
      {moreOpen && <MobileMoreSheet onClose={() => setMoreOpen(false)} pathname={location.pathname} />}
    </div>
  );
}
