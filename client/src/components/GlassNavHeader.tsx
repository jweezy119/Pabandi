import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export interface GlassNavLink {
  label: string;
  to: string;
  isAnchor?: boolean;
}

const DEFAULT_LINKS: GlassNavLink[] = [
  { label: 'AI Agents', to: '/agents' },
  { label: 'Developers', to: '/developers' },
  { label: 'Verify Trust', to: '/verify-trust' },
  { label: 'Businesses', to: '/contact' },
  { label: 'Pricing', to: '/pricing' },
];

export function GlassNavHeader({ links = DEFAULT_LINKS }: { links?: GlassNavLink[] }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close drawer on route change & lock body scroll when open
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isActive = (path: string) =>
    !path.startsWith('#') && (location.pathname === path || location.pathname.startsWith(path + '/'));

  return (
    <>
      <header className={`pg-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="pg-container pg-nav-inner">
          <Link to="/" className="pg-logo" aria-label="Pabandi home">
            <span className="pg-logo-mark">◈</span>
            <span>Pabandi</span>
          </Link>

          <nav className="pg-nav-links" aria-label="Main">
            {links.map((l) =>
              l.isAnchor ? (
                <a key={l.label} href={l.to}>{l.label}</a>
              ) : (
                <Link key={l.label} to={l.to} className={isActive(l.to) ? 'active' : ''}>
                  {l.label}
                </Link>
              )
            )}
          </nav>

          <div className="pg-nav-actions" style={{ marginLeft: 'auto' }}>
            <Link to="/sandbox" className="pg-btn pg-btn-text">Sandbox</Link>
            {isAuthenticated ? (
              <Link to="/dashboard" className="pg-btn pg-btn-ghost">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="pg-btn pg-btn-text">Sign in</Link>
                <Link to="/signup?module=contact" className="pg-btn pg-btn-primary">Get started</Link>
              </>
            )}
            <button
              type="button"
              className="pg-menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Frosted Glass Drawer */}
      {menuOpen && (
        <>
          <div className="pg-mobile-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="pg-mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation">
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--pg-line)' }}>
              <Link to="/" className="pg-logo" onClick={() => setMenuOpen(false)}>
                <span className="pg-logo-mark">◈</span>
                <span>Pabandi</span>
              </Link>
              <button
                type="button"
                className="pg-menu-btn"
                style={{ display: 'inline-flex' }}
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="pg-mobile-drawer-links" aria-label="Mobile links">
              {links.map((l) =>
                l.isAnchor ? (
                  <a key={l.label} href={l.to} onClick={() => setMenuOpen(false)}>
                    <span>{l.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-50" />
                  </a>
                ) : (
                  <Link
                    key={l.label}
                    to={l.to}
                    className={isActive(l.to) ? 'active' : ''}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>{l.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-50" />
                  </Link>
                )
              )}
              <Link to="/sandbox" onClick={() => setMenuOpen(false)}>
                <span>Interactive Sandbox</span>
                <ArrowRight className="w-4 h-4 opacity-50" />
              </Link>
              <Link to="/developers" onClick={() => setMenuOpen(false)}>
                <span>API &amp; MCP Docs</span>
                <ArrowRight className="w-4 h-4 opacity-50" />
              </Link>
            </nav>

            <div className="mt-auto pt-6 flex flex-col gap-2.5">
              {isAuthenticated ? (
                <Link to="/dashboard" className="pg-btn pg-btn-primary w-full" onClick={() => setMenuOpen(false)}>
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/signup?module=contact" className="pg-btn pg-btn-primary w-full" onClick={() => setMenuOpen(false)}>
                    Start free pilot
                  </Link>
                  <Link to="/login" className="pg-btn pg-btn-ghost w-full" onClick={() => setMenuOpen(false)}>
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default GlassNavHeader;
