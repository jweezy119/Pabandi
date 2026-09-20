import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/tenant-portal', label: 'Dashboard', icon: 'grid_view', end: true },
  { to: '/tenant-portal/pay-rent', label: 'Pay Rent', icon: 'payments' },
  { to: '/tenant-portal/maintenance', label: 'Maintenance', icon: 'build' },
  { to: '/tenant-portal/lease', label: 'Lease', icon: 'description' },
  { to: '/tenant-portal/staking', label: 'Staking', icon: 'account_balance' },
  { to: '/tenant-portal/history', label: 'History', icon: 'history' },
];

export default function TenantLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex" style={{ background: '#020617' }}>
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 bg-[#0f172a]/80 backdrop-blur-xl">
        <div className="p-6 border-b border-white/5">
          <Link to="/tenant-portal" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
              P
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">Pabandi</div>
              <div className="text-xs text-slate-500">Tenant Portal</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-purple-500/10 border border-emerald-500/20 p-4">
            <div className="text-xs text-slate-400 mb-1">Need help?</div>
            <div className="text-sm text-white font-medium">Contact Support</div>
            <div className="text-xs text-emerald-400 mt-1">support@pabandi.com</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar - Mobile */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#0f172a]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                P
              </div>
              <span className="text-white font-bold">Pabandi</span>
            </div>
            <MobileMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function MobileMenu() {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden p-2 rounded-lg bg-white/5 text-white"
      >
        <span className="material-symbols-outlined">{open ? 'close' : 'menu'}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-[#0f172a] border-l border-white/10 p-6">
            <div className="flex items-center justify-between mb-8">
              <span className="text-white font-bold text-lg">Menu</span>
              <button onClick={() => setOpen(false)} className="text-slate-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <nav className="space-y-2">
              {NAV.map((item) => {
                const active = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
