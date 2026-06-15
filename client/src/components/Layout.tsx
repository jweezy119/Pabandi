import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect } from 'react';

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
  // Some detail screens should hide bottom nav
  const isDetailScreen = location.pathname.includes('/book') || location.pathname.includes('/new');

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '';

  return (
    <div className="bg-surface text-on-surface font-body antialiased min-h-screen flex flex-col pt-20">
      
      {!isAuthPage && (
        <header className="bg-surface-bright flex justify-between items-center w-full px-6 py-4 fixed top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/profile" className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-highest flex items-center justify-center text-primary font-bold text-sm">
                {initials}
              </Link>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined">person</span>
              </div>
            )}
            <Link to="/">
              <h1 className="font-headline font-semibold text-2xl tracking-tighter text-primary">Pabandi</h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="text-primary hover:opacity-80 transition-opacity w-10 h-10 flex items-center justify-center bg-surface-container-low rounded-full">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            {isAuthenticated && (
              <button onClick={handleLogout} className="hidden md:flex text-sm text-error bg-error-container/20 px-4 py-2 rounded-md hover:bg-error-container/40">
                Logout
              </button>
            )}
            {!isAuthenticated && (
              <div className="hidden md:flex gap-2">
                <Link to="/login" className="text-sm font-medium px-4 py-2 text-on-surface-variant hover:text-primary transition-colors">Sign In</Link>
                <Link to="/register" className="btn-primary py-2 px-4 text-sm">Sign Up</Link>
              </div>
            )}
          </div>

          {/* Desktop Navigation Cluster (Visible only on md+) */}
          <div className="hidden md:flex absolute top-0 left-1/2 -translate-x-1/2 h-[72px] items-center gap-8">
            <DesktopNavLink to="/" current={location.pathname === '/'}>Explore</DesktopNavLink>
            <DesktopNavLink to="/technology" current={location.pathname === '/technology'}>Technology</DesktopNavLink>
            <DesktopNavLink to="/join" current={location.pathname === '/join'}>For Businesses</DesktopNavLink>
            <DesktopNavLink to="/developer" current={location.pathname === '/developer'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                API
                <span style={{ fontSize: '9px', fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.05em' }}>NEW</span>
              </span>
            </DesktopNavLink>
            <DesktopNavLink to="/trust" current={location.pathname === '/trust'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                Trust
                <span style={{ fontSize: '9px', fontWeight: 800, background: 'linear-gradient(135deg, #0A66C2, #1DBF73)', color: '#fff', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.05em' }}>NEW</span>
              </span>
            </DesktopNavLink>
            {isAuthenticated && (
              <>
                <DesktopNavLink to={user?.role === 'BUSINESS_OWNER' ? '/dashboard' : '/reservations'} current={location.pathname === '/dashboard' || location.pathname.startsWith('/reservations')}>
                  {user?.role === 'BUSINESS_OWNER' ? 'Dashboard' : 'Bookings'}
                </DesktopNavLink>
                {user?.role === 'BUSINESS_OWNER' && (
                  <DesktopNavLink to="/business/crm" current={location.pathname === '/business/crm'}>
                    CRM
                  </DesktopNavLink>
                )}
                <DesktopNavLink to="/wallet" current={location.pathname === '/wallet'}>Wallet</DesktopNavLink>
                <DesktopNavLink to="/profile" current={location.pathname === '/profile' || location.pathname === '/loyalty'}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    Profile
                    <span style={{ fontSize: '9px', fontWeight: 800, background: 'linear-gradient(135deg, #CD7F32, #D97706)', color: '#fff', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.05em' }}>🏆</span>
                  </span>
                </DesktopNavLink>
              </>
            )}
          </div>
        </header>
      )}

      <main className="flex-grow w-full">
        <Outlet />
      </main>

      {!isAuthPage && !isDetailScreen && (
        <>
          {/* BottomNavBar Shared Component */}
          <nav className="bg-white/90 backdrop-blur-xl fixed bottom-0 w-full z-50 rounded-t-2xl shadow-[0_-10px_30px_rgba(1,29,53,0.06)] transition-all duration-300 ease-out flex justify-around items-center px-4 pb-6 pt-3 md:hidden">
            <MobileTab to="/" icon="explore" label="Explore" current={location.pathname === '/'} />
            {user?.role === 'BUSINESS_OWNER' && (
              <MobileTab to="/business/crm" icon="groups" label="CRM" current={location.pathname === '/business/crm'} />
            )}
            <MobileTab 
              to={user?.role === 'BUSINESS_OWNER' ? '/dashboard' : '/reservations'} 
              icon={user?.role === 'BUSINESS_OWNER' ? 'dashboard' : 'calendar_month'} 
              label={user?.role === 'BUSINESS_OWNER' ? 'Dashboard' : 'Bookings'} 
              current={location.pathname === '/dashboard' || location.pathname.startsWith('/reservations')} 
            />
            <MobileTab to="/wallet" icon="payments" label="Wallet" current={location.pathname === '/wallet'} />
            <MobileTabLoyalty to="/profile" current={location.pathname === '/profile'} />
            <MobileTab to="/profile" icon="person" label="Profile" current={location.pathname === '/profile'} />
          </nav>
        </>
      )}
      
      {!isAuthPage && (
        <footer className="hidden md:block mt-16 py-8 border-t border-outline-variant/20 bg-surface-container-lowest">
          <div className="max-w-7xl mx-auto px-6 text-center text-sm text-on-surface-variant flex justify-between items-center">
            <span>© 2026 Pabandi. AI-powered bookings.</span>
            <div className="flex gap-4 flex-wrap justify-center">
              <Link to="/technology" className="hover:text-primary transition-colors">Technology</Link>
              <Link to="/join" className="hover:text-primary transition-colors">For Businesses</Link>
              <Link to="/developer" className="hover:text-primary transition-colors font-semibold" style={{ color: '#818cf8' }}>API Docs</Link>
              <Link to="/trust" className="hover:text-primary transition-colors font-semibold" style={{ color: '#1DBF73' }}>Trust Layer</Link>
              <Link to="/profile#loyalty" className="hover:text-primary transition-colors font-semibold" style={{ color: '#D97706' }}>🏆 Loyalty</Link>
              <Link to="/contact" className="hover:text-primary transition-colors font-medium">Contact Us</Link>
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function DesktopNavLink({ to, children, current }: { to: string; children: React.ReactNode; current: boolean }) {
  return (
    <Link to={to} className={`font-body text-sm transition-colors ${current ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}>
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

/** Special Loyalty tab indicator with golden badge dot */
function MobileTabLoyalty({ to, current }: { to: string; current: boolean }) {
  return (
    <Link to={to} onClick={() => { setTimeout(() => { const el = document.querySelector('[data-tab="loyalty"]') as HTMLButtonElement; el?.click(); }, 100); }}
      className={`flex flex-col items-center justify-center px-3 py-2 transition-colors relative ${
        current ? 'text-[#D97706]' : 'text-on-surface-variant hover:text-[#D97706]'
      }`}
    >
      <span className="text-lg leading-none mb-1">🏆</span>
      <span className="font-body text-[10px] font-bold tracking-wide">Loyalty</span>
      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D97706] shadow-sm" style={{ boxShadow: '0 0 6px rgba(217,119,6,0.6)' }} />
    </Link>
  );
}
