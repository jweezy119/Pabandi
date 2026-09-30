import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';
import ClaySelect from '../components/ClaySelect';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Trash2, Edit2, X, Check, Upload, Star, Package } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

const CATEGORIES = [
  { value: 'hair', label: 'Hair & Styling' },
  { value: 'nails', label: 'Nails' },
  { value: 'spa', label: 'Spa & Massage' },
  { value: 'facial', label: 'Facials & Skincare' },
  { value: 'massage', label: 'Massage Therapy' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'repair', label: 'Repair Services' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];

const LOCATION_TYPES = [
  { value: 'on-site', label: 'On-Site' },
  { value: 'in-home', label: 'In-Home' },
  { value: 'remote', label: 'Remote' },
  { value: 'both', label: 'Both' },
];

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  locationType: string;
  discountPrice: number | null;
  tags: string[];
}

export default function ServiceCatalogPage() {
  const { user } = useAuthStore();
  const businessId = (user as any)?.business?.id || localStorage.getItem('businessId') || '';
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Service>>({});
  const [tagInput, setTagInput] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadServices(); }, [businessId]);

  const loadServices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/businesses/${businessId}/services`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setServices(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('Name and price required'); return; }
    setSaving(true);
    try {
      const url = editing
        ? `${API_BASE}/api/v1/businesses/${businessId}/services/${editing.id}`
        : `${API_BASE}/api/v1/businesses/${businessId}/services`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price as unknown as string) || 0,
          duration: parseInt(form.duration as unknown as string) || 60,
          discountPrice: form.discountPrice ? parseFloat(form.discountPrice as unknown as string) : null,
        }),
      });
      if (res.ok) {
        toast.success(editing ? 'Service updated' : 'Service added');
        setShowForm(false);
        setEditing(null);
        setForm({});
        loadServices();
      } else {
        toast.error('Save failed');
      }
    } catch (err) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/businesses/${businessId}/services/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      toast.success('Service removed');
      loadServices();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleEdit = (service: Service) => {
    setEditing(service);
    setForm(service);
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm((f) => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }));
    setTagInput('');
  };

  const removeTag = (index: number) => {
    setForm((f) => ({ ...f, tags: (f.tags || []).filter((_, i) => i !== index) }));
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Service Catalog</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage your services with categories, images, and variants</p>
          </div>
          <Button variant="primary" onClick={() => { setEditing(null); setForm({ duration: 60, isActive: true, tags: [], locationType: 'on-site' }); setShowForm(true); }}>
            <Plus size={16} /> Add Service
          </Button>
        </div>

        {showForm && (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">
                {editing ? 'Edit Service' : 'New Service'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null); setForm({}); }} className="p-1 hover:bg-[var(--warm-sand)] rounded">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Service Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <ClaySelect
                label="Category"
                value={form.category || ''}
                onChange={(v) => setForm({ ...form, category: v })}
                options={CATEGORIES}
                placeholder="Select category..."
              />
            </div>

            <Input label="Description" textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input label="Price ($)" type="number" value={form.price?.toString() || ''} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} required />
              <Input label="Discount ($)" type="number" value={form.discountPrice?.toString() || ''} onChange={(e) => setForm({ ...form, discountPrice: e.target.value ? parseFloat(e.target.value) : null })} />
              <Input label="Duration (min)" type="number" value={form.duration?.toString() || '60'} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })} />
              <ClaySelect
                label="Location"
                value={form.locationType || 'on-site'}
                onChange={(v) => setForm({ ...form, locationType: v })}
                options={LOCATION_TYPES}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--warm-ink)] block mb-2">Service Image</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--soft-stone)]">
                      <Upload size={18} />
                    </div>
                  )}
                </div>
                <Button variant="ghost" onClick={() => imageInputRef.current?.click()}>
                  Upload Image
                </Button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
            </div>

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
                {(form.tags || []).map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--warm-sand)]/50 text-[var(--warm-ink)]">
                    {tag}
                    <button onClick={() => removeTag(i)} className="hover:text-red-400"><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--warm-ink)]">
                <input type="checkbox" checked={form.isActive !== false} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-[rgba(191,179,163,0.3)]" />
                Active
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditing(null); setForm({}); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Service'}</Button>
            </div>
          </Card>
        )}

        <div className="space-y-3">
          {services.length === 0 ? (
            <Card className="text-center py-12">
              <Package size={40} className="mx-auto text-[var(--soft-stone)] mb-3" />
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline">No services yet</h3>
              <p className="text-sm text-[var(--soft-stone)] mt-1">Add your first service to start booking</p>
            </Card>
          ) : (
            services.map(service => (
              <Card key={service.id} className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] shrink-0">
                  {service.imageUrl ? (
                    <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--soft-stone)]">
                      <Package size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--warm-ink)] truncate">{service.name}</h3>
                    {service.discountPrice && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--sage)]/15 text-[var(--sage)]">SALE</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--soft-stone)] truncate">{service.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--soft-stone)]">
                    <span className="font-semibold text-[var(--clay)]">
                      ${service.discountPrice || service.price}
                      {service.discountPrice && <span className="line-through ml-1 text-[var(--soft-stone)]">${service.price}</span>}
                    </span>
                    <span>{service.duration} min</span>
                    {service.category && <span className="capitalize">{service.category}</span>}
                    {!service.isActive && <span className="text-[var(--dusty-rose)]">Inactive</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleEdit(service)} className="p-2 hover:bg-[var(--warm-sand)] rounded-lg transition-colors">
                    <Edit2 size={16} className="text-[var(--soft-stone)]" />
                  </button>
                  <button onClick={() => handleDelete(service.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
