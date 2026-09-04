import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'guest-lists', label: 'Guest Lists', icon: '📋' },
  { id: 'events', label: 'Events', icon: '🎉' },
  { id: 'venues', label: 'Venues', icon: '🏢' },
  { id: 'payouts', label: 'Payouts', icon: '💰' },
];

export const PromoterOS: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Load dashboard stats
      const res = await fetch('/api/v1/nightlife/integrations/promoter/me/dashboard');
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">PromoterOS</h1>
          <p className="text-gray-400 mb-6">Sign in to access your promoter dashboard</p>
          <button onClick={() => navigate('/login')} className="px-6 py-3 bg-purple-600 rounded-lg font-medium hover:bg-purple-700">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center text-white font-bold text-sm">P</div>
              <span className="text-lg font-bold">PromoterOS</span>
              <span className="text-xs text-gray-500">by Pabandi</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white">
            ← Back to Pabandi
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <DashboardTab stats={stats} loading={loading} />}
        {activeTab === 'guest-lists' && <GuestListsTab />}
        {activeTab === 'events' && <EventsTab />}
        {activeTab === 'venues' && <VenuesTab />}
        {activeTab === 'payouts' && <PayoutsTab />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════
const DashboardTab: React.FC<{ stats: any; loading: boolean }> = ({ stats, loading }) => {
  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  const statCards = [
    { label: 'Total Lists', value: stats?.stats?.totalLists || 0, icon: '📋' },
    { label: 'Total Guests', value: stats?.stats?.totalGuests || 0, icon: '👥' },
    { label: 'Arrived', value: stats?.stats?.arrivedGuests || 0, icon: '✅' },
    { label: 'No-Shows', value: stats?.stats?.noShowGuests || 0, icon: '❌' },
    { label: 'Arrival Rate', value: `${((stats?.stats?.arrivalRate || 0) * 100).toFixed(0)}%`, icon: '📈' },
    { label: 'Fraud Risk', value: `${stats?.stats?.fraudRisk || 0}/100`, icon: '🛡️' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">Your promoter performance at a glance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-2xl font-bold">{card.value}</span>
            </div>
            <p className="text-sm text-gray-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Rating */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-2">Average Rating</h3>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold text-yellow-400">
            {(stats?.stats?.avgRating || 0).toFixed(1)}
          </span>
          <div className="flex text-yellow-400 text-2xl">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={i <= Math.round(stats?.stats?.avgRating || 0) ? 'text-yellow-400' : 'text-gray-600'}>
                ★
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Integration Rails */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Integration Rails</h3>
        <p className="text-sm text-gray-400 mb-4">Promoters already use these. We add trust underneath.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'Instagram', status: 'connected', color: 'bg-pink-600' },
            { name: 'WhatsApp', status: 'connected', color: 'bg-green-600' },
            { name: 'Eventbrite', status: 'available', color: 'bg-orange-600' },
            { name: 'Cash App', status: 'available', color: 'bg-green-500' },
            { name: 'SMS', status: 'available', color: 'bg-blue-600' },
            { name: 'Email', status: 'available', color: 'bg-gray-600' },
          ].map((rail) => (
            <div key={rail.name} className="flex items-center gap-3 p-3 bg-gray-900 rounded border border-gray-700">
              <div className={`w-2 h-2 rounded-full ${rail.color}`}></div>
              <div>
                <p className="font-medium text-sm">{rail.name}</p>
                <p className="text-xs text-gray-500">{rail.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Guest Lists Tab
// ═══════════════════════════════════════════════════════════════════════════
const GuestListsTab: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guest Lists</h1>
          <p className="text-gray-400">Smart lists with deposit, QR codes, no-show prediction</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-purple-600 rounded text-sm font-medium hover:bg-purple-700">
          + New List
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="font-bold mb-4">Create Smart Guest List</h3>
          <p className="text-sm text-gray-400 mb-4">
            The system predicts no-show probability based on user history and venue data. 
            Deposits are required for high-risk guests to reduce no-shows.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Venue" className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm" />
            <input type="date" className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm" />
            <input placeholder="Party size" type="number" className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm" />
            <input placeholder="Guest names (comma separated)" className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm" />
          </div>
          <button className="mt-4 px-6 py-2 bg-purple-600 rounded text-sm font-medium hover:bg-purple-700">
            Create List
          </button>
        </div>
      )}

      {/* Guest List Features */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl mb-2">🤖</div>
          <h4 className="font-bold mb-1">No-Show Prediction</h4>
          <p className="text-sm text-gray-400">ML model predicts likelihood of guests not showing up based on their history</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl mb-2">💳</div>
          <h4 className="font-bold mb-1">Smart Deposits</h4>
          <p className="text-sm text-gray-400">Higher deposits for high-risk guests, waived for trusted regulars</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl mb-2">📱</div>
          <h4 className="font-bold mb-1">QR Code Entry</h4>
          <p className="text-sm text-gray-400">Unique QR code per guest list for fast, secure entry verification</p>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Events Tab
// ═══════════════════════════════════════════════════════════════════════════
const EventsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-gray-400">Discover and manage events across all venues</p>
      </div>

      {/* Event Sources */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="font-bold mb-4">Event Discovery Sources</h3>
        <div className="flex flex-wrap gap-2">
          {['Eventbrite', 'Instagram', 'Venue Direct', 'Manual Entry'].map(source => (
            <span key={source} className="px-3 py-1 bg-gray-700 rounded-full text-sm">{source}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Venues Tab
// ═══════════════════════════════════════════════════════════════════════════
const VenuesTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Venues</h1>
        <p className="text-gray-400">Manage your venues and view real-time capacity</p>
      </div>

      {/* Venue Stats */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="font-bold mb-4">Real-Time Capacity Monitoring</h3>
        <p className="text-sm text-gray-400 mb-4">Track arrivals, waitlist, and capacity from all connected venues</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded p-3 text-center">
            <div className="text-2xl font-bold text-green-400">0</div>
            <div className="text-xs text-gray-500">Arrived</div>
          </div>
          <div className="bg-gray-900 rounded p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">0</div>
            <div className="text-xs text-gray-500">Waiting</div>
          </div>
          <div className="bg-gray-900 rounded p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">0</div>
            <div className="text-xs text-gray-500">Confirmed</div>
          </div>
          <div className="bg-gray-900 rounded p-3 text-center">
            <div className="text-2xl font-bold text-gray-400">0%</div>
            <div className="text-xs text-gray-500">Capacity</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Payouts Tab
// ═══════════════════════════════════════════════════════════════════════════
const PayoutsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-gray-400">Track your commissions from guest list conversions</p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="font-bold mb-4">Commission Structure</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
            <span className="text-sm">Per arrived guest</span>
            <span className="font-bold text-green-400">$5.00</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
            <span className="text-sm">VIP bottle service referral</span>
            <span className="font-bold text-green-400">10%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
            <span className="text-sm">Event ticket commission</span>
            <span className="font-bold text-green-400">5%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoterOS;
