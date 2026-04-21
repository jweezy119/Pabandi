import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Hide header/footer on auth pages for a clean auth experience
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)' }}>

      {!isAuthPage && (
        <nav style={{
          background: 'rgba(8,14,23,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">

              {/* Logo */}
              <div className="flex items-center gap-8">
                <Link to="/" className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 2px 10px rgba(37,99,235,0.4)' }}>
                    P
                  </div>
                  <span className="text-lg font-black tracking-tight" style={{ color: '#e8edf3' }}>
                    Pabandi
                  </span>
                </Link>

                <div className="hidden sm:flex items-center gap-1">
                  <NavLink to="/">Home</NavLink>
                  {isAuthenticated && (
                    <>
                      <NavLink to="/reservations">Reservations</NavLink>
                      <NavLink to="/dashboard">Dashboard</NavLink>
                      <NavLink to="/wallet">Wallet</NavLink>
                    </>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="hidden sm:flex items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <span className="text-sm font-medium" style={{ color: '#7a90a8' }}>
                      {user?.firstName} {user?.lastName}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      style={{ color: '#7a90a8' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e8edf3')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#7a90a8')}>
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
                className="sm:hidden p-2 rounded-lg"
                style={{ color: '#7a90a8', background: 'rgba(255,255,255,0.05)' }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.75rem 1rem 1rem' }}>
              {isAuthenticated ? (
                <div className="flex flex-col gap-1">
                  <MobileNavLink to="/reservations" onClick={() => setMobileMenuOpen(false)}>Reservations</MobileNavLink>
                  <MobileNavLink to="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</MobileNavLink>
                  <MobileNavLink to="/wallet" onClick={() => setMobileMenuOpen(false)}>Wallet</MobileNavLink>
                  <button onClick={handleLogout}
                    className="text-left px-4 py-2.5 text-sm rounded-lg mt-1"
                    style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link to="/login" className="block px-4 py-2.5 text-sm rounded-lg"
                    style={{ color: '#a0b4c8' }} onClick={() => setMobileMenuOpen(false)}>
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
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4rem' }}>
          <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>P</div>
                <span className="font-bold" style={{ color: '#e8edf3' }}>Pabandi</span>
              </div>
              <p className="text-sm" style={{ color: '#3d5068' }}>
                © 2025 Pabandi. AI-powered bookings with smart no-show prevention.
              </p>
              <div className="flex gap-5 text-sm" style={{ color: '#3d5068' }}>
                <a href="#" className="hover:text-[#a0b4c8] transition-colors">Privacy</a>
                <a href="#" className="hover:text-[#a0b4c8] transition-colors">Terms</a>
                <a href="#" className="hover:text-[#a0b4c8] transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      style={{ color: '#7a90a8' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = '#e8edf3';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = '#7a90a8';
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}>
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick}
      className="block px-4 py-2.5 text-sm rounded-lg transition-colors"
      style={{ color: '#a0b4c8', background: 'rgba(255,255,255,0.03)' }}>
      {children}
    </Link>
  );
}
