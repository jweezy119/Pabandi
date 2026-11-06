import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { ClayCard } from '../../components/clay/ClayCard';
import { apiClient } from '../../services/api';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore', end: true },
  { path: '/booking/map', label: 'Map', icon: 'map' },
  { path: '/me/bookings', label: 'My Bookings', icon: 'event' },
  { path: '/simulator', label: 'Project Simulator', icon: 'model_training' },
  { path: '/contact', label: 'Business CRM', icon: 'storefront' },
  { path: '/sandbox', label: 'Trust Sandbox', icon: 'verified_user' },
];

interface BusinessPin {
  id: string;
  name: string;
  slug?: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  trustScore?: number;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Services', icon: 'apps' },
  { id: 'ROOFING', label: 'Roofing & Solar', icon: 'roofing' },
  { id: 'HVAC', label: 'HVAC & Climate', icon: 'mode_fan' },
  { id: 'SECURITY', label: 'Security & Alarms', icon: 'shield' },
  { id: 'RESTAURANT', label: 'Restaurants', icon: 'restaurant' },
  { id: 'SALON', label: 'Salons', icon: 'content_cut' },
  { id: 'SPA', label: 'Spas & Wellness', icon: 'spa' },
  { id: 'FITNESS_CENTER', label: 'Fitness & Gyms', icon: 'fitness_center' },
  { id: 'CLINIC', label: 'Clinics', icon: 'local_hospital' },
  { id: 'FREELANCE', label: 'Tech & Freelance', icon: 'terminal' },
];

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
}

export default function BookingMapPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<BusinessPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Default center: Chicago, IL (Loop / Michigan Ave)
  const defaultCenter = useMemo<[number, number]>(() => [41.8781, -87.6298], []);

  useEffect(() => {
    let isMounted = true;
    const fetchPins = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/booking/businesses');
        if (isMounted && res.data?.data) {
          setBusinesses(res.data.data);
        }
      } catch (err: unknown) {
        console.warn('Map businesses fetch failed, trying window.fetch:', err);
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/booking/businesses`
          );
          if (res.ok) {
            const json = await res.json();
            if (isMounted && json.data) {
              setBusinesses(json.data);
            }
          }
        } catch (fetchErr: unknown) {
          console.error('Failed to load businesses for map:', fetchErr);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPins();
    return () => {
      isMounted = false;
    };
  }, []);

  const pinsWithCoords = useMemo(() => {
    return businesses.filter(
      (b) => typeof b.latitude === 'number' && typeof b.longitude === 'number'
    );
  }, [businesses]);

  const filteredPins = useMemo(() => {
    return pinsWithCoords.filter((b) => {
      if (selectedCategory !== 'ALL' && b.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.name.toLowerCase().includes(q);
        const matchCity = b.city?.toLowerCase().includes(q);
        const matchCat = b.category.toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchCat) return false;
      }
      return true;
    });
  }, [pinsWithCoords, selectedCategory, searchQuery]);

  return (
    <DashboardLayout osName="BookingOS" osIcon="◈" osColor="terracotta" navItems={NAV_ITEMS}>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--warm-ink)' }}>
              Interactive Discovery Map
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--soft-stone)' }}>
              Explore verified locations across Chicago and surrounding neighborhoods. Every pinned merchant offers non-custodial smart escrow guarantees.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/booking')}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
              style={{
                background: 'var(--warm-sand)',
                border: '1px solid rgba(191,179,163,0.35)',
                color: 'var(--warm-ink)',
              }}
            >
              ← Grid View
            </button>
            <span
              className="px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--warm-sand)', color: 'var(--clay)' }}
            >
              {filteredPins.length} Places Pinned
            </span>
          </div>
        </div>

        {/* Category Pills & Search */}
        <ClayCard className="p-4 space-y-3" hover={false}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search pinned places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl text-sm border focus:outline-none"
              style={{
                background: 'white',
                borderColor: 'rgba(191,179,163,0.4)',
                color: 'var(--warm-ink)',
              }}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected ? 'shadow-sm' : 'hover:bg-[rgba(191,179,163,0.25)]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--clay)' : 'var(--warm-sand)',
                    color: isSelected ? 'white' : 'var(--warm-ink)',
                    border: isSelected ? 'none' : '1px solid rgba(191,179,163,0.3)',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </ClayCard>

        {/* Map Container */}
        <div
          className="rounded-2xl overflow-hidden shadow-sm border"
          style={{ borderColor: 'rgba(191,179,163,0.35)', background: 'var(--warm-sand)' }}
        >
          {loading ? (
            <div className="h-[520px] flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 mx-auto border-3 border-[var(--clay)] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold" style={{ color: 'var(--soft-stone)' }}>
                  Loading map & verified locations...
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              <MapContainer
                center={defaultCenter}
                zoom={13}
                scrollWheelZoom={true}
                style={{ height: '520px', width: '100%', zIndex: 1 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap lat={defaultCenter[0]} lng={defaultCenter[1]} />

                {filteredPins.map((b) => {
                  let markerColor = '#c2410c'; // RESTAURANT (terracotta)
                  if (b.category === 'ROOFING') markerColor = '#334155'; // slate
                  else if (b.category === 'HVAC') markerColor = '#0284c7'; // sky blue
                  else if (b.category === 'SECURITY') markerColor = '#7c3aed'; // violet
                  else if (b.category === 'SALON') markerColor = '#d97706'; // amber
                  else if (b.category === 'SPA') markerColor = '#059669'; // emerald
                  else if (b.category === 'FITNESS_CENTER') markerColor = '#4f46e5'; // indigo

                  return (
                    <CircleMarker
                      key={b.id}
                      center={[b.latitude!, b.longitude!]}
                      radius={10}
                      pathOptions={{
                        color: markerColor,
                        weight: 2,
                        fillColor: markerColor,
                        fillOpacity: 0.85,
                      }}
                    >
                      <Popup>
                        <div className="p-1 space-y-1.5 min-w-[180px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--warm-sand)] text-[var(--clay)] uppercase">
                              {b.category}
                            </span>
                            {b.trustScore && (
                              <span className="text-[10px] font-bold text-emerald-700">
                                {Math.round(b.trustScore)} Trust
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 leading-tight">
                            {b.name}
                          </h4>
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {b.address || `${b.city}, ${b.state || 'IL'}`}
                          </p>
                          <Link
                            to={`/book/${b.slug || b.id}`}
                            className="inline-block w-full text-center py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-sm"
                            style={{ background: 'var(--clay)' }}
                          >
                            Book Guarantee →
                          </Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              {/* Map Footer Bar */}
              <div
                className="px-4 py-2.5 flex items-center justify-between text-xs border-t"
                style={{
                  background: 'var(--warm-sand)',
                  borderColor: 'rgba(191,179,163,0.3)',
                  color: 'var(--soft-stone)',
                }}
              >
                <span>
                  Showing {filteredPins.length} verified businesses in Chicago · Licensed City of Chicago & OSM
                </span>
                <span className="font-medium text-[var(--clay)]">
                  ● Slate = Roofers · ● Blue = HVAC · ● Purple = Security · ● Terracotta = Food · ● Gold = Salons · ● Emerald = Spas
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
