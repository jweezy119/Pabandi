import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

type Property = {
  id: string;
  title: string;
  address?: string;
  city?: string;
  state?: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount?: number;
  rentPeriod: string;
  status: string;
  photos: { url: string }[];
  amenities: { amenity: { name: string } }[];
  _count: { reviews: number; units: number };
  manager: { user: { firstName?: string; lastName?: string; profilePictureUrl?: string } };
};

export const PublicPropertiesPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (state) params.set('state', state);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (bedrooms) params.set('bedrooms', bedrooms);
      const res = await api.get(`/public/property/properties?${params.toString()}`);
      setProperties(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load properties', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProperties();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '60px 20px 40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: '#fff', marginBottom: 12 }}>Find Your Next Home</h1>
        <p style={{ color: '#c7d2fe', fontSize: 18, maxWidth: 600, margin: '0 auto' }}>
          Browse verified listings with transparent pricing, amenities, and instant booking.
        </p>
      </div>

      {/* Search Filters */}
      <div style={{ maxWidth: 1200, margin: '-20px auto 0', padding: '0 20px' }}>
        <form onSubmit={handleSearch} style={{ background: '#1e293b', borderRadius: 16, padding: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>City</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Karachi" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>State</label>
            <input value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Sindh" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Min Price</label>
            <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Max Price</label>
            <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Any" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Bedrooms</label>
            <input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} placeholder="Any" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4 }} />
          </div>
          <button type="submit" style={{ padding: '10px 24px', borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Search</button>
        </form>
      </div>

      {/* Results */}
      <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading properties…</div>
        ) : properties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>No properties found. Try adjusting your filters.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {properties.map((p) => (
              <Link key={p.id} to={`/property/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', border: '1px solid #334155', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                  <div style={{ height: 220, background: p.photos?.[0]?.url ? `url(${p.photos[0].url}) center/cover` : 'linear-gradient(135deg, #312e81, #4f46e5)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{p._count.reviews} reviews</div>
                    <div style={{ position: 'absolute', bottom: 12, left: 12, background: '#6366f1', color: '#fff', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{p.status}</div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.title}</h3>
                    <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>{p.address}{p.city ? `, ${p.city}` : ''}{p.state ? ` ${p.state}` : ''}</p>
                    <div style={{ display: 'flex', gap: 12, color: '#cbd5e1', fontSize: 13, marginBottom: 8 }}>
                      <span>{p.bedrooms} bed</span>
                      <span>{p.bathrooms} bath</span>
                      <span>{p._count.units} unit{p._count.units !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {p.amenities?.slice(0, 4).map((a, i) => (
                        <span key={i} style={{ background: '#334155', color: '#e2e8f0', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{a.amenity.name}</span>
                      ))}
                    </div>
                    <div style={{ color: '#6366f1', fontSize: 20, fontWeight: 800 }}>
                      ${p.rentAmount?.toLocaleString()}<span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 400 }}>/{p.rentPeriod.toLowerCase()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicPropertiesPage;
