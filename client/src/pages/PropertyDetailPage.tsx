import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

type Unit = {
  id: string;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  sqft?: number | null;
  rentAmount?: number | null;
  status: string;
  photos: { url: string }[];
  amenities: { amenity: { name: string; category?: string } }[];
  availabilities: { date: string; status: string; rate?: number }[];
};

type Review = {
  id: string;
  rating: number;
  title?: string;
  comment?: string;
  reviewerName?: string;
  createdAt: string;
};

type Property = {
  id: string;
  title: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount?: number;
  rentPeriod: string;
  status: string;
  description?: string;
  photos: { url: string; caption?: string; isCover: boolean }[];
  amenities: { amenity: { name: string; category?: string; icon?: string } }[];
  ratePlans: { id: string; name: string; rentAmount: number; rentPeriod: string; currency: string }[];
  units: Unit[];
  reviews: Review[];
  _count: { reviews: number; units: number };
  manager: { user: { firstName?: string; lastName?: string; profilePictureUrl?: string; email?: string } };
};

const PropertyDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [moveInDate, setMoveInDate] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/public/property/properties/${id}`)
      .then(res => setProperty(res.data?.data || null))
      .catch(e => setErr(e?.response?.data?.error || 'Could not load property'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      Loading property…
    </div>
  );

  if (err || !property) return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
      {err || 'Property not found'}
    </div>
  );

  const coverPhoto = property.photos?.find(p => p.isCover)?.url || property.photos?.[0]?.url || '';
  const avgRating = property.reviews?.length ? (property.reviews.reduce((s, r) => s + r.rating, 0) / property.reviews.length).toFixed(1) : 'New';

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/property-manager/messages', {
        propertyId: property.id,
        unitId: selectedUnit,
        conversationId: `inquiry-${id}-${Date.now()}`,
        senderEmail: (property.manager.user?.email || 'guest@example.com'),
        senderName: 'Guest',
        recipientEmail: property.manager.user?.email,
        subject: `Inquiry about ${property.title}`,
        body: message || `I'm interested in ${selectedUnit ? 'unit ' + selectedUnit : 'this property'}. Available from ${moveInDate || 'soon'}.`,
      });
      alert('Your inquiry has been sent!');
      setMessage('');
    } catch (e) {
      alert('Failed to send inquiry');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0' }}>
      {/* Hero */}
      <div style={{ height: 500, background: coverPhoto ? `url(${coverPhoto}) center/cover` : 'linear-gradient(135deg, #312e81, #4f46e5)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2,6,23,0.9) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <span style={{ background: '#6366f1', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{property.status}</span>
            <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>★ {avgRating} ({property._count.reviews})</span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, marginBottom: 8 }}>{property.title}</h1>
          <p style={{ color: '#cbd5e1', fontSize: 16 }}>{property.address}{property.city ? `, ${property.city}` : ''}{property.state ? ` ${property.state}` : ''}{property.zip ? ` ${property.zip}` : ''}</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 40 }}>
        {/* Main Content */}
        <div>
          {/* Quick Info */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 32, padding: '20px 0', borderBottom: '1px solid #1e293b' }}>
            <div><div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{property.bedrooms}</div><div style={{ fontSize: 13, color: '#94a3b8' }}>Bedrooms</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{property.bathrooms}</div><div style={{ fontSize: 13, color: '#94a3b8' }}>Bathrooms</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{property._count.units}</div><div style={{ fontSize: 13, color: '#94a3b8' }}>Units</div></div>
            {property.rentAmount && <div><div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>${property.rentAmount.toLocaleString()}</div><div style={{ fontSize: 13, color: '#94a3b8' }}>Per {property.rentPeriod.toLowerCase()}</div></div>}
          </div>

          {/* Description */}
          {property.description && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>About this property</h2>
              <p style={{ color: '#cbd5e1', lineHeight: 1.7 }}>{property.description}</p>
            </div>
          )}

          {/* Amenities */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Amenities</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {property.amenities?.map((a, i) => (
                <span key={i} style={{ background: '#1e293b', color: '#e2e8f0', padding: '8px 16px', borderRadius: 10, border: '1px solid #334155', fontSize: 14 }}>
                  {a.amenity.icon && <span style={{ marginRight: 6 }}>{a.amenity.icon}</span>}
                  {a.amenity.name}
                </span>
              ))}
            </div>
          </div>

          {/* Units */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Available Units</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {property.units?.filter(u => u.status === 'VACANT' || u.status === 'AVAILABLE').length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No units currently available.</p>
              ) : (
                property.units?.filter(u => u.status === 'VACANT' || u.status === 'AVAILABLE').map(u => (
                  <div key={u.id} style={{ background: '#1e293b', borderRadius: 12, padding: 16, border: selectedUnit === u.id ? '2px solid #6366f1' : '1px solid #334155', cursor: 'pointer' }} onClick={() => setSelectedUnit(u.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Unit {u.unitNumber}</div>
                        <div style={{ color: '#94a3b8', fontSize: 13 }}>{u.bedrooms}bd/{u.bathrooms}ba{u.sqft ? ` · ${u.sqft}sqft` : ''}</div>
                        {u.photos?.[0] && <img src={u.photos[0].url} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {u.rentAmount && <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>${u.rentAmount.toLocaleString()}<span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 400 }}>/mo</span></div>}
                        <span style={{ background: '#334155', color: '#e2e8f0', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{u.status}</span>
                      </div>
                    </div>
                    {u.amenities?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {u.amenities.slice(0, 5).map((a, i) => (
                          <span key={i} style={{ background: '#0f172a', color: '#94a3b8', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{a.amenity.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reviews */}
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Reviews</h2>
            {property.reviews?.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No reviews yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {property.reviews?.map(r => (
                  <div key={r.id} style={{ background: '#1e293b', borderRadius: 12, padding: 16, border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{r.reviewerName || 'Guest'}</div>
                      <div style={{ color: '#6366f1', fontWeight: 700 }}>★ {r.rating}/5</div>
                    </div>
                    {r.title && <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{r.title}</div>}
                    {r.comment && <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>{r.comment}</p>}
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Booking Sidebar */}
        <div>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', position: 'sticky', top: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', marginBottom: 4 }}>
              ${property.rentAmount?.toLocaleString() || 'Contact'}<span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 400 }}>/{property.rentPeriod.toLowerCase()}</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Hosted by {property.manager.user?.firstName} {property.manager.user?.lastName}</p>

            <form onSubmit={handleInquiry} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {property.units?.length > 1 && (
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Unit</label>
                  <select value={selectedUnit || ''} onChange={e => setSelectedUnit(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4 }}>
                    <option value="">Select a unit</option>
                    {property.units?.filter(u => u.status === 'VACANT' || u.status === 'AVAILABLE').map(u => (
                      <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Move-in Date</label>
                <input type="date" value={moveInDate} onChange={e => setMoveInDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="I'm interested in this property..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginTop: 4, resize: 'vertical' }} />
              </div>
              <button type="submit" style={{ padding: '14px', borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 16 }}>
                Send Inquiry
              </button>
            </form>

            <div style={{ marginTop: 16, padding: 12, background: '#0f172a', borderRadius: 10, fontSize: 12, color: '#94a3b8' }}>
              ★ Verified property · Secure booking · No platform fees for tenants
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailPage;
