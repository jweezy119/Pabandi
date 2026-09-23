import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const PM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/property-manager`;

type Listing = {
  id: string;
  title: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  bedrooms: number;
  bathrooms: number;
  rentAmount?: number | null;
  rentPeriod: string;
};

type PortalData = {
  companyName?: string | null;
  slug: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  vacantListings: Listing[];
};

const TenantPortalPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [err, setErr] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [applyForm, setApplyForm] = useState({ email: '', firstName: '', lastName: '', phone: '', message: '', desiredMoveIn: '', monthlyIncome: '' });
  const [applyStatus, setApplyStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [applyMsg, setApplyMsg] = useState('');

  const load = () => {
    fetch(`${PM_API}/portal/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setPortal(data.data);
        else setErr('This portal is not available.');
      })
      .catch(() => setErr('This portal is not available.'));
  };

  useEffect(load, [slug]);

  const apply = async () => {
    if (!applyForm.email) return;
    setApplyStatus('working');
    try {
      const res = await fetch(`${PM_API}/portal/${slug}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...applyForm,
          propertyId: selectedProperty || undefined,
          monthlyIncome: applyForm.monthlyIncome ? Number(applyForm.monthlyIncome) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApplyStatus('done');
        setApplyMsg(data.message || 'Application submitted!');
        setApplyForm({ email: '', firstName: '', lastName: '', phone: '', message: '', desiredMoveIn: '', monthlyIncome: '' });
        setSelectedProperty(null);
      } else {
        setApplyStatus('error');
        setApplyMsg(data.error || 'Could not submit application');
      }
    } catch {
      setApplyStatus('error');
      setApplyMsg('Could not submit application');
    }
  };

  if (err) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-4">
        <div className="text-center p-8 rounded-2xl bg-white shadow-sm border border-[var(--soft-stone)]/30 max-w-md">
          <h1 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">Portal not found</h1>
          <p className="text-[var(--soft-stone)]">{err}</p>
          <Link to="/" className="inline-block mt-4 px-6 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium">Go to Pabandi</Link>
        </div>
      </div>
    );
  }

  if (!portal) return <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--clay)]" /></div>;

  const brand = portal.brandColor || '#C97B5A';

  return (
    <div className="min-h-screen bg-[var(--cream)]" style={{ background: `radial-gradient(800px 400px at 50% -10%, ${brand}15, transparent 60%), var(--cream)` }}>
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          {portal.logoUrl && <img src={portal.logoUrl} alt="" className="h-12 mx-auto mb-4" />}
          <h1 className="text-3xl font-bold" style={{ color: brand }}>{portal.companyName || 'Property Manager'}</h1>
          {portal.tagline && <p className="text-[var(--soft-stone)] mt-2">{portal.tagline}</p>}
          <p className="text-sm text-[var(--soft-stone)] mt-2">Listings secured by Pabandi — apply with escrow-backed deposits and $PAB rewards.</p>
        </div>

        {/* Application Form */}
        <div className="rounded-2xl bg-white p-6 mb-8 border border-[var(--soft-stone)]/30 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-2">Apply for a rental</h2>
          <p className="text-sm text-[var(--soft-stone)] mb-4">Fill out the form below. The manager will review and run a background check.</p>

          {applyStatus === 'done' ? (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
              ✅ {applyMsg}
            </div>
          ) : (
            <>
              {selectedProperty && (
                <div className="mb-3 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
                  Applying to: <strong>{portal.vacantListings.find(l => l.id === selectedProperty)?.title}</strong>
                  <button onClick={() => setSelectedProperty(null)} className="ml-2 text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">change</button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={applyForm.email} onChange={e => setApplyForm({ ...applyForm, email: e.target.value })} placeholder="Email *" type="email" className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm" />
                <input value={applyForm.firstName} onChange={e => setApplyForm({ ...applyForm, firstName: e.target.value })} placeholder="First name" className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm" />
                <input value={applyForm.lastName} onChange={e => setApplyForm({ ...applyForm, lastName: e.target.value })} placeholder="Last name" className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm" />
                <input value={applyForm.phone} onChange={e => setApplyForm({ ...applyForm, phone: e.target.value })} placeholder="Phone" className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm" />
                <input value={applyForm.desiredMoveIn} onChange={e => setApplyForm({ ...applyForm, desiredMoveIn: e.target.value })} type="date" className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm" />
                <input value={applyForm.monthlyIncome} onChange={e => setApplyForm({ ...applyForm, monthlyIncome: e.target.value })} placeholder="Monthly income (USD)" type="number" className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm" />
              </div>
              <textarea value={applyForm.message} onChange={e => setApplyForm({ ...applyForm, message: e.target.value })} placeholder="Tell the manager about yourself..." rows={3} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm mt-3" />
              {applyStatus === 'error' && <p className="mt-2 text-sm text-[var(--terracotta)]">{applyMsg}</p>}
              <button onClick={apply} disabled={applyStatus === 'working' || !applyForm.email} className="mt-4 px-6 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition" style={{ background: `linear-gradient(135deg, ${brand}, #A85A3C)` }}>
                {applyStatus === 'working' ? 'Submitting…' : 'Submit application'}
              </button>
            </>
          )}
        </div>

        {/* Listings */}
        <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">{portal.vacantListings.length} available {portal.vacantListings.length === 1 ? 'listing' : 'listings'}</h2>
        <div className="space-y-4">
          {portal.vacantListings.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-center border border-[var(--soft-stone)]/30">
              <p className="text-[var(--soft-stone)]">No listings available right now. Check back soon.</p>
            </div>
          )}
          {portal.vacantListings.map(l => (
            <div key={l.id} className="rounded-2xl bg-white p-5 border border-[var(--soft-stone)]/30 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-[var(--warm-ink)]">{l.title}</h3>
                <p className="text-sm text-[var(--soft-stone)]">
                  {l.address}{l.city ? `, ${l.city}` : ''}{l.state ? ` ${l.state}` : ''} · {l.bedrooms}bd/{l.bathrooms}ba
                </p>
              </div>
              <div className="text-right">
                {l.rentAmount && <div className="text-2xl font-bold" style={{ color: brand }}>${l.rentAmount}<span className="text-sm text-[var(--soft-stone)] font-normal">/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</span></div>}
                <button onClick={() => { setSelectedProperty(l.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition" style={{ background: `linear-gradient(135deg, ${brand}, #A85A3C)` }}>Apply</button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[var(--soft-stone)] mt-8">
          Powered by Pabandi — Commitment, Secured. · <Link to="/login" className="text-[var(--clay)] hover:underline">Already applied? Track your application</Link>
        </p>
      </div>
    </div>
  );
};

export default TenantPortalPage;
