// Sitara OS — Operator Layout
// Nav is driven by business type (see utils/operatorProfile) — a salon sees
// Appointments + Clients, a rental sees Units + Tenants, never mixed.

import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSitaraStore } from '../../store/sitaraStore';
import { sitaraApi } from '../../api/sitaraApi';
import { profileForCategory, OperatorProfile } from '../../utils/operatorProfile';
import SitaraLogo from '../../components/SitaraLogo';

export default function OperatorLayout() {
  const location = useLocation();
  const { user } = useSitaraStore();
  const [profile, setProfile] = useState<OperatorProfile>(profileForCategory(null));

  useEffect(() => {
    let cancelled = false;
    sitaraApi
      .myBusiness()
      .then((biz) => {
        if (!cancelled && biz?.category) setProfile(profileForCategory(biz.category));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <SitaraLogo size={32} />
            <span className="font-bold text-xl">Sitara</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{profile.title}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {profile.nav.map((item) => {
            const isActive =
              item.path === '/sitara/operator'
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {user?.name.charAt(0).toUpperCase() || 'O'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Operator'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
