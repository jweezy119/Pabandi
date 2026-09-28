import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiClock, FiX, FiCheck, FiSave, FiCopy } from 'react-icons/fi';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import apiClient from '@/services/api';
import { Surface, Button, Input, Chip, tokens } from '@/design-system';
import toast from 'react-hot-toast';

const DAYS = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
];

interface AvailabilityItem {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
}

interface BlackoutItem {
  id?: string;
  date: string;
  reason: string;
}

export default function AvailabilitySettingsPage() {
  const navigate = useNavigate();
  const { settings, saveSettings } = useBusinessSettings();
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BlackoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddBlackout, setShowAddBlackout] = useState(false);
  const [newBlackout, setNewBlackout] = useState({ date: '', reason: '' });

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const businessId = localStorage.getItem('businessId');
      if (!businessId) return;

      const [availRes, blackoutRes] = await Promise.all([
        apiClient.get(`/api/v1/booking-availability?businessId=${businessId}`),
        apiClient.get(`/api/v1/booking-availability/blackout?businessId=${businessId}`),
      ]);

      if (availRes.data.success) {
        // Ensure all 7 days exist
        const fullAvailability = DAYS.map(day => {
          const existing = availRes.data.data.find((a: any) => a.dayOfWeek === day.value);
          return existing || { dayOfWeek: day.value, startTime: '09:00', endTime: '17:00', slotMinutes: 60, bufferMinutes: 15, isActive: false };
        });
        setAvailability(fullAvailability);
      }
      if (blackoutRes.data.success) {
        setBlackoutDates(blackoutRes.data.data.map((b: any) => ({ id: b.id, date: b.date.split('T')[0], reason: b.reason || '' })));
      }
    } catch (e) {
      console.error('Failed to load availability', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityChange = (dayOfWeek: number, field: keyof AvailabilityItem, value: any) => {
    setAvailability(prev => prev.map(a => a.dayOfWeek === dayOfWeek ? { ...a, [field]: value } : a));
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      const businessId = localStorage.getItem('businessId');
      if (!businessId) throw new Error('No business');

      for (const a of availability) {
        await apiClient.post('/api/v1/booking-availability', { businessId, ...a });
      }

      // Save public booking enabled setting
      await saveSettings({ enabledFeatures: { ...settings.enabledFeatures, contact: { ...settings.enabledFeatures?.contact, publicBooking: true } } });

      toast.success('Availability saved');
      loadAvailability();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addBlackout = async () => {
    if (!newBlackout.date) return;
    try {
      const businessId = localStorage.getItem('businessId');
      await apiClient.post('/api/v1/booking-availability/blackout', { businessId, date: newBlackout.date, reason: newBlackout.reason });
      toast.success('Blackout date added');
      setShowAddBlackout(false);
      setNewBlackout({ date: '', reason: '' });
      loadAvailability();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to add');
    }
  };

  const removeBlackout = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/booking-availability/blackout/${id}`);
      toast.success('Removed');
      loadAvailability();
    } catch (e: any) {
      toast.error('Failed to remove');
    }
  };

  const getEmbedCode = () => {
    const slug = settings.businessSlug || '';
    return `<script src="${window.location.origin}/embed/${slug}.js"></script>`;
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--warm-ink)]">Booking Availability</h1>
          <p className="text-[var(--soft-stone)] mt-1">Configure when customers can book and block off unavailable dates</p>
        </div>
        <Button variant="primary" onClick={saveAvailability} disabled={saving}>
          <FiSave className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Weekly Schedule */}
      <Surface className="p-6">
        <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-6">Weekly Schedule</h2>
        <div className="space-y-3">
          {availability.map(day => (
            <div key={day.dayOfWeek} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.2)]">
              <div className="w-16 flex-shrink-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={day.isActive}
                    onChange={e => handleAvailabilityChange(day.dayOfWeek, 'isActive', e.target.checked)}
                    className="w-5 h-5 rounded border-[var(--clay)] text-[var(--clay)] focus:ring-[var(--clay)]"
                  />
                  <span className="font-semibold text-[var(--warm-ink)]">{day.full}</span>
                </label>
              </div>

              {day.isActive && (
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">Start</label>
                    <input
                      type="time"
                      value={day.startTime}
                      onChange={e => handleAvailabilityChange(day.dayOfWeek, 'startTime', e.target.value)}
                      className="w-32 px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">End</label>
                    <input
                      type="time"
                      value={day.endTime}
                      onChange={e => handleAvailabilityChange(day.dayOfWeek, 'endTime', e.target.value)}
                      className="w-32 px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">Slot (min)</label>
                    <input
                      type="number"
                      value={day.slotMinutes}
                      onChange={e => handleAvailabilityChange(day.dayOfWeek, 'slotMinutes', parseInt(e.target.value) || 60)}
                      min="15" max="240" step="15"
                      className="w-28 px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--soft-stone)] mb-1">Buffer (min)</label>
                    <input
                      type="number"
                      value={day.bufferMinutes}
                      onChange={e => handleAvailabilityChange(day.dayOfWeek, 'bufferMinutes', parseInt(e.target.value) || 15)}
                      min="0" max="60" step="5"
                      className="w-28 px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)] text-sm"
                    />
                  </div>
                </div>
              )}

              {!day.isActive && (
                <span className="text-sm text-[var(--soft-stone)] ml-auto">Closed</span>
              )}
            </div>
          ))}
        </div>
      </Surface>

      {/* Blackout Dates */}
      <Surface className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--warm-ink)]">Blackout Dates</h2>
          <Button variant="ghost" icon="plus" onClick={() => setShowAddBlackout(true)} size="sm">
            Add Blackout Date
          </Button>
        </div>

        {showAddBlackout && (
          <div className="p-4 bg-[var(--warm-sand)]/30 rounded-xl mb-4 flex items-center gap-3 flex-wrap">
            <input
              type="date"
              value={newBlackout.date}
              onChange={e => setNewBlackout({ ...newBlackout, date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)]"
            />
            <input
              type="text"
              value={newBlackout.reason}
              onChange={e => setNewBlackout({ ...newBlackout, reason: e.target.value })}
              placeholder="Reason (optional)"
              className="flex-1 px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-lg bg-[var(--warm-sand)] text-[var(--warm-ink)]"
            />
            <Button variant="primary" size="sm" onClick={addBlackout}><FiCheck className="w-3.5 h-3.5" /> Add</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAddBlackout(false); setNewBlackout({ date: '', reason: '' }); }}><FiX className="w-3.5 h-3.5" /></Button>
          </div>
        )}

        {blackoutDates.length === 0 ? (
          <p className="text-[var(--soft-stone)] italic py-8 text-center">No blackout dates. All scheduled days are available for booking.</p>
        ) : (
          <div className="space-y-2">
            {blackoutDates.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.2)]">
                <div className="flex items-center gap-3">
                  <FiClock className="w-5 h-5 text-[var(--soft-stone)]" />
                  <div>
                    <p className="font-medium text-[var(--warm-ink)]">{new Date(b.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    {b.reason && <p className="text-sm text-[var(--soft-stone)]">{b.reason}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeBlackout(b.id!)}><FiTrash2 className="w-4 h-4 text-[var(--terracotta)]" /></Button>
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* Embed Widget */}
      <Surface className="p-6">
        <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-6">Embed Booking Widget</h2>
        <p className="text-[var(--soft-stone)] mb-4">Add a booking button to your website with one line of code.</p>

        <div className="bg-[var(--warm-sand)]/30 rounded-xl p-4 mb-4 font-mono text-sm text-[var(--warm-ink)] relative">
          <code>{getEmbedCode()}</code>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3"
            onClick={() => { navigator.clipboard.writeText(getEmbedCode()); toast.success('Copied!'); }}
          >
            <FiCopy className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[rgba(191,179,163,0.3)]">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-2">JavaScript Widget</h3>
            <p className="text-sm text-[var(--soft-stone)] mb-3">Auto-resizes, handles payments, works anywhere.</p>
            <code className="text-xs text-[var(--clay)]">{getEmbedCode()}</code>
          </div>
          <div className="p-4 rounded-xl border border-[rgba(191,179,163,0.3)]">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-2">Direct iframe</h3>
            <p className="text-sm text-[var(--soft-stone)] mb-3">Simple embed for static sites.</p>
            <code className="text-xs text-[var(--clay)]"><iframe src="${window.location.origin}/embed/${settings.businessSlug || 'your-slug'}" style="width: 100%; height: 600px; border: none; border-radius: 12px;" allow="payment"></iframe></code>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-[var(--sage)]/10 border border-[var(--sage)]/20">
          <h3 className="font-semibold text-[var(--warm-ink)] mb-2 flex items-center gap-2"><FiCheck className="w-4 h-4 text-[var(--sage)]" /> Widget Features</h3>
          <ul className="text-sm text-[var(--soft-stone)] space-y-1">
            <li>• Auto-resizes to content height</li>
            <li>• Handles deposits & payments securely</li>
            <li>• Shows trust badge & verified reviews</li>
            <li>• Works on any website (WordPress, Webflow, Wix, etc.)</li>
            <li>• Mobile-responsive</li>
          </ul>
        </div>
      </Surface>

      {/* Public Booking Toggle */}
      <Surface className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--warm-ink)]">Public Booking</h2>
            <p className="text-[var(--soft-stone)]">Allow customers to book directly from /b/{settings.businessSlug || 'your-slug'}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabledFeatures?.contact?.publicBooking}
              onChange={e => saveSettings({ enabledFeatures: { ...settings.enabledFeatures, contact: { ...settings.enabledFeatures?.contact, publicBooking: e.target.checked } } })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--soft-stone)]/30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--clay)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--clay)]"></div>
          </label>
        </div>
      </Surface>
    </div>
  );
}