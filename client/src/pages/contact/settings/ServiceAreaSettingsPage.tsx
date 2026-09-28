import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiMap, FiDollarSign, FiClock, FiSave, FiPlus, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import apiClient from '@/services/api';
import { Surface, Button, tokens } from '@/design-system';
import { Input } from '@/components/primitives/Input';
import toast from 'react-hot-toast';

export default function ServiceAreaSettingsPage() {
  const navigate = useNavigate();
  const { settings, saveSettings } = useBusinessSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<Array<{ formatted: string; lat: number; lng: number }>>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const [formData, setFormData] = useState({
    serviceAddress: '',
    serviceLat: '',
    serviceLng: '',
    serviceRadiusMiles: '25',
    travelFeeEnabled: false,
    travelFeePerMile: '0.50',
    maxTravelMinutes: '45',
  });

  useEffect(() => {
    loadServiceArea();
  }, []);

  const loadServiceArea = async () => {
    try {
      const businessId = localStorage.getItem('businessId');
      if (!businessId) return;

      const res = await apiClient.get(`/api/v1/service-area?businessId=${businessId}`);
      if (res.data.success) {
        const data = res.data.data;
        setFormData({
          serviceAddress: data.serviceAddress || '',
          serviceLat: data.serviceLat?.toString() || '',
          serviceLng: data.serviceLng?.toString() || '',
          serviceRadiusMiles: data.serviceRadiusMiles?.toString() || '25',
          travelFeeEnabled: data.travelFeeEnabled || false,
          travelFeePerMile: data.travelFeePerMile?.toString() || '0.50',
          maxTravelMinutes: data.maxTravelMinutes?.toString() || '45',
        });
      }
    } catch (e) {
      console.error('Failed to load service area', e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, serviceAddress: value }));

    if (value.length > 3) {
      try {
        const res = await apiClient.post('/api/v1/service-area/autocomplete', { input: value });
        if (res.data.success) {
          setAutocompleteResults(res.data.data);
          setShowAutocomplete(true);
        }
      } catch (err) {
        console.error('Autocomplete error', err);
      }
    } else {
      setShowAutocomplete(false);
      setAutocompleteResults([]);
    }
  };

  const selectAutocomplete = (result: { formatted: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      serviceAddress: result.formatted,
      serviceLat: result.lat.toString(),
      serviceLng: result.lng.toString(),
    }));
    setShowAutocomplete(false);
    setAutocompleteResults([]);
  };

  const handleGeocode = async () => {
    if (!formData.serviceAddress) return;
    setGeocoding(true);
    try {
      const res = await apiClient.post('/api/v1/service-area/geocode', { address: formData.serviceAddress });
      if (res.data.success) {
        const data = res.data.data;
        setFormData(prev => ({
          ...prev,
          serviceLat: data.lat.toString(),
          serviceLng: data.lng.toString(),
          serviceAddress: data.formatted,
        }));
        toast.success('Address geocoded successfully');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const businessId = localStorage.getItem('businessId');
      await apiClient.put('/api/v1/service-area', { businessId, ...formData });
      await saveSettings({ enabledFeatures: { ...settings.enabledFeatures, contact: { ...settings.enabledFeatures?.contact, serviceArea: true } } });
      toast.success('Service area saved');
      loadServiceArea();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getMapUrl = async () => {
    try {
      const businessId = localStorage.getItem('businessId');
      const res = await apiClient.get(`/api/v1/service-area/map?businessId=${businessId}`);
      return res.data.success ? res.data.data.mapUrl : null;
    } catch (e) {
      return null;
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--warm-ink)]">Service Area</h1>
          <p className="text-[var(--soft-stone)] mt-1">Configure where you serve customers and travel fees</p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <FiSave className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Address & Geocoding */}
      <Surface className="p-6">
        <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4 flex items-center gap-2">
          <FiMapPin className="w-5 h-5" /> Service Address
        </h2>
        <div className="relative">
          <Input
            label="Service Address"
            value={formData.serviceAddress}
            onChange={handleAddressChange}
            placeholder="Enter your service address (e.g. 123 Main St, Chicago, IL)"
          />
          {showAutocomplete && autocompleteResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[rgba(191,179,163,0.3)] rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
              {autocompleteResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => selectAutocomplete(result)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--warm-sand)] transition-colors"
                >
                  <p className="font-medium text-[var(--warm-ink)]">{result.formatted}</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Button variant="secondary" onClick={handleGeocode} disabled={geocoding || !formData.serviceAddress}>
              <FiRefreshCw className={`w-4 h-4 mr-2 ${geocoding ? 'animate-spin' : ''}`} />
              {geocoding ? 'Geocoding...' : 'Geocode Address'}
            </Button>
            {formData.serviceLat && formData.serviceLng && (
              <span className="text-sm text-[var(--soft-stone)]">
                Lat: {parseFloat(formData.serviceLat).toFixed(6)}, Lng: {parseFloat(formData.serviceLng).toFixed(6)}
              </span>
            )}
          </div>
        </div>
      </Surface>

      {/* Map Preview */}
      <Surface className="p-6">
        <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4 flex items-center gap-2">
          <FiMap className="w-5 h-5" /> Service Area Map
        </h2>
        <MapPreview
          address={formData.serviceAddress}
          lat={formData.serviceLat ? parseFloat(formData.serviceLat) : null}
          lng={formData.serviceLng ? parseFloat(formData.serviceLng) : null}
          radius={parseFloat(formData.serviceRadiusMiles) || 25}
        />
      </Surface>

      {/* Radius & Travel Settings */}
      <Surface className="p-6">
        <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-6 flex items-center gap-2">
          <FiMap className="w-5 h-5" /> Service Radius & Travel
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--soft-stone)] mb-1">Service Radius (miles)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="100"
                value={formData.serviceRadiusMiles}
                onChange={e => handleChange('serviceRadiusMiles', e.target.value)}
                className="flex-1 h-2 bg-[var(--warm-sand)] rounded-lg appearance-none accent-[var(--clay)]"
              />
              <input
                type="number"
                min="5"
                max="100"
                value={formData.serviceRadiusMiles}
                onChange={e => handleChange('serviceRadiusMiles', e.target.value)}
                className="w-20 px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)] text-center"
              />
            </div>
            <p className="text-xs text-[var(--soft-stone)] mt-1">Customers within this radius can book</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--soft-stone)] mb-1">Max Travel Time (minutes)</label>
            <input
              type="number"
              min="15"
              max="120"
              value={formData.maxTravelMinutes}
              onChange={e => handleChange('maxTravelMinutes', e.target.value)}
              className="w-full px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)]"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[rgba(191,179,163,0.3)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--warm-ink)]">Travel Fee</h3>
              <p className="text-sm text-[var(--soft-stone)]">Charge customers for travel beyond your base area</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.travelFeeEnabled}
                onChange={e => handleChange('travelFeeEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--soft-stone)]/30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--clay)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--clay)]"></div>
            </label>
          </div>

          {formData.travelFeeEnabled && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--soft-stone)] mb-1">Fee per Mile ($)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.25"
                  value={formData.travelFeePerMile}
                  onChange={e => handleChange('travelFeePerMile', e.target.value)}
                  className="w-full px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)]"
                />
              </div>
              <div className="flex items-end">
                <p className="text-sm text-[var(--soft-stone)]">
                  Example: 10 miles × ${formData.travelFeePerMile} = ${(10 * parseFloat(formData.travelFeePerMile)).toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}

function MapPreview({ address, lat, lng, radius }: { address: string; lat: number | null; lng: number | null; radius: number }) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMap = async () => {
      if (!lat || !lng) return;
      setLoading(true);
      try {
        const res = await apiClient.get(`/api/v1/service-area/map?businessId=${localStorage.getItem('businessId')}`);
        if (res.data.success) {
          setMapUrl(res.data.data.mapUrl);
        }
      } catch (e) {
        console.error('Failed to load map', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMap();
  }, [lat, lng, radius]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)]">
      {mapUrl ? (
        <img src={mapUrl} alt="Service area map" className="w-full h-64 object-cover" />
      ) : (
        <div className="w-full h-64 flex flex-col items-center justify-center text-[var(--soft-stone)]">
          <FiMap className="w-12 h-12 mb-2 opacity-50" />
          <p>{address ? 'Geocode address to see map preview' : 'Enter address to see map preview'}</p>
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--clay)] border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}

