import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)' }}>

      {!isAuthPage && (
        <nav style={{
          background: scrolled ? 'rgba(5,9,21,0.92)' : 'rgba(5,9,21,0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${scrolled ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
          boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.5), 0 0 60px rgba(108,99,255,0.05)' : 'none',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'all 0.3s ease',
        }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">

              {/* Logo */}
              <div className="flex items-center gap-8">
                <Link to="/" className="flex items-center gap-2.5 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black relative"
                    style={{
                      background: 'linear-gradient(135deg, #6C63FF, #9C6FFF)',
                      boxShadow: '0 0 16px rgba(108,99,255,0.5)',
                      transition: 'box-shadow 0.3s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 30px rgba(108,99,255,0.8)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 16px rgba(108,99,255,0.5)')}
                  >
                    P
                    {/* Pulse ring */}
                    <span style={{
                      position: 'absolute', inset: '-3px', borderRadius: '10px',
                      border: '1px solid rgba(108,99,255,0.4)',
                      animation: 'pulseGlow 2.5s ease-in-out infinite',
                      pointerEvents: 'none',
                    }} />
                  </div>
                  <span className="text-lg font-black tracking-tight" style={{ color: '#e8eef8' }}>
                    Pabandi
                  </span>
                </Link>

                <div className="hidden sm:flex items-center gap-1">
                  <NavLink to="/" active={location.pathname === '/'}>Home</NavLink>
                  {isAuthenticated && (
                    <>
                      <NavLink to="/reservations" active={location.pathname.startsWith('/reservations')}>Reservations</NavLink>
                      <NavLink to="/dashboard" active={location.pathname === '/dashboard'}>Dashboard</NavLink>
                      <NavLink to="/wallet" active={location.pathname === '/wallet'}>Wallet</NavLink>
                    </>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="hidden sm:flex items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <Link to="/profile"
                      className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-xl transition-all duration-200"
                      style={{
                        color: '#a0b4c8',
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(108,99,255,0.4)';
                        (e.currentTarget as HTMLElement).style.background = 'rgba(108,99,255,0.08)';
                        (e.currentTarget as HTMLElement).style.color = '#e8eef8';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                        (e.currentTarget as HTMLElement).style.color = '#a0b4c8';
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6C63FF, #00E5FF)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#fff',
                        boxShadow: '0 0 10px rgba(108,99,255,0.5)',
                      }}>
                        {initials}
                      </div>
                      {user?.firstName}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200"
                      style={{ color: '#6b7fa3', border: '1px solid rgba(255,255,255,0.06)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.color = '#ff4c6a';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,76,106,0.35)';
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,76,106,0.08)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.color = '#6b7fa3';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      style={{ color: '#6b7fa3' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e8eef8')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#6b7fa3')}>
                      Sign In
                    </Link>
                    <Link to="/register" className="btn-primary text-sm px-5 py-2.5">
                      Sign Up Free
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                className="sm:hidden p-2 rounded-xl"
                style={{ color: '#6b7fa3', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '0.75rem 1rem 1rem',
              background: 'rgba(5,9,21,0.95)',
              animation: 'fadeInUp 0.2s ease',
            }}>
              {isAuthenticated ? (
                <div className="flex flex-col gap-1">
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl"
                    style={{ color: '#a0b4c8', background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.15)' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6C63FF, #00E5FF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: '#fff',
                    }}>{initials}</div>
                    {user?.firstName} {user?.lastName}
                  </Link>
                  <MobileNavLink to="/reservations" onClick={() => setMobileMenuOpen(false)}>Reservations</MobileNavLink>
                  <MobileNavLink to="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</MobileNavLink>
                  <MobileNavLink to="/wallet" onClick={() => setMobileMenuOpen(false)}>Wallet</MobileNavLink>
                  <button onClick={handleLogout}
                    className="text-left px-4 py-2.5 text-sm rounded-xl mt-1 transition-all"
                    style={{ color: '#ff4c6a', background: 'rgba(255,76,106,0.08)', border: '1px solid rgba(255,76,106,0.15)' }}>
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link to="/login" className="block px-4 py-2.5 text-sm rounded-xl"
                    style={{ color: '#a0b4c8', background: 'rgba(255,255,255,0.03)' }} onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-primary text-sm text-center"
                    onClick={() => setMobileMenuOpen(false)}>
                    Sign Up Free
                  </Link>
                </div>
              )}
            </div>
          )}
        </nav>
      )}

      <main>
        <Outlet />
      </main>

      {!isAuthPage && (
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '4rem' }}>
          <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                  style={{ background: 'linear-gradient(135deg, #6C63FF, #9C6FFF)', boxShadow: '0 0 12px rgba(108,99,255,0.4)' }}>P</div>
                <span className="font-black" style={{ color: '#e8eef8' }}>Pabandi</span>
              </div>
              <p className="text-sm" style={{ color: '#2d3f58' }}>
                © 2026 Pabandi. AI-powered bookings with smart no-show prevention.
              </p>
              <div className="flex gap-5 text-sm" style={{ color: '#2d3f58' }}>
                <a href="#" className="hover:text-[#6C63FF] transition-colors">Privacy</a>
                <a href="#" className="hover:text-[#6C63FF] transition-colors">Terms</a>
                <a href="#" className="hover:text-[#6C63FF] transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function NavLink({ to, children, active }: { to: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link to={to} className="text-sm font-medium px-3 py-2 rounded-lg transition-all duration-200 relative"
      style={{
        color: active ? '#a5b4fc' : '#6b7fa3',
        background: active ? 'rgba(108,99,255,0.1)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#e8eef8';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#6b7fa3';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}>
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick}
      className="block px-4 py-2.5 text-sm rounded-xl transition-all"
      style={{ color: '#a0b4c8', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
      {children}
    </Link>
  );
}
