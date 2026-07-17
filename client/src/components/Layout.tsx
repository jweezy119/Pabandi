import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import PageTransition from './PageTransition';
import GlobalAIConciergeWidget from './GlobalAIConciergeWidget';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState, useRef } from 'react';

function DesktopNavLink({ to, children, current }: { to: string; children: React.ReactNode; current: boolean }) {
  return (
    <Link
      to={to}
      className={`font-headline text-sm transition-colors relative ${
        current ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
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
        className={`font-headline text-sm transition-colors flex items-center gap-1 ${
          current ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        {label}
        <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 pt-2 z-40" onClick={() => setOpen(false)}>
            <div className="bg-surface-bright border border-outline-variant/20 rounded-xl shadow-xl py-2 min-w-[180px]">
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
      className="block px-4 py-2 text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
    >
      {children}
    </Link>
  );
}

function MobileTab({ to, icon, label, current }: { to: string; icon: string; label: string; current: boolean }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all ${
        current
          ? 'text-primary bg-primary-container/30 scale-[1.05]'
          : 'text-on-surface-variant hover:text-primary active:scale-95'
      }`}
    >
      <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: current ? "'FILL' 1" : "'FILL' 0" }}>
        {icon}
      </span>
      <span className="font-body text-[10px] font-semibold tracking-wide">{label}</span>
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
              className="shrink-0 px-3 py-2 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-highest transition-colors"
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
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '';
  const isOwnerOrAdmin = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN';

  return (
    <div className="bg-surface text-on-surface font-body antialiased min-h-screen flex flex-col">
      {!isAuthPage && (
        <header className="bg-surface-bright/70 backdrop-blur-md flex justify-between items-center w-full px-4 md:px-6 h-16 fixed top-0 z-40 border-b border-outline-variant/10 transition-all duration-300">
          <div className="flex items-center gap-2 md:gap-3">
            {isAuthenticated ? (
              <Link to={isOwnerOrAdmin ? '/dashboard' : '/profile'} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs md:text-sm font-bold shrink-0">
                {initials}
              </Link>
            ) : (
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">person</span>
              </div>
            )}
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-company.jpg" alt="Pabandi" className="h-7 md:h-8 w-auto" />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 font-headline text-sm">
            <DesktopNavLink to="/" current={location.pathname === '/'}>Home</DesktopNavLink>
            <DesktopNavLink to="/live-selling" current={location.pathname === '/live-selling'}>Live Selling</DesktopNavLink>
            <DesktopNavLink to="/hospitality" current={location.pathname === '/hospitality'}>Hospitality</DesktopNavLink>
            <DesktopNavLink to="/freelance" current={location.pathname === '/freelance'}>Freelance</DesktopNavLink>
            <DesktopNavLink to="/web3" current={location.pathname === '/web3'}>Web3</DesktopNavLink>
            <DesktopNavLink to="/sharia-compliance" current={location.pathname === '/sharia-compliance'}>Sharia Compliance</DesktopNavLink>
            <DesktopNavLink to="/about" current={location.pathname === '/about'}>About</DesktopNavLink>
            <Dropdown label="More" current={['/technology'].includes(location.pathname)}>
              <DropdownItem to="/technology">Technology</DropdownItem>

              <DropdownItem to="/join">List Business</DropdownItem>
              <DropdownItem to="/developer">API Docs</DropdownItem>
              <DropdownItem to="/trust">Trust Layer</DropdownItem>
            </Dropdown>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(true)} className="md:hidden w-9 h-9 rounded-full bg-surface-container-low text-on-surface flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            {isAuthenticated ? (
              <Dropdown label={initials} current={false}>
                <DropdownItem to="/dashboard">Dashboard</DropdownItem>
                <DropdownItem to="/wallet">Wallet</DropdownItem>
                <DropdownItem to="/profile">Profile</DropdownItem>
                <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container/20 transition-colors">Log Out</button>
              </Dropdown>
            ) : (
              <div className="hidden md:flex gap-2">
                <Link to="/login" className="text-sm font-medium px-3 py-1.5 text-on-surface-variant hover:text-primary transition-colors">Sign In</Link>
                <Link to="/register" className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-sm font-bold">Sign Up</Link>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="flex-grow">
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
            <button onClick={() => setSearchOpen(true)} className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all ${'text-on-surface-variant hover:text-primary active:scale-95'}`}>
              <span className="material-symbols-outlined text-[22px]">search</span>
              <span className="font-body text-[10px] font-semibold tracking-wide">Search</span>
            </button>
            <MobileTab
              to={isOwnerOrAdmin ? '/dashboard' : '/reservations'}
              icon={isOwnerOrAdmin ? 'dashboard' : 'calendar_month'}
              label={isOwnerOrAdmin ? 'Dashboard' : 'Bookings'}
              current={location.pathname === '/dashboard' || location.pathname.startsWith('/reservations')}
            />
            <MobileTab to="/profile" icon="person" label="Profile" current={location.pathname === '/profile'} />
          </div>
        </nav>
      )}

      {searchOpen && <SearchSheet onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
