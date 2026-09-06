import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { freightService } from '../../services/api';
import { Button, Chip, Badge, Surface } from '../../design-system';
import { FiFilter, FiTruck, FiMapPin, FiDollarSign, FiCalendar, FiPlus } from 'react-icons/fi';

const CARGO_TYPES = ['GENERAL', 'REFRIGERATED', 'HAZARDOUS', 'OVERSIZED', 'FRAGILE'];
const EQUIPMENT_TYPES = ['DRY_VAN', 'REEFER', 'FLATBED', 'STEP_DECK', 'POWER_ONLY', 'BOX_TRUCK'];

const cargoTypeColors: Record<string, string> = {
  GENERAL: 'bg-blue-500/20 text-blue-300',
  REFRIGERATED: 'bg-cyan-500/20 text-cyan-300',
  HAZARDOUS: 'bg-red-500/20 text-red-300',
  OVERSIZED: 'bg-amber-500/20 text-amber-300',
  FRAGILE: 'bg-pink-500/20 text-pink-300',
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface LoadItem {
  id: string;
  title: string;
  description?: string;
  cargoType: string;
  status: string;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  equipmentType?: string;
  pickupDate: string;
  deliveryDate: string;
  budgetUsd: number;
  weightLbs: number;
  dimensions?: string;
  shipper?: { firstName: string; lastName: string };
  carrier?: { companyName: string };
}

const LoadCard = ({ load, onBidClick }: { load: LoadItem; onBidClick: () => void }) => {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <Surface className="p-4 hover:border-orange-400/30 transition-all group" aria-roledescription="listitem">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white truncate">{load.title}</h3>
              <p className="text-sm text-slate-400 truncate">{load.description || 'No description'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone="info" className={cargoTypeColors[load.cargoType] || 'bg-white/10 text-white'}>
                {load.cargoType}
              </Chip>
              <Badge tone="success" className="text-xs">{load.status}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-300 mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              <FiMapPin size={14} className="text-orange-400" aria-hidden="true" />
              {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
            </span>
            <span className="flex items-center gap-1">
              <FiCalendar size={14} className="text-emerald-400" aria-hidden="true" />
              Pickup: {formatDate(load.pickupDate)}
            </span>
            <span className="flex items-center gap-1">
              <FiCalendar size={14} className="text-amber-400" aria-hidden="true" />
              Delivery: {formatDate(load.deliveryDate)}
            </span>
            {load.equipmentType && (
              <span className="flex items-center gap-1">
                <FiTruck size={14} className="text-blue-400" aria-hidden="true" />
                {load.equipmentType}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <FiDollarSign size={14} aria-hidden="true" />
              ${load.budgetUsd?.toLocaleString() || '0'}
            </span>
            <span className="text-slate-400">
              {load.weightLbs?.toLocaleString()} lbs
            </span>
            {load.dimensions && (
              <span className="text-slate-400">{load.dimensions}</span>
            )}
            <span className="text-slate-500">Posted by {load.shipper?.firstName} {load.shipper?.lastName?.[0]}.</span>
          </div>
        </div>

        <div className="flex items-center gap-3 lg:flex-col lg:items-end w-full lg:w-auto">
          <div className="text-right">
            <p className="text-2xl font-black text-white">${load.budgetUsd?.toLocaleString() || '0'}</p>
            <p className="text-xs text-slate-400">Budget</p>
          </div>
          <div className="flex gap-2">
            <Link to={"/freight/loads/" + load.id} className="px-4 py-2 bg-white/5 text-slate-300 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-sm font-medium">
              Details
            </Link>
            {isAuthenticated && user?.role === 'CARRIER' && (
              <button onClick={onBidClick} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                Place Bid
              </button>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
};

export const LoadBoard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    origin: string;
    destination: string;
    cargoType: string;
    equipmentType: string;
    minWeight: string;
    maxWeight: string;
    maxBudget: string;
  }>({
    origin: '',
    destination: '',
    cargoType: '',
    equipmentType: '',
    minWeight: '',
    maxWeight: '',
    maxBudget: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    loadLoads();
  }, [filters, sortBy]);

  const loadLoads = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { status: 'OPEN' };
      if (filters.origin) params.originCity = filters.origin;
      if (filters.destination) params.destCity = filters.destination;
      if (filters.cargoType) params.cargoType = filters.cargoType;
      if (filters.minWeight) params.minWeight = Number(filters.minWeight);
      if (filters.maxWeight) params.maxWeight = Number(filters.maxWeight);
      
      const res = await freightService.listLoads(params);
      let data = res.data?.data || [];
      
      data = [...data].sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'budget_high') return (b.budgetUsd || 0) - (a.budgetUsd || 0);
        if (sortBy === 'budget_low') return (a.budgetUsd || 0) - (b.budgetUsd || 0);
        return 0;
      });
      
      setLoads(data);
    } catch (e) {
      console.error('Failed to load loads:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      origin: '',
      destination: '',
      cargoType: '',
      equipmentType: '',
      minWeight: '',
      maxWeight: '',
      maxBudget: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white">Load Board</h1>
          <p className="text-slate-400 mt-1">{loads.length} available loads • {hasActiveFilters ? 'Filtered' : 'All loads'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-slate-400">Sort:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-400"
            >
              <option value="newest">Newest First</option>
              <option value="budget_high">Budget: High to Low</option>
              <option value="budget_low">Budget: Low to High</option>
            </select>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all " + (hasActiveFilters ? 'bg-orange-500/15 text-orange-300 border border-orange-400/30' : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10')}
          >
            <FiFilter size={16} /> Filters {hasActiveFilters && <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{Object.values(filters).filter(v => v).length}</span>}
          </button>
          {isAuthenticated && user?.role === 'SHIPPER' && (
            <Link to="/freight/post">
              <Button className="gap-2">
                <FiPlus size={16} /> Post Load
              </Button>
            </Link>
          )}
        </div>
      </div>

      {showFilters && (
        <Surface className="p-4 space-y-4 animate-slide-down">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Filters</h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-orange-400 hover:text-orange-300">Clear all</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Origin City</label>
              <input
                type="text"
                value={filters.origin}
                onChange={(e) => handleFilterChange('origin', e.target.value)}
                placeholder="e.g. Chicago"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Destination City</label>
              <input
                type="text"
                value={filters.destination}
                onChange={(e) => handleFilterChange('destination', e.target.value)}
                placeholder="e.g. New York"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Cargo Type</label>
              <select
                value={filters.cargoType}
                onChange={(e) => handleFilterChange('cargoType', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400"
              >
                <option value="">All Types</option>
                {CARGO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Equipment Type</label>
              <select
                value={filters.equipmentType}
                onChange={(e) => handleFilterChange('equipmentType', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400"
              >
                <option value="">All Equipment</option>
                {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Min Weight (lbs)</label>
              <input
                type="number"
                value={filters.minWeight}
                onChange={(e) => handleFilterChange('minWeight', e.target.value)}
                placeholder="1000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Max Weight (lbs)</label>
              <input
                type="number"
                value={filters.maxWeight}
                onChange={(e) => handleFilterChange('maxWeight', e.target.value)}
                placeholder="45000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Max Budget ($)</label>
              <input
                type="number"
                value={filters.maxBudget}
                onChange={(e) => handleFilterChange('maxBudget', e.target.value)}
                placeholder="5000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400"
              />
            </div>
          </div>
        </Surface>
      )}

      <div className="space-y-4" role="list" aria-label="Available loads">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Surface key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-3/4 mb-3"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-4 bg-white/10 rounded"></div>
                <div className="h-4 bg-white/10 rounded"></div>
                <div className="h-4 bg-white/10 rounded"></div>
              </div>
            </Surface>
          ))
        ) : loads.length === 0 ? (
          <Surface className="p-12 text-center">
            <FiTruck size={48} className="mx-auto text-slate-500 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-bold text-white mb-2">No loads found</h3>
            <p className="text-slate-400 mb-4">Try adjusting your filters or check back later.</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-orange-400 hover:text-orange-300 text-sm font-medium">Clear filters</button>
            )}
          </Surface>
        ) : (
          loads.map((loadItem) => (
            <LoadCard key={loadItem.id} load={loadItem} onBidClick={() => navigate("/freight/loads/" + loadItem.id)} />
          ))
        )}
      </div>
    </div>
  );
};

export default LoadBoard;
