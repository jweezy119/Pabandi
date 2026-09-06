import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { freightService } from '../../../services/api';
import { Button, Chip, Badge, Surface } from '../../../design-system';
import {
  FiFilter,
  FiTruck,
  FiMapPin,
  FiStar,
  FiUsers,
  FiCheckCircle,
  FiChevronRight,
  FiSearch,
  FiHome,
} from 'react-icons/fi';

const EQUIPMENT_TYPES = ['DRY_VAN', 'REEFER', 'FLATBED', 'STEP_DECK', 'POWER_ONLY', 'BOX_TRUCK'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const formatNumber = (num: number) => new Intl.NumberFormat().format(num);

const CarrierCard = ({ carrier, onViewProfile }: { carrier: any; onViewProfile: (id: string) => void }) => (
  <Surface className="p-5 hover:border-orange-400/30 transition-all group" aria-roledescription="listitem">
    <div className="flex items-start gap-4">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
        {carrier.companyName?.[0] || 'C'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate group-hover:text-orange-300 transition-colors">{carrier.companyName}</h3>
            <p className="text-sm text-slate-400 truncate">{carrier.dotNumber ? `DOT: ${carrier.dotNumber}` : 'No DOT number'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {carrier.verified && (
              <Chip tone="success" className="text-xs">
                <FiCheckCircle size={12} className="mr-1" aria-hidden="true" /> Verified
              </Chip>
            )}
            <Badge tone="info" className="text-xs">
              <FiStar size={12} className="mr-1" aria-hidden="true" />
              {carrier.rating?.toFixed(1) || 'N/A'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-300 mb-3 flex-wrap">
          {carrier.equipmentType?.length && (
            <span className="flex items-center gap-1">
              <FiTruck size={14} className="text-orange-400" aria-hidden="true" />
              {carrier.equipmentType.join(', ')}
            </span>
          )}
          {carrier.operatingStates?.length && (
            <span className="flex items-center gap-1">
              <FiMapPin size={14} className="text-emerald-400" aria-hidden="true" />
              {carrier.operatingStates.length > 3 
                ? `${carrier.operatingStates.slice(0, 3).join(', ')} +${carrier.operatingStates.length - 3} more`
                : carrier.operatingStates.join(', ')}
            </span>
          )}
          {carrier.fleetSize && (
            <span className="flex items-center gap-1">
              <FiUsers size={14} className="text-blue-400" aria-hidden="true" />
              ${carrier.fleetSize} vehicles
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-400">
            ${carrier.totalDeliveries || 0} deliveries
          </span>
          {carrier.maxLoadLbs && (
            <span className="text-slate-400">
              Max: ${formatNumber(carrier.maxLoadLbs)} lbs
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:flex-col lg:items-end w-full lg:w-auto">
        <div className="text-right">
          <p className="text-xl font-black text-white">${carrier.rating ? carrier.rating.toFixed(1) : 'N/A'}</p>
          <p className="text-xs text-slate-400">Rating</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewProfile(carrier.id)}>
            <FiChevronRight size={14} className="mr-1" aria-hidden="true" />
            View Profile
          </Button>
        </div>
      </div>
    </div>
  </Surface>
);

const CarrierSkeleton = () => (
  <Surface className="p-5 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="w-14 h-14 rounded-xl bg-white/10 flex-shrink-0"></div>
      <div className="flex-1 space-y-3">
        <div className="h-5 bg-white/10 rounded w-1/3"></div>
        <div className="h-4 bg-white/10 rounded w-1/2"></div>
        <div className="flex gap-3">
          <div className="h-4 bg-white/10 rounded w-24"></div>
          <div className="h-4 bg-white/10 rounded w-24"></div>
        </div>
      </div>
    </div>
  </Surface>
);

export const CarrierDirectory = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    verified: false,
    state: '',
    equipmentType: '',
    minRating: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCarriers();
  }, [filters, sortBy]);

  const loadCarriers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filters.verified) params.verified = 'true';
      if (filters.state) params.state = filters.state;
      if (filters.equipmentType) params.equipmentType = filters.equipmentType;
      if (filters.minRating) params.minRating = Number(filters.minRating);
      
      const res = await freightService.listCarriers(params);
      let data = res.data?.data || [];
      
      data = [...data].sort((a, b) => {
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'deliveries') return (b.totalDeliveries || 0) - (a.totalDeliveries || 0);
        if (sortBy === 'fleet') return (b.fleetSize || 0) - (a.fleetSize || 0);
        return 0;
      });
      
      setCarriers(data);
    } catch (e) {
      console.error('Failed to load carriers:', e);
      setError('Failed to load carriers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      verified: false,
      state: '',
      equipmentType: '',
      minRating: '',
      search: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '' && v !== false);

  const handleViewProfile = (carrierId: string) => {
    navigate(`/freight/carriers/${carrierId}`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white">Carrier Directory</h1>
          <p className="text-slate-400 mt-1">
            {carriers.length} carriers • {hasActiveFilters ? 'Filtered' : 'All verified carriers'}
          </p>
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
              <option value="rating">Rating (High to Low)</option>
              <option value="deliveries">Most Deliveries</option>
              <option value="fleet">Largest Fleet</option>
            </select>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${hasActiveFilters 
              ? 'bg-orange-500/15 text-orange-300 border border-orange-400/30' 
              : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'}`}
          >
            <FiFilter size={16} /> Filters {hasActiveFilters && (
              <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {Object.values(filters).filter(v => v !== '' && v !== false).length}
              </span>
            )}
          </button>
          {isAuthenticated && user?.role === 'CARRIER' && (
            <Link to="/freight/carriers/profile">
              <Button className="gap-2">
                <FiHome size={16} /> My Profile
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Search</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" aria-hidden="true" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Company name, DOT..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400 pl-10"
                />
              </div>
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
              <label className="text-sm font-medium text-slate-300 mb-1 block">Operating State</label>
              <select
                value={filters.state}
                onChange={(e) => handleFilterChange('state', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400"
              >
                <option value="">All States</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Min Rating</label>
              <select
                value={filters.minRating}
                onChange={(e) => handleFilterChange('minRating', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400"
              >
                <option value="">Any Rating</option>
                <option value="4.5">4.5+</option>
                <option value="4.0">4.0+</option>
                <option value="3.5">3.5+</option>
                <option value="3.0">3.0+</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verified}
                  onChange={(e) => handleFilterChange('verified', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-slate-300">Verified only</span>
              </label>
            </div>
          </div>
        </Surface>
      )}

      <div className="space-y-4" role="list" aria-label="Carrier listings">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <CarrierSkeleton key={i} />)
        ) : error ? (
          <Surface className="p-8 text-center">
            <div className="text-red-400 mb-4">{error}</div>
            <Button onClick={loadCarriers}>Retry</Button>
          </Surface>
        ) : carriers.length === 0 ? (
          <Surface className="p-12 text-center">
            <FiTruck size={48} className="mx-auto text-slate-500 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-bold text-white mb-2">No carriers found</h3>
            <p className="text-slate-400 mb-4">Try adjusting your filters or check back later.</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-orange-400 hover:text-orange-300 text-sm font-medium">Clear filters</button>
            )}
          </Surface>
        ) : (
          carriers.map((carrier) => <CarrierCard key={carrier.id} carrier={carrier} onViewProfile={handleViewProfile} />)
        )}
      </div>
    </div>
  );
};

export default CarrierDirectory;
