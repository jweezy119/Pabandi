import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

import { FiCalendar, FiStar, FiHeart, FiCreditCard, FiSettings, FiLogOut, FiMenu, FiX, FiHome, FiSearch, FiBuilding2 } from 'react-icons/fi';

const navigation = [
  { path: '/booking', label: 'Discover', icon: FiSearch, roles: [] },
  { path: '/booking/my-reservations', label: 'My Reservations', icon: FiCalendar, roles: ['USER', 'ADMIN'] },
  { path: '/booking/favorites', label: 'Favorites', icon: FiHeart, roles: ['USER', 'ADMIN'] },
  { path: '/booking/venues', label: 'My Venues', icon: FiBuilding2, roles: ['BUSINESS_OWNER', 'ADMIN'] },
  { path: '/booking/analytics', label: 'Analytics', icon: FiStar, roles: ['BUSINESS_OWNER', 'ADMIN'] },
  { path: '/booking/payments', label: 'Payments', icon: FiCreditCard, roles: ['USER', 'ADMIN'] },
  { path: '/booking/settings', label: 'Settings', icon: FiSettings, roles: [] },
];

export const BookingLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole = user?.role || 'USER';
  const filteredNav = navigation.filter(item => 
    item.roles.length === 0 || item.roles.includes(userRole)
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#020617] flex">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`fixed lg:static z-50 w-64 h-screen bg-[#0a0f1a] border-r border-white/5 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">B</div>
            <div>
              <h1 className="text-xl font-bold text-white">BookingOS</h1>
              <p className="text-xs text-slate-400">by Pabandi</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400"
            aria-label="Close sidebar"
          >
            <FiX size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="BookingOS navigation">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/booking' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all $
                  {isActive 
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-400/20' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'}
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} className="flex-shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-sm font-bold">
              {user?.firstName?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/booking/settings')}
              className="flex-1 px-3 py-2 text-left bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-sm"
            >
              <FiSettings className="w-4 h-4 mr-2" aria-hidden="true" />
              Account
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 px-3 py-2 text-left bg-white/5 text-rose-300 rounded-xl hover:bg-rose-500/10 hover:text-rose-200 transition-colors text-sm"
            >
              <FiLogOut className="w-4 h-4 mr-2" aria-hidden="true" />
              Sign Out
            </button>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full px-3 py-2 text-left bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-sm"
          >
            <FiHome className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to Pabandi
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 lg:ml-0">
        <header className="sticky top-0 z-30 bg-[#0a0f1a]/80 backdrop-blur-sm border-b border-white/5 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-300"
              aria-label="Open menu"
            >
              <FiMenu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">B</div>
              <span className="font-bold text-white">BookingOS</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-sm font-bold">
              {user?.firstName?.[0] || '?'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BookingLayout;