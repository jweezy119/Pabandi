import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { id: 'home', label: 'Home', href: '/app', icon: '🏠' },
  { id: 'discover', label: 'Discover', href: '/app/discover', icon: '🔍' },
  { id: 'passport', label: 'Passport', href: '/app/passport', icon: '◈' },
  { id: 'settings', label: 'Settings', href: '/app/settings', icon: '⚙️' },
];

export default function ConsumerBottomNav() {
  const [activeTab, setActiveTab] = useState('home');
  const location = useLocation();

  // Sync active tab from URL
  const tabFromPath = TABS.find(t => location.pathname === t.href || location.pathname.startsWith(t.href));
  if (tabFromPath) setActiveTab(tabFromPath.id);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-amber-200 shadow-lg z-50">
      <div className="flex justify-around items-center h-full px-2">
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
                <span className={'text-lg ' + (isActive ? 'text-amber-500' : 'text-amber-600')}>
                  {tab.icon}
                </span>
                <span
                  className={'text-xs font-bold ' + (isActive ? 'text-amber-500' : 'text-amber-400')}
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
