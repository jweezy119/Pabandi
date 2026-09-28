import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function ServiceCatalogPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) loadConfig();
  }, [businessId]);

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/config?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) setConfig(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: any) => {
    try {
      await fetch(`${API_BASE}/api/v1/settings/config`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, data: { enabledFeatures: newConfig.enabledFeatures } })
      });
      setConfig(newConfig);
      alert('Service catalog saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving service catalog');
    }
  };

  const getServices = () => {
    return config.enabledFeatures?.services || [];
  };

  const setServices = (services: any[]) => {
    const updated = { ...config };
    if (!updated.enabledFeatures) updated.enabledFeatures = {};
    updated.enabledFeatures.services = services;
    setConfig(updated);
  };

  const addService = () => {
    setServices([...getServices(), { id: Math.random().toString(36).substring(7), name: 'New Service', price: 0, duration: 60, category: 'General', description: '' }]);
  };

  const updateService = (index: number, data: any) => {
    const services = [...getServices()];
    services[index] = { ...services[index], ...data };
    setServices(services);
  };

  const removeService = (index: number) => {
    const services = [...getServices()];
    services.splice(index, 1);
    setServices(services);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  const services = getServices();

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Service Catalog</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage your offered services and pricing</p>
          </div>
          <Button variant="primary" onClick={() => saveConfig(config)}>Save Changes</Button>
        </div>

        <Card padding="lg" className="space-y-4">
          <div className="space-y-3">
            {services.map((svc: any, idx: number) => (
              <div key={svc.id} className="flex flex-col gap-2 bg-[var(--warm-sand)]/20 p-4 rounded-lg border border-[var(--warm-sand)]">
                <div className="flex gap-4 items-center">
                  <input 
                    className="flex-[2] px-3 py-2 border rounded-lg font-bold" 
                    value={svc.name}
                    onChange={e => updateService(idx, { name: e.target.value })}
                    placeholder="Service Name"
                  />
                  <input 
                    className="flex-1 px-3 py-2 border rounded-lg" 
                    value={svc.category}
                    onChange={e => updateService(idx, { category: e.target.value })}
                    placeholder="Category"
                  />
                  <div className="flex items-center gap-1 w-24">
                    <span className="text-[var(--soft-stone)]">$</span>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg text-right" 
                      value={svc.price}
                      onChange={e => updateService(idx, { price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-1 w-24">
                    <input 
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg text-right" 
                      value={svc.duration}
                      onChange={e => updateService(idx, { duration: parseInt(e.target.value, 10) || 0 })}
                    />
                    <span className="text-xs text-[var(--soft-stone)]">min</span>
                  </div>
                  <Button variant="ghost" onClick={() => removeService(idx)}>
                    <span className="material-symbols-outlined text-[var(--rose)]">delete</span>
                  </Button>
                </div>
                <input 
                  className="w-full px-3 py-2 border rounded-lg text-sm text-[var(--soft-stone)] bg-white" 
                  value={svc.description}
                  onChange={e => updateService(idx, { description: e.target.value })}
                  placeholder="Service description..."
                />
              </div>
            ))}
            {services.length === 0 && (
              <p className="text-sm text-[var(--soft-stone)] italic text-center py-4">No services defined. Add one below.</p>
            )}
          </div>
          <div className="pt-2">
            <Button variant="ghost" icon="add" onClick={addService}>Add Service</Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
