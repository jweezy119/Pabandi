import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';
import ClaySelect from '../components/ClaySelect';
import { useAuthStore } from '../../../store/authStore';
import { Camera, MapPin, Clock, Shield, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

const SERVICE_TYPES = [
  { value: 'salon', label: 'Salon & Spa' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'trades', label: 'Trades & Home Services' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'logistics', label: 'Logistics & Freight' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'general', label: 'General Services' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function BusinessProfilePage() {
  const { user } = useAuthStore();
  const businessId = (user as any)?.business?.id || localStorage.getItem('businessId') || '';
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (businessId) loadProfile();
  }, [businessId]);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/profile?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) setProfile(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/v1/settings/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, data: profile })
      });
      toast.success('Profile saved');
    } catch (err) {
      toast.error('Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setProfile((p: any) => ({ ...p, logoUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setProfile((p: any) => ({ ...p, coverImageUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const updateHours = (day: string, field: string, value: string) => {
    const hours = { ...(profile.businessHours || {}) };
    hours[day] = { ...hours[day], [field]: value };
    setProfile((p: any) => ({ ...p, businessHours: hours }));
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Business Profile</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Core business details, branding, and service area</p>
          </div>
          <Button variant="primary" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <Card className="space-y-5">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Branding</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--warm-ink)] block mb-2">Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]">
                  {profile.logoUrl ? (
                    <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--soft-stone)]">
                      <Camera size={20} />
                    </div>
                  )}
                </div>
                <Button variant="ghost" onClick={() => logoInputRef.current?.click()}>
                  Upload
                </Button>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--warm-ink)] block mb-2">Cover Image</label>
              <div className="flex items-center gap-3">
                <div className="w-24 h-14 rounded-xl overflow-hidden border-2 border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]">
                  {profile.coverImageUrl ? (
                    <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--soft-stone)]">
                      <Camera size={18} />
                    </div>
                  )}
                </div>
                <Button variant="ghost" onClick={() => coverInputRef.current?.click()}>
                  Upload
                </Button>
                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Business Details</h2>
          <Input label="Business Name" value={profile.businessName || ''} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Owner Name" value={profile.ownerName || ''} onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })} />
            <Input label="Contact Email" type="email" value={profile.ownerEmail || ''} onChange={(e) => setProfile({ ...profile, ownerEmail: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone Number" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <ClaySelect
              label="Service Type"
              value={profile.serviceType || ''}
              onChange={(v) => setProfile({ ...profile, serviceType: v })}
              options={SERVICE_TYPES}
              placeholder="Select type..."
            />
          </div>
          <Input label="Address" value={profile.address || ''} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--clay)]" />
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Business Hours</h2>
          </div>
          <div className="space-y-2">
            {DAYS.map(day => {
              const hours = profile.businessHours?.[day] || { open: '09:00', close: '17:00', closed: false };
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--warm-ink)] w-24">{day}</span>
                  <label className="flex items-center gap-2 text-xs text-[var(--soft-stone)]">
                    <input
                      type="checkbox"
                      checked={hours.closed}
                      onChange={(e) => updateHours(day, 'closed', e.target.checked)}
                      className="rounded border-[rgba(191,179,163,0.3)]"
                    />
                    Closed
                  </label>
                  {!hours.closed && (
                    <>
                      <input
                        type="time"
                        value={hours.open}
                        onChange={(e) => updateHours(day, 'open', e.target.value)}
                        className="px-2 py-1 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                      />
                      <span className="text-[var(--soft-stone)]">to</span>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={(e) => updateHours(day, 'close', e.target.value)}
                        className="px-2 py-1 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-[var(--clay)]" />
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Service Area</h2>
          </div>
          <Input label="Service Address" value={profile.serviceAddress || ''} onChange={(e) => setProfile({ ...profile, serviceAddress: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Radius (miles)" type="number" value={profile.serviceRadiusMiles || 25} onChange={(e) => setProfile({ ...profile, serviceRadiusMiles: parseFloat(e.target.value) })} />
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-[var(--warm-ink)] pb-2">
                <input
                  type="checkbox"
                  checked={profile.travelFeeEnabled || false}
                  onChange={(e) => setProfile({ ...profile, travelFeeEnabled: e.target.checked })}
                  className="rounded border-[rgba(191,179,163,0.3)]"
                />
                Travel fee
              </label>
            </div>
          </div>
          {profile.travelFeeEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Fee per mile ($)" type="number" step="0.01" value={profile.travelFeePerMile || 0.5} onChange={(e) => setProfile({ ...profile, travelFeePerMile: parseFloat(e.target.value) })} />
              <Input label="Max travel (minutes)" type="number" value={profile.maxTravelMinutes || 45} onChange={(e) => setProfile({ ...profile, maxTravelMinutes: parseInt(e.target.value) })} />
            </div>
          )}
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[var(--sage)]" />
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Public Trust Profile</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--warm-ink)]">Public trust profile enabled</p>
              <p className="text-xs text-[var(--soft-stone)]">Allow anyone with the link to see your trust scores</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={profile.trustProfilePublic !== false} onChange={(e) => setProfile({ ...profile, trustProfilePublic: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-[#BFB3A3] peer-checked:bg-[#A85A3C] rounded-full peer-focus:ring-2 peer-focus:ring-[#A85A3C]/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>
          {profile.passportId && (
            <>
              <div>
                <p className="text-sm font-semibold mb-2 text-[var(--warm-ink)]">Embed Badge</p>
                <div className="p-3 rounded-xl border border-[var(--warm-sand)] bg-[#FAFAF7] overflow-x-auto">
                  <code className="text-xs text-[var(--soft-stone)] break-all select-all">
                    {`<img src="https://pabandi.com/api/v1/badge/${profile.passportId}.svg" alt="Pabandi Trust Badge" width="240" height="64" />`}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`<img src="https://pabandi.com/api/v1/badge/${profile.passportId}.svg" alt="Pabandi Trust Badge" width="240" height="64" />`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Embed Code'}
                </Button>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2 text-[var(--warm-ink)]">Badge Preview</p>
                <div className="p-4 rounded-xl bg-[#F5EFE6] inline-block">
                  <img src={`${API_BASE}/api/v1/badge/${profile.passportId}.svg`} alt="Pabandi Trust Badge preview" width={240} height={64} />
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
