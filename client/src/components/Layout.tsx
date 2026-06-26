import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import PageTransition from './PageTransition';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState, useRef } from 'react';

function DesktopNavLink({ to, children, current }: { to: string; children: React.ReactNode; current: boolean }) {
  return (
    <Link to={to} className={`font-body text-sm transition-colors ${current ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}>
      {children}
    </Link>
  );
}

function Dropdown({ label, children, current }: { label: string; children: React.ReactNode; current: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`font-body text-sm transition-colors flex items-center gap-1 ${current ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
      >
        {label}
        <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 bg-surface-bright border border-outline-variant/20 rounded-xl shadow-xl py-2 min-w-[180px] z-40">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function DropdownItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block px-4 py-2 text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors">
      {children}
    </Link>
  );
}

function MobileTab({ to, icon, label, current }: { to: string; icon: string; label: string; current: boolean }) {
  if (current) {
    return (
      <Link to={to} className="flex flex-col items-center justify-center text-primary bg-surface-container-low rounded-xl px-4 py-2">
        <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <span className="font-body text-[11px] font-medium tracking-wide">{label}</span>
      </Link>
    );
  }
  return (
    <Link to={to} className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-4 py-2 transition-colors">
      <span className="material-symbols-outlined mb-1">{icon}</span>
      <span className="font-body text-[11px] font-medium tracking-wide">{label}</span>
    </Link>
  );
}

function MobileTabLoyalty({ to, current, label }: { to: string; current: boolean, label: string }) {
  return (
    <Link to={to} onClick={() => { setTimeout(() => { const el = document.querySelector('[data-tab="loyalty"]') as HTMLButtonElement; el?.click(); }, 100); }}
      className={`flex flex-col items-center justify-center px-3 py-2 transition-colors relative ${
        current ? 'text-[#D97706]' : 'text-on-surface-variant hover:text-[#D97706]'
      }`}
    >
      <span className="text-lg leading-none mb-1">🏆</span>
      <span className="font-body text-[10px] font-bold tracking-wide">{label}</span>
      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D97706] shadow-sm" style={{ boxShadow: '0 0 6px rgba(217,119,6,0.6)' }} />
    </Link>
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

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '';

  return (
    <div className="bg-surface text-on-surface font-body antialiased min-h-screen flex flex-col pt-16">
      
      {!isAuthPage && (
        <header className="bg-surface-bright/70 backdrop-blur-md flex justify-between items-center w-full px-4 md:px-6 py-3 fixed top-0 z-40 shadow-sm border-b border-outline-variant/10 transition-all duration-300">
          <div className="flex items-center gap-2 md:gap-3">
            {isAuthenticated ? (
              <Link to="/profile" className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden bg-surface-container-highest flex items-center justify-center text-primary font-bold text-xs md:text-sm shrink-0">
                {initials}
              </Link>
            ) : (
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">person</span>
              </div>
            )}
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-company.jpg" alt="Pabandi" className="h-7 md:h-8 w-auto mix-blend-screen" />
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-5 font-headline text-sm">
              <DesktopNavLink to="/" current={location.pathname === '/'}>Home</DesktopNavLink>
              <DesktopNavLink to="/pricing" current={location.pathname === '/pricing'}>Plans</DesktopNavLink>
              <Dropdown label="Products" current={['/technology','/web3','/hospitality'].includes(location.pathname)}>
                <DropdownItem to="/technology">Technology</DropdownItem>
                <DropdownItem to="/web3">Web3</DropdownItem>
                <DropdownItem to="/hospitality">Hospitality</DropdownItem>
              </Dropdown>
              <Dropdown label="For Business" current={['/join','/developer','/trust'].includes(location.pathname)}>
                <DropdownItem to="/join">List Business</DropdownItem>
                <DropdownItem to="/developer">API Docs</DropdownItem>
                <DropdownItem to="/trust">Trust Layer</DropdownItem>
              </Dropdown>
            </div>

          <div className="flex items-center gap-2 md:gap-3">
            {isAuthenticated ? (
              <Dropdown label={initials} current={false}>
                <DropdownItem to="/dashboard">Dashboard</DropdownItem>
                <DropdownItem to="/wallet">Wallet</DropdownItem>
                <DropdownItem to="/profile">Profile</DropdownItem>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container/20 transition-colors"
                >
                  Log Out
                </button>
              </Dropdown>
            ) : (
              <div className="hidden md:flex gap-2">
                <Link to="/login" className="text-sm font-medium px-3 py-1.5 text-on-surface-variant hover:text-primary transition-colors">Sign In</Link>
                <Link to="/register" className="btn-primary py-1.5 px-3 text-sm">Sign Up</Link>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="flex-grow pt-[60px] md:pt-[72px]">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      {!isAuthPage && !isDetailScreen && (
        <>
          <nav className="bg-white/90 backdrop-blur-xl fixed bottom-0 w-full z-50 rounded-t-2xl shadow-[0_-10px_30px_rgba(1,29,53,0.06)] transition-all duration-300 ease-out flex justify-around items-center px-2 pb-5 pt-3 md:hidden mobile-bottom-nav">
            <MobileTab to="/" icon="explore" label="Explore" current={location.pathname === '/'} />
            <MobileTab 
              to={user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN' ? '/dashboard' : '/reservations'} 
              icon={user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN' ? 'dashboard' : 'calendar_month'} 
              label={user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN' ? 'Dashboard' : 'Bookings'} 
              current={location.pathname === '/dashboard' || location.pathname.startsWith('/reservations')} 
            />
            <MobileTab to="/wallet" icon="payments" label="Wallet" current={location.pathname === '/wallet'} />
            <MobileTabLoyalty to="/profile" label="Loyalty" current={location.pathname === '/profile'} />
          </nav>
        </>
      )}
      
      {!isAuthPage && (
        <footer className="hidden md:block mt-8 py-6 border-t border-outline-variant/20 bg-surface-container-lowest">
          <div className="max-w-7xl mx-auto px-6 flex flex-col gap-3">
            <div className="text-center text-sm text-on-surface-variant flex flex-wrap justify-center items-center gap-x-4 gap-y-1">
              <span>© 2026 Pabandi Global</span>
              <span className="text-outline">·</span>
              <Link to="/pricing" className="hover:text-primary transition-colors font-bold text-primary">Pricing</Link>
              <Link to="/technology" className="hover:text-primary transition-colors">Technology</Link>
              <Link to="/web3" className="hover:text-primary transition-colors">Web3</Link>
              <Link to="/hospitality" className="hover:text-primary transition-colors font-semibold" style={{ color: '#10b981' }}>🏨 Hospitality</Link>
              <Link to="/join" className="hover:text-primary transition-colors">For Businesses</Link>
              <Link to="/developer" className="hover:text-primary transition-colors font-semibold" style={{ color: '#818cf8' }}>API Docs</Link>
              <Link to="/trust" className="hover:text-primary transition-colors font-semibold" style={{ color: '#1DBF73' }}>Trust Layer</Link>
              <Link to="/profile#loyalty" className="hover:text-primary transition-colors font-semibold" style={{ color: '#D97706' }}>🏆 Loyalty</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link to="/contact" className="hover:text-primary transition-colors font-medium">Contact</Link>
            </div>
            <div className="text-center text-xs text-on-surface-variant/70 border-t border-outline-variant/10 pt-3 mt-1">
              <p className="mb-1 font-mono text-[10px]">$PAB Token Contract (Solana Mainnet): <span className="text-primary font-bold">Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ</span></p>
              <p>Trading exclusively on Raydium. Never send funds to unverified addresses.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
