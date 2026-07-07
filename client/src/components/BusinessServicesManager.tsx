import { useState, useEffect } from 'react';
import { businessService as apiBusinessService } from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface BusinessService {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  isActive: boolean;
}

export default function BusinessServicesManager({ businessId }: { businessId: string }) {
  const [services, setServices] = useState<BusinessService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    isActive: true
  });

  useEffect(() => {
    fetchServices();
  }, [businessId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await apiBusinessService.getServices(businessId);
      if (res.data.success) {
        setServices(res.data.data.services);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        duration: parseInt(form.duration),
        isActive: form.isActive
      };

      if (isEditing) {
        await apiBusinessService.updateService(businessId, isEditing, payload);
      } else {
        await apiBusinessService.createService(businessId, payload);
      }
      
      resetForm();
      fetchServices();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save service');
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await apiBusinessService.deleteService(businessId, serviceId);
      fetchServices();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete service');
    }
  };

  const startEdit = (service: BusinessService) => {
    setIsEditing(service.id);
    setForm({
      name: service.name,
      description: service.description || '',
      price: service.price.toString(),
      duration: service.duration.toString(),
      isActive: service.isActive
    });
  };

  const resetForm = () => {
    setIsEditing(null);
    setForm({
      name: '',
      description: '',
      price: '',
      duration: '',
      isActive: true
    });
  };

  if (loading && services.length === 0) {
    return <div className="p-4 text-center">Loading services...</div>;
  }

  return (
    <div className="bg-white/10 border border-white/10 rounded-2xl p-6 backdrop-blur-lg">
      <h2 className="text-xl font-bold text-white mb-6">Service Catalog</h2>
      
      {error && (
        <div className="bg-red-500/20 text-red-300 p-4 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Service List */}
      <div className="space-y-4 mb-8">
        {services.map(service => (
          <div key={service.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                {service.name} 
                {!service.isActive && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">Inactive</span>}
              </h3>
              <p className="text-sm text-gray-400 mt-1">{service.description || 'No description'}</p>
              <div className="flex gap-4 mt-2 text-sm text-indigo-300">
                <span>${service.price.toFixed(2)}</span>
                <span>{service.duration} mins</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(service)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors">
                <PencilIcon className="h-5 w-5" />
              </button>
              <button onClick={() => handleDelete(service.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors">
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No services added yet. Create one below to start offering specific bookings!
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {isEditing ? 'Edit Service' : 'Add New Service'}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Service Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Premium Haircut"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Price ($)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => setForm({...form, price: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="30.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Duration (minutes)</label>
              <input
                type="number"
                required
                min="5"
                step="5"
                value={form.duration}
                onChange={e => setForm({...form, duration: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="45"
              />
            </div>
            <div className="flex items-center mt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={form.isActive}
                  onChange={e => setForm({...form, isActive: e.target.checked})}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                <span className="ml-3 text-sm font-medium text-gray-300">Active (Visible to customers)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              placeholder="Briefly describe this service..."
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {isEditing ? <PencilIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
              {isEditing ? 'Save Changes' : 'Add Service'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
