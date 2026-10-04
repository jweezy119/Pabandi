import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthToken } from '../../../utils/authToken';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function CustomFieldsPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) loadConfig();
  }, [businessId]);

  const loadConfig = async () => {
    try {
      // No businessId: the server resolves the tenant from the session now.
      const res = await fetch(`${API_BASE}/api/v1/settings/config`, { headers: getHeaders() });
      if (res.ok) {
        const body = await res.json();
        // The route returns the settings ROW, not a { data } envelope, so there is nothing to
        // unwrap here -- but guard anyway, because the sibling CRM routes DO wrap and a future
        // change to either side would otherwise read as "no custom fields configured".
        setConfig(body?.data ?? body ?? {});
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: any) => {
    try {
      // Sends `customFields` at the TOP level, which is the canonical location
      // (BusinessSettings.customFields). It used to nest the definitions under
      // `enabledFeatures.customFields`, while GET /crm/settings read the column -- so the
      // writer and the reader disagreed and the CRM rendered no custom fields at all.
      //
      // `enabledFeatures` is a feature-flag bag and is not sent: this page has no business
      // rewriting flags, and sending the whole bag it loaded would risk clobbering another
      // page's settings. The server merges that bag rather than replacing it regardless.
      //
      // `businessId` is no longer sent either. The server derives the tenant from the
      // session; it used to be required, and passing one is now ignored.
      const res = await fetch(`${API_BASE}/api/v1/settings/config`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ data: { customFields: newConfig.customFields ?? {} } })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Save failed (${res.status})`);
      }
      setConfig(newConfig);
      alert('Custom fields saved!');
    } catch (err) {
      console.error(err);
      // Previously every failure looked identical to success in the console while the user
      // was told nothing -- and `alert` fired only on a thrown network error, not on a 4xx.
      alert(err instanceof Error ? err.message : 'Error saving custom fields');
    }
  };

  const addField = (entity: string) => {
    const updated = { ...config };
    if (!updated.enabledFeatures) updated.enabledFeatures = {};
    if (!updated.customFields) updated.customFields = {};
    if (!updated.customFields[entity]) updated.customFields[entity] = [];
    
    updated.customFields[entity].push({
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
    updated.customFields[entity][index] = field;
    setConfig(updated);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const entities = ['Client', 'Deal', 'Job', 'Invoice'];
  const fieldsConfig = config.customFields || {};

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
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
              <Button variant="ghost" icon="add" onClick={() => addField(entity)} whileTap={{ scale: 0.95 }}>Add Field</Button>
            </div>

            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                className="space-y-3"
                key={`${entity}-${fieldsConfig[entity]?.length || 0}`}
              >
                {(fieldsConfig[entity] || []).map((field: any, idx: number) => (
                  <motion.div
                    key={field.id}
                    layout
                    initial={{ opacity: 0, height: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, height: 'auto', y: 0, scale: 1 }}
                    exit={{ opacity: 0, height: 0, y: -20, scale: 0.95 }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 30,
                      duration: 0.3,
                    }}
                    className="flex gap-4 items-center bg-[var(--warm-sand)]/20 p-3 rounded-lg border border-[var(--warm-sand)]"
                    whileHover={{ boxShadow: 'var(--shadow-soft)' }}
                  >
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
                      updated.customFields[entity].splice(idx, 1);
                      setConfig(updated);
                    }} whileTap={{ scale: 0.95 }}>
                      <span className="material-symbols-outlined text-[var(--rose)]">delete</span>
                    </Button>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
            {(!fieldsConfig[entity] || fieldsConfig[entity].length === 0) && (
              <p className="text-sm text-[var(--soft-stone)] italic">No custom fields defined for {entity}.</p>
            )}
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
