import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Layout() {
  const { isAuthenticated, user, logout, fetchWalletData } = useAuthStore();
  const { language, toggleLanguage, t } = useLanguage();
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
        <header className="bg-surface-bright/70 backdrop-blur-md flex justify-between items-center w-full px-6 py-4 fixed top-0 z-40 shadow-sm border-b border-outline-variant/10 transition-all duration-300">
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
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-company.jpg" alt="Pabandi" className="h-8 w-auto mix-blend-screen" />
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); toggleLanguage(); }}
              className="font-bold text-xs bg-surface-container-high text-on-surface border border-outline-variant/50 px-3 py-1.5 rounded-full hover:bg-surface-container-highest transition-colors"
            >
              {language === 'en' ? 'EN' : 'UR'}
            </button>
            <button type="button" className="text-on-surface hover:opacity-80 transition-opacity w-10 h-10 flex items-center justify-center bg-surface-container-low rounded-full border border-outline-variant/30">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            {isAuthenticated && (
              <button onClick={handleLogout} className="hidden md:flex text-sm text-error bg-error-container/20 px-4 py-2 rounded-md hover:bg-error-container/40">
                {t('layout_logout')}
              </button>
            )}
            {!isAuthenticated && (
              <div className="hidden md:flex gap-2">
                <Link to="/login" className="text-sm font-medium px-4 py-2 text-on-surface-variant hover:text-primary transition-colors">{t('layout_sign_in')}</Link>
                <Link to="/register" className="btn-primary py-2 px-4 text-sm">{t('layout_sign_up')}</Link>
              </div>
            )}
          </div>

          {/* Desktop Navigation Cluster (Visible only on md+) */}
          <div className="hidden md:flex absolute top-0 left-1/2 -translate-x-1/2 h-[72px] items-center gap-8">
            <DesktopNavLink to="/" current={location.pathname === '/'}>{t('layout_explore')}</DesktopNavLink>
            <DesktopNavLink to="/technology" current={location.pathname === '/technology'}>{t('layout_technology')}</DesktopNavLink>
            <DesktopNavLink to="/web3" current={location.pathname === '/web3'}>{t('layout_web3')}</DesktopNavLink>
            <DesktopNavLink to="/join" current={location.pathname === '/join'}>{t('layout_for_businesses')}</DesktopNavLink>
            <DesktopNavLink to="/developer" current={location.pathname === '/developer'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                {t('layout_api_docs')}
                <span style={{ fontSize: '9px', fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.05em' }}>NEW</span>
              </span>
            </DesktopNavLink>
            <DesktopNavLink to="/trust" current={location.pathname === '/trust'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                {t('layout_trust_layer')}
                <span style={{ fontSize: '9px', fontWeight: 800, background: 'linear-gradient(135deg, #0A66C2, #1DBF73)', color: '#fff', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.05em' }}>NEW</span>
              </span>
            </DesktopNavLink>
            {isAuthenticated && (
              <>
                <DesktopNavLink to={user?.role === 'BUSINESS_OWNER' ? '/dashboard' : '/reservations'} current={location.pathname === '/dashboard' || location.pathname.startsWith('/reservations')}>
                  {user?.role === 'BUSINESS_OWNER' ? t('layout_dashboard') : t('layout_bookings')}
                </DesktopNavLink>
                {user?.role === 'BUSINESS_OWNER' && (
                  <DesktopNavLink to="/business/crm" current={location.pathname === '/business/crm'}>
                    {t('layout_crm')}
                  </DesktopNavLink>
                )}
                <DesktopNavLink to="/wallet" current={location.pathname === '/wallet'}>{t('layout_wallet')}</DesktopNavLink>
                <DesktopNavLink to="/profile" current={location.pathname === '/profile' || location.pathname === '/loyalty'}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    {t('layout_profile')}
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
            <MobileTab to="/" icon="explore" label={t('layout_explore')} current={location.pathname === '/'} />
            {user?.role === 'BUSINESS_OWNER' && (
              <MobileTab to="/business/crm" icon="groups" label={t('layout_crm')} current={location.pathname === '/business/crm'} />
            )}
            <MobileTab 
              to={user?.role === 'BUSINESS_OWNER' ? '/dashboard' : '/reservations'} 
              icon={user?.role === 'BUSINESS_OWNER' ? 'dashboard' : 'calendar_month'} 
              label={user?.role === 'BUSINESS_OWNER' ? t('layout_dashboard') : t('layout_bookings')} 
              current={location.pathname === '/dashboard' || location.pathname.startsWith('/reservations')} 
            />
            <MobileTab to="/wallet" icon="payments" label={t('layout_wallet')} current={location.pathname === '/wallet'} />
            <MobileTabLoyalty to="/profile" label={t('layout_loyalty')} current={location.pathname === '/profile'} />
            <MobileTab to="/profile" icon="person" label={t('layout_profile')} current={location.pathname === '/profile'} />
          </nav>
        </>
      )}
      
      {!isAuthPage && (
        <footer className="hidden md:block mt-16 py-8 border-t border-outline-variant/20 bg-surface-container-lowest">
          <div className="max-w-7xl mx-auto px-6 text-center text-sm text-on-surface-variant flex justify-between items-center">
            <span>{t('layout_footer_text')}</span>
            <div className="flex gap-4 flex-wrap justify-center">
              <Link to="/technology" className="hover:text-primary transition-colors">{t('layout_technology')}</Link>
              <Link to="/web3" className="hover:text-primary transition-colors">{t('layout_web3')}</Link>
              <Link to="/join" className="hover:text-primary transition-colors">{t('layout_for_businesses')}</Link>
              <Link to="/developer" className="hover:text-primary transition-colors font-semibold" style={{ color: '#818cf8' }}>{t('layout_api_docs')}</Link>
              <Link to="/trust" className="hover:text-primary transition-colors font-semibold" style={{ color: '#1DBF73' }}>{t('layout_trust_layer')}</Link>
              <Link to="/profile#loyalty" className="hover:text-primary transition-colors font-semibold" style={{ color: '#D97706' }}>🏆 {t('layout_loyalty')}</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">{t('layout_terms')}</Link>
              <Link to="/privacy" className="hover:text-primary transition-colors">{t('layout_privacy')}</Link>
              <Link to="/contact" className="hover:text-primary transition-colors font-medium">{t('layout_contact')}</Link>
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
