// Sitara OS — Header
// Branded navigation with star power indicator

import { Link } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';
import SitaraLogo from './SitaraLogo';
import TextSizeToggle from './TextSizeToggle';

export default function SitaraHeader() {
  const { user } = useSitaraStore();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/sitara" className="flex items-center gap-2">
            <SitaraLogo size={32} />
            <span className="font-bold text-xl text-slate-900">Sitara</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/sitara" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Discover
            </Link>
            <Link to="/sitara/my-bookings" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              My Bookings
            </Link>
            <Link to="/sitara/star-card" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Star Card
            </Link>
            <Link to="/sitara/promos" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Promos
            </Link>
            <Link to="/sitara/promoter" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Promote
            </Link>
          </nav>

          {/* User / Star Power */}
          <div className="flex items-center gap-2 sm:gap-4">
            <TextSizeToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-amber-600 font-medium">
                    ★ {user.starPower} · {user.starTier}
                  </p>
                </div>
                <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
      {/* Mobile nav — swipeable, thumb-reachable */}
      <nav className="md:hidden border-t border-slate-100">
        <div className="flex overflow-x-auto no-scrollbar mobile-scroll px-4 py-2 gap-2">
          {[
            { to: '/sitara', label: '🔍 Discover' },
            { to: '/sitara/my-bookings', label: '📅 Bookings' },
            { to: '/sitara/promos', label: '🎁 Promos' },
            { to: '/sitara/star-card', label: '⭐ Star Card' },
            { to: '/sitara/promoter', label: '📣 Promote' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="shrink-0 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-full active:bg-amber-100 active:text-amber-800"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
