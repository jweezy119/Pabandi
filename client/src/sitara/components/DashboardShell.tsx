// Sitara OS — shared dashboard shell (operator + tenant)
// Desktop: sidebar. Mobile: top bar + bottom tab bar with real tap targets.
import { Outlet, Link, useLocation } from 'react-router-dom';
import SitaraLogo from './SitaraLogo';
import TextSizeToggle from './TextSizeToggle';

export interface ShellNavItem {
  path: string;
  label: string;
  icon: string;
}

interface Props {
  title: string;
  nav: ShellNavItem[];
  footerTitle: string;
  footerSub: string;
  avatarLetter: string;
}

export default function DashboardShell({ title, nav, footerTitle, footerSub, avatarLetter }: Props) {
  const location = useLocation();
  const isActive = (path: string) =>
    path.endsWith('/operator') || path.endsWith('/tenant')
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <SitaraLogo size={32} />
            <span className="font-bold text-xl">Sitara</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{title}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                isActive(item.path)
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">{avatarLetter}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{footerTitle}</p>
              <p className="text-xs text-slate-400 truncate">{footerSub}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 flex items-center gap-2 safe-area-pb">
        <SitaraLogo size={28} />
        <span className="font-bold text-lg">Sitara</span>
        <span className="text-xs text-slate-400 ml-1 truncate flex-1">{title}</span>
        <TextSizeToggle dark />
      </div>

      {/* Main content (bottom padding clears the tab bar) */}
      <main className="flex-1 p-4 sm:p-8 pb-24 lg:pb-8 overflow-auto">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="tabbar lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800 safe-area-bottom">
        <div className="flex overflow-x-auto no-scrollbar mobile-scroll">
          {nav.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-medium min-w-[64px] ${
                  active ? 'text-amber-400' : 'text-slate-400 active:text-white'
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="truncate max-w-full">{item.label}</span>
                {active && <span className="w-8 h-0.5 bg-amber-400 rounded-full mt-0.5" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
