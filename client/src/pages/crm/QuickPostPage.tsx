import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Card } from '../../components/primitives';
import { Input } from '../../components/primitives/Input';
import ClaySelect from './components/ClaySelect';
import { useAuthStore } from '../../store/authStore';
import {
  Zap, Calendar, DollarSign, Clock, Image, Tag, Check,
  ArrowRight, Sparkles, Package
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

const CATEGORIES = [
  { value: 'hair', label: 'Hair & Styling' },
  { value: 'nails', label: 'Nails' },
  { value: 'spa', label: 'Spa & Massage' },
  { value: 'facial', label: 'Facials & Skincare' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'repair', label: 'Repair Services' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];

const DURATIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
];

export default function QuickPostPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const businessId = (user as any)?.business?.id || localStorage.getItem('businessId') || '';
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    duration: 60,
    category: '',
    imageUrl: '',
    tags: [] as string[],
    discountPrice: '',
    locationType: 'on-site',
    maxBookingsPerDay: 10,
    bookingLeadTime: 24,
  });
  const [tagInput, setTagInput] = useState('');

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('Name and price required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/businesses/${businessId}/services`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          duration: form.duration,
          category: form.category || null,
          imageUrl: form.imageUrl || null,
          tags: form.tags,
          discountPrice: form.discountPrice ? parseFloat(form.discountPrice) : null,
          locationType: form.locationType,
          maxBookingsPerDay: form.maxBookingsPerDay,
          bookingLeadTime: form.bookingLeadTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Service published!');
        setStep(3);
      } else {
        toast.error(data.error || 'Failed to publish');
      }
    } catch (err) {
      toast.error('Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm((f) => ({ ...f, tags: [...f.tags, tagInput.trim()] }));
    setTagInput('');
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Quick Post</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Turn any service into a bookable listing in seconds</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-[var(--clay)]" />
                <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Service Details</h2>
              </div>
              <Input label="Service Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Signature Haircut" required />
              <Input label="Description" textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's included?" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Price ($)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                <Input label="Discount Price ($)" type="number" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: e.target.value })} placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ClaySelect
                  label="Duration"
                  value={form.duration.toString()}
                  onChange={(v) => setForm({ ...form, duration: parseInt(v) })}
                  options={DURATIONS.map(d => ({ value: d.value.toString(), label: d.label }))}
                />
                <ClaySelect
                  label="Category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  options={CATEGORIES}
                  placeholder="Select..."
                />
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <Image size={18} className="text-[var(--clay)]" />
                <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Image & Tags</h2>
              </div>
              <Input label="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-2">Tags</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..."
                    className="flex-1 px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                  />
                  <Button variant="ghost" onClick={addTag}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--warm-sand)]/50 text-[var(--warm-ink)]">
                      <Tag size={10} /> {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-[var(--clay)]" />
                <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Availability</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Max bookings/day" type="number" value={form.maxBookingsPerDay.toString()} onChange={(e) => setForm({ ...form, maxBookingsPerDay: parseInt(e.target.value) })} />
                <Input label="Lead time (hours)" type="number" value={form.bookingLeadTime.toString()} onChange={(e) => setForm({ ...form, bookingLeadTime: parseInt(e.target.value) })} />
              </div>
              <ClaySelect
                label="Location Type"
                value={form.locationType}
                onChange={(v) => setForm({ ...form, locationType: v })}
                options={[
                  { value: 'on-site', label: 'On-Site' },
                  { value: 'in-home', label: 'In-Home' },
                  { value: 'remote', label: 'Remote' },
                  { value: 'both', label: 'Both' },
                ]}
              />
            </Card>

            <Button onClick={() => setStep(2)} className="w-full">
              Preview & Publish <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-[var(--clay)]" />
                <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Preview</h2>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.2)]">
                <div className="flex items-start gap-4">
                  {form.imageUrl && (
                    <img src={form.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[var(--warm-ink)]">{form.name}</h3>
                    <p className="text-sm text-[var(--soft-stone)]">{form.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-lg font-bold text-[var(--clay)]">
                        ${form.discountPrice || form.price}
                        {form.discountPrice && <span className="line-through ml-1 text-sm text-[var(--soft-stone)]">${form.price}</span>}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-[var(--soft-stone)]">
                        <Clock size={12} /> {form.duration} min
                      </span>
                    </div>
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--warm-sand)]/50 text-[var(--warm-ink)]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <div className="p-4 rounded-2xl bg-[var(--sage)]/5 border border-[var(--sage)]/15">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-[var(--sage)]" />
                <span className="text-sm font-medium text-[var(--warm-ink)]">Ready to publish</span>
              </div>
              <p className="text-xs text-[var(--soft-stone)] mt-1">
                This service will be immediately bookable. Customers can find it through search and book directly.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Publishing...' : 'Publish Service'}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--sage)]/20 flex items-center justify-center mx-auto">
              <Check size={32} className="text-[var(--sage)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Service Published!</h2>
            <p className="text-[var(--soft-stone)]">Your service is now live and bookable.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" onClick={() => { setStep(1); setForm({ name: '', description: '', price: '', duration: 60, category: '', imageUrl: '', tags: [], discountPrice: '', locationType: 'on-site', maxBookingsPerDay: 10, bookingLeadTime: 24 }); }}>
                Post Another
              </Button>
              <Button onClick={() => navigate('/contact/settings/services')}>
                View Catalog
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
