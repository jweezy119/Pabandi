import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import PageTransition from './PageTransition';
import GlobalAIConciergeWidget from './GlobalAIConciergeWidget';
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
      { to: '/gigs', icon: 'work', label: 'Gig Board' },
      { to: '/agent-dashboard', icon: 'smart_toy', label: 'AI Agent Loop' },
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
            <Dropdown label="Marketplace" current={['/live-selling', '/hospitality', '/freelance', '/gigs', '/agent-dashboard', '/profiles'].some((p) => location.pathname.startsWith(p))}>
              <DropdownItem to="/live-selling">Live Selling</DropdownItem>
              <DropdownItem to="/hospitality">Hospitality</DropdownItem>
              <DropdownItem to="/freelance">Freelancers</DropdownItem>
              <DropdownItem to="/gigs">Gig Board</DropdownItem>
              <DropdownItem to="/agent-dashboard">AI Agent Loop</DropdownItem>
              <DropdownItem to="/promo">Promo Ambassadors</DropdownItem>
              <DropdownItem to="/rewards">Rewards</DropdownItem>
            </Dropdown>
            <Dropdown label="Trust & Safety" current={['/trust', '/background-check', '/protected-deposit', '/arbitration', '/agent-passport'].some((p) => location.pathname.startsWith(p))}>
              <DropdownItem to="/trust">Trust Passports</DropdownItem>
              <DropdownItem to="/agent-passport">Agent Passport</DropdownItem>
              <DropdownItem to="/background-check">Background Check</DropdownItem>
              <DropdownItem to="/protected-deposit">Protected Deposit</DropdownItem>
              <DropdownItem to="/arbitration">Arbitration</DropdownItem>
            </Dropdown>
            <Dropdown label="Money" current={['/cashout', '/payroll', '/economy', '/web3', '/revenue', '/agent-passport'].some((p) => location.pathname.startsWith(p))}>
              <DropdownItem to="/cashout">Cash Out</DropdownItem>
              <DropdownItem to="/payroll">Instant Pay</DropdownItem>
              <DropdownItem to="/economy">Economy</DropdownItem>
              <DropdownItem to="/revenue">Revenue</DropdownItem>
              <DropdownItem to="/web3">Web3</DropdownItem>
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
