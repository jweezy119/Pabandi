// Sitara OS — Units Page (real property backend)
// Properties → units, all persisted. Enroll gate on first run.
import { useEffect, useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';
import { useRental, RentalGate } from '../utils/useRental';

const statusColors: Record<string, string> = {
  VACANT: 'bg-green-100 text-green-800',
  OCCUPIED: 'bg-blue-100 text-blue-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
};

export default function UnitsPage() {
  const { data, loading, enrolled, enrolling, enroll, refresh } = useRental();
  const [propertyId, setPropertyId] = useState('');
  const [units, setUnits] = useState<any[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [showAddProp, setShowAddProp] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [propTitle, setPropTitle] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [rent, setRent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const properties: any[] = data?.properties || [];
  useEffect(() => {
    if (!propertyId && properties.length > 0) setPropertyId(properties[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      return;
    }
    setLoadingUnits(true);
    sitaraApi
      .rentalUnits(propertyId)
      .then((u) => setUnits(Array.isArray(u) ? u : []))
      .catch(() => setUnits([]))
      .finally(() => setLoadingUnits(false));
  }, [propertyId, data]);

  const handleAddProperty = async () => {
    if (!propTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await sitaraApi.rentalAddProperty({ title: propTitle.trim() });
      setPropTitle('');
      setShowAddProp(false);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not add property.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUnit = async () => {
    if (!propertyId || !unitNumber.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await sitaraApi.rentalAddUnit({
        propertyId,
        unitNumber: unitNumber.trim(),
        rentAmount: rent ? Number(rent) : undefined,
      });
      setUnitNumber('');
      setRent('');
      setShowAddUnit(false);
      const u = await sitaraApi.rentalUnits(propertyId).catch(() => []);
      setUnits(Array.isArray(u) ? u : []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not add unit.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading portfolio…</p>;
  if (!enrolled) return <RentalGate onEnroll={(n) => void enroll(n)} enrolling={enrolling} />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Units</h1>
          <p className="text-slate-600 mt-1">{properties.length} propert{properties.length === 1 ? 'y' : 'ies'} · live</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddProp(!showAddProp)} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200">
            + Property
          </button>
          <button onClick={() => setShowAddUnit(!showAddUnit)} disabled={!propertyId} className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50">
            + Add Unit
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4">{error}</div>}

      {showAddProp && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex gap-2">
          <input value={propTitle} onChange={(e) => setPropTitle(e.target.value)} placeholder="Property name or address" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <button onClick={() => void handleAddProperty()} disabled={saving} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-50">Save</button>
        </div>
      )}

      {properties.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar mobile-scroll pb-1">
          {properties.map((p: any) => (
            <button key={p.id} onClick={() => setPropertyId(p.id)} className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium ${propertyId === p.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
              {p.title}
            </button>
          ))}
        </div>
      )}

      {showAddUnit && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="Unit #" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <input value={rent} onChange={(e) => setRent(e.target.value)} placeholder="Rent $" inputMode="decimal" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <button onClick={() => void handleAddUnit()} disabled={saving} className="col-span-2 sm:col-span-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">Save unit</button>
        </div>
      )}

      {properties.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="font-semibold text-slate-900 mb-1">No properties yet</p>
          <p className="text-sm text-slate-500">Add your first property to start tracking units.</p>
        </div>
      ) : loadingUnits ? (
        <p className="text-slate-500 text-sm">Loading units…</p>
      ) : units.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="font-semibold text-slate-900 mb-1">No units in this property</p>
          <p className="text-sm text-slate-500">Add one with + Add Unit above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((u: any) => (
            <div key={u.id} className="tile bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 text-lg">Unit {u.unitNumber}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[String(u.status)] || 'bg-slate-100 text-slate-600'}`}>
                  {String(u.status || '').toLowerCase()}
                </span>
              </div>
              <div className="text-sm text-slate-600 space-y-0.5">
                <p>{u.bedrooms ?? '—'} bd · {u.bathrooms ?? '—'} ba{u.sqft ? ` · ${u.sqft} sqft` : ''}</p>
                <p>Rent <strong className="text-slate-900">${u.rentAmount ?? '—'}</strong>/mo</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
