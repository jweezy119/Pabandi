import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';

const navItems = [
  { path: '/contact/settings', label: 'Back to Settings', icon: 'arrow_back' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function CustomFieldsPage() {
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
      alert('Custom fields saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving custom fields');
    }
  };

  const addField = (entity: string) => {
    const updated = { ...config };
    if (!updated.enabledFeatures) updated.enabledFeatures = {};
    if (!updated.enabledFeatures.customFields) updated.enabledFeatures.customFields = {};
    if (!updated.enabledFeatures.customFields[entity]) updated.enabledFeatures.customFields[entity] = [];
    
    updated.enabledFeatures.customFields[entity].push({
      id: Math.random().toString(36).substring(7),
      name: 'New Field',
      type: 'text',
      required: false,
      showInList: true
    });
    setConfig(updated);
  };

  const updateField = (entity: string, index: number, field: any) => {
    const updated = { ...config };
    updated.enabledFeatures.customFields[entity][index] = field;
    setConfig(updated);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const entities = ['Client', 'Deal', 'Job', 'Invoice'];
  const fieldsConfig = config.enabledFeatures?.customFields || {};

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Custom Fields</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Define custom fields per entity</p>
          </div>
          <Button variant="primary" onClick={() => saveConfig(config)}>Save Changes</Button>
        </div>

        {entities.map(entity => (
          <Card key={entity} padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--warm-ink)]">{entity} Fields</h3>
              <Button variant="ghost" icon="add" onClick={() => addField(entity)}>Add Field</Button>
            </div>
            
            <div className="space-y-3">
              {(fieldsConfig[entity] || []).map((field: any, idx: number) => (
                <div key={field.id} className="flex gap-4 items-center bg-[var(--warm-sand)]/20 p-3 rounded-lg border border-[var(--warm-sand)]">
                  <input 
                    className="flex-1 px-3 py-2 border rounded-lg" 
                    value={field.name}
                    onChange={e => updateField(entity, idx, { ...field, name: e.target.value })}
                  />
                  <select 
                    className="px-3 py-2 border rounded-lg"
                    value={field.type}
                    onChange={e => updateField(entity, idx, { ...field, type: e.target.value })}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Checkbox</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={field.required}
                      onChange={e => updateField(entity, idx, { ...field, required: e.target.checked })}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={field.showInList}
                      onChange={e => updateField(entity, idx, { ...field, showInList: e.target.checked })}
                    />
                    Show in List
                  </label>
                  <Button variant="ghost" onClick={() => {
                    const updated = { ...config };
                    updated.enabledFeatures.customFields[entity].splice(idx, 1);
                    setConfig(updated);
                  }}>
                    <span className="material-symbols-outlined text-[var(--rose)]">delete</span>
                  </Button>
                </div>
              ))}
              {(!fieldsConfig[entity] || fieldsConfig[entity].length === 0) && (
                <p className="text-sm text-[var(--soft-stone)] italic">No custom fields defined for {entity}.</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
