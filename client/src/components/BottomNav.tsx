import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, CreditCard, Settings } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'Home', href: '/app', icon: <Home size={20} /> },
  { id: 'discover', label: 'Discover', href: '/app/discover', icon: <Search size={20} /> },
  { id: 'passport', label: 'Passport', href: '/app/passport', icon: <CreditCard size={20} /> },
  { id: 'settings', label: 'Settings', href: '/app/settings', icon: <Settings size={20} /> },
];

export default function BottomNav() {
  const [activeTab, setActiveTab] = useState('home');
  const location = useLocation();

  // Sync active tab from URL
  const tabFromPath = TABS.find((t) => location.pathname === t.href || location.pathname.startsWith(t.href));
  if (tabFromPath) setActiveTab(tabFromPath.id);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-amber-200 shadow-lg z-50 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex justify-around items-center h-full px-4 pt-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-1 p-2 transition-colors"
            >
              <Link
                to={tab.href}
                className="block text-center"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(tab.id);
                }}
              >
                {tab.icon}
                <span
                  className={`text-xs font-bold ${isActive ? 'text-amber-500' : 'text-amber-400'}`}
                >
                  {tab.label}
                </span>
              </Link>
            </button>
          );
        })}
      </div>
    </div>
  );
}
