// Sitara OS — Tenant Layout
// Layout for tenant/guest portal pages

import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSitaraStore } from '../../store/sitaraStore';

const tenantNav = [
  { path: '/sitara/tenant', label: 'Dashboard', icon: '🏠' },
  { path: '/sitara/tenant/lease', label: 'My Lease', icon: '📄' },
  { path: '/sitara/tenant/payments', label: 'Payments', icon: '💳' },
  { path: '/sitara/tenant/maintenance', label: 'Maintenance', icon: '🔧' },
];

export default function TenantLayout() {
  const location = useLocation();
  const { user } = useSitaraStore();

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">★</span>
            </div>
            <span className="font-bold text-xl">Sitara</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Tenant Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tenantNav.map((item) => {
            const isActive = location.pathname === item.path;
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
                {user?.name.charAt(0).toUpperCase() || 'T'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Tenant'}</p>
              <p className="text-xs text-amber-400 truncate">★ {user?.starPower || 0} Star Power</p>
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
