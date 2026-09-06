import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { freightService } from '../../services/api';
import { Button, Surface } from '../../design-system';
import {
  FiPackage,
  FiTruck,
  FiMapPin,
  FiCalendar,
  FiDollarSign,
  FiX,
  FiPlus,
} from 'react-icons/fi';

interface Load {
  id: string;
  status: 'OPEN' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  budget: number;
  weight: number;
  commodity: string;
  equipmentType: string;
  carrierId?: string;
  carrierName?: string;
}

type TabType = 'all' | 'active' | 'completed' | 'cancelled';

const statusColors: Record<Load['status'], { bg: string; text: string; icon: React.ReactNode }> = {
  OPEN: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: <FiPackage className="w-4 h-4" /> },
  ASSIGNED: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <FiTruck className="w-4 h-4" /> },
  IN_TRANSIT: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: <FiTruck className="w-4 h-4" /> },
  DELIVERED: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <FiPackage className="w-4 h-4" /> },
  CANCELLED: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <FiX className="w-4 h-4" /> },
};

const tabs: { id: TabType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const SkeletonCard = () => (
  <Surface className="p-5 animate-pulse space-y-4">
    <div className="flex items-center justify-between">
      <div className="h-5 bg-gray-700 rounded w-3/12"></div>
      <div className="h-6 bg-gray-700 rounded w-20"></div>
    </div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-700 rounded w-full"></div>
      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-700 rounded w-1/2"></div>
    </div>
    <div className="flex items-center gap-4">
      <div className="h-8 bg-gray-700 rounded w-24"></div>
      <div className="h-8 bg-gray-700 rounded w-24"></div>
      <div className="h-8 bg-gray-700 rounded w-24"></div>
    </div>
  </Surface>
);

const StatusChip: React.FC<{ status: Load['status'] }> = ({ status }) => {
  const config = statusColors[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${config.bg} ${config.text}`}>
      {config.icon}
      <span>{status.replace('_', ' ')}</span>
    </span>
  );
};

export const MyLoads: React.FC = () => {
  const { user } = useAuthStore();
  const [loads, setLoads] = useState<Load[]>([]);
  const [filteredLoads, setFilteredLoads] = useState<Load[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchLoads = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const res = await freightService.listLoads({ shipperId: user.id });
      const data = res.data?.data || [];
      setLoads(data);
    } catch (err) {
      setError('Failed to load your loads. Please try again.');
      console.error('Error fetching loads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, [user?.id]);

  useEffect(() => {
    switch (activeTab) {
      case 'active':
        setFilteredLoads(loads.filter(l => ['OPEN', 'ASSIGNED', 'IN_TRANSIT'].includes(l.status)));
        break;
      case 'completed':
        setFilteredLoads(loads.filter(l => l.status === 'DELIVERED'));
        break;
      case 'cancelled':
        setFilteredLoads(loads.filter(l => l.status === 'CANCELLED'));
        break;
      default:
        setFilteredLoads(loads);
    }
  }, [activeTab, loads]);

  const handleCancelLoad = async (loadId: string) => {
    if (!window.confirm('Are you sure you want to cancel this load? This action cannot be undone.')) {
      return;
    }

    try {
      setCancellingId(loadId);
      await freightService.updateLoadStatus(loadId, 'CANCELLED');
      setLoads(prev => prev.map(l => l.id === loadId ? { ...l, status: 'CANCELLED' as const } : l));
    } catch (err) {
      console.error('Error cancelling load:', err);
      alert('Failed to cancel load. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string) => 
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatWeight = (weight: number) => `${weight.toLocaleString()} lbs`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Loads</h1>
            <p className="text-gray-400 mt-1">Manage and track your freight shipments</p>
          </div>
          <Link to="/freight/post" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            <FiPlus className="w-4 h-4 mr-2" />
            Post New Load
          </Link>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Loads</h1>
            <p className="text-gray-400 mt-1">Manage and track your freight shipments</p>
          </div>
          <Link to="/freight/post" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            <FiPlus className="w-4 h-4 mr-2" />
            Post New Load
          </Link>
        </div>
        
        <Surface className="p-8 text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <Button onClick={fetchLoads}>Retry</Button>
        </Surface>
      </div>
    );
  }

  const totalCounts = {
    all: loads.length,
    active: loads.filter(l => ['OPEN', 'ASSIGNED', 'IN_TRANSIT'].includes(l.status)).length,
    completed: loads.filter(l => l.status === 'DELIVERED').length,
    cancelled: loads.filter(l => l.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Loads</h1>
          <p className="text-gray-400 mt-1">Manage and track your freight shipments</p>
        </div>
        <Link to="/freight/post" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          <FiPlus className="w-4 h-4 mr-2" />
          Post New Load
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2" role="tablist">
        {tabs.map(tab => {
          const count = totalCounts[tab.id as keyof typeof totalCounts];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-orange-500/30 text-orange-300' : 'bg-gray-700 text-gray-300'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredLoads.length === 0 ? (
        <Surface className="p-12 text-center">
          <FiPackage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {activeTab === 'all' ? 'No loads yet' : `No ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} loads`}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {activeTab === 'all' 
              ? 'Get started by posting your first load. Connect with verified carriers and move your freight with confidence.'
              : `You don't have any ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} loads at the moment.`}
          </p>
          {activeTab === 'all' && (
            <Link to="/freight/post" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium text-lg hover:opacity-90 transition-opacity">
              <FiPlus className="w-5 h-5 mr-2" />
              Post Your First Load
            </Link>
          )}
        </Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLoads.map(load => {
            const isOpen = load.status === 'OPEN';
            const isTrackable = canTrack(load.status);

            return (
              <Surface 
                key={load.id} 
                className="p-5 space-y-4 hover:border-orange-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <StatusChip status={load.status} />
                    <h3 className="font-semibold text-white truncate mt-2">{load.commodity}</h3>
                    <p className="text-sm text-gray-400 mt-1">Load #{load.id.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <FiMapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-400 truncate">{load.origin}</p>
                      <p className="text-white truncate font-medium">{load.destination}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <FiCalendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-gray-400">Pickup: <span className="text-white">${formatDate(load.pickupDate)}</span></p>
                      <p className="text-gray-400">Delivery: <span className="text-white">${formatDate(load.deliveryDate)}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <FiDollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-gray-400">Budget: <span className="text-white font-medium">${formatCurrency(load.budget)}</span></p>
                      <p className="text-gray-400">Weight: <span className="text-white">${formatWeight(load.weight)}</span></p>
                    </div>
                  </div>

                  {load.equipmentType && (
                    <div className="flex items-center gap-3 text-sm">
                      <FiTruck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-300">{load.equipmentType}</span>
                    </div>
                  )}

                  {load.carrierName && (
                    <div className="flex items-center gap-3 text-sm pt-2 border-t border-gray-700">
                      <FiTruck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-300">Carrier: <span className="text-white font-medium">{load.carrierName}</span></span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                  {isOpen && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-red-400 hover:bg-red-500/10"
                      onClick={() => handleCancelLoad(load.id)}
                      disabled={cancellingId === load.id}
                    >
                      {cancellingId === load.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Cancelling...
                        </span>
                      ) : (
                        <>
                          <FiX className="w-4 h-4 mr-1" />
                          Cancel Load
                        </>
                      )}
                    </Button>
                  )}

                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyLoads;
