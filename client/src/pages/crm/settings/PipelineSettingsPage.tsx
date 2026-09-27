import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';

const navItems = [
  { path: '/contact/settings', label: 'Back to Settings', icon: 'arrow_back' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function PipelineSettingsPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const defaultStages = [
    { id: 'lead', name: 'LEAD', probability: 10, color: 'var(--warm-sand)' },
    { id: 'qualified', name: 'QUALIFIED', probability: 30, color: 'var(--sage)' },
    { id: 'proposal', name: 'PROPOSAL', probability: 50, color: 'var(--clay)' },
    { id: 'negotiation', name: 'NEGOTIATION', probability: 80, color: 'var(--terracotta)' },
    { id: 'won', name: 'WON', probability: 100, color: 'var(--warm-ink)' },
    { id: 'lost', name: 'LOST', probability: 0, color: 'var(--rose)' },
  ];

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
      alert('Pipeline settings saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving pipeline settings');
    }
  };

  const getStages = () => {
    return config.enabledFeatures?.pipelineStages || defaultStages;
  };

  const setStages = (stages: any[]) => {
    const updated = { ...config };
    if (!updated.enabledFeatures) updated.enabledFeatures = {};
    updated.enabledFeatures.pipelineStages = stages;
    setConfig(updated);
  };

  const addStage = () => {
    setStages([...getStages(), { id: Math.random().toString(36).substring(7), name: 'NEW STAGE', probability: 0, color: 'var(--soft-stone)' }]);
  };

  const updateStage = (index: number, data: any) => {
    const stages = [...getStages()];
    stages[index] = { ...stages[index], ...data };
    setStages(stages);
  };

  const removeStage = (index: number) => {
    const stages = [...getStages()];
    stages.splice(index, 1);
    setStages(stages);
  };

  const resetToDefault = () => {
    setStages(defaultStages);
  };

  // Drag and drop logic
  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === targetIndex) return;
    const stages = [...getStages()];
    const [removed] = stages.splice(draggedItem, 1);
    stages.splice(targetIndex, 0, removed);
    setStages(stages);
    setDraggedItem(null);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  const stages = getStages();

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Pipeline Settings</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage your deal stages (drag to reorder)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={resetToDefault}>Reset Default</Button>
            <Button variant="primary" onClick={() => saveConfig(config)}>Save Changes</Button>
          </div>
        </div>

        <Card padding="lg" className="space-y-4">
          <div className="space-y-3">
            {stages.map((stage: any, idx: number) => (
              <div 
                key={stage.id} 
                className="flex gap-4 items-center bg-[var(--warm-sand)]/20 p-3 rounded-lg border border-[var(--warm-sand)] cursor-move transition-all"
                draggable
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, idx)}
              >
                <span className="material-symbols-outlined text-[var(--soft-stone)]">drag_indicator</span>
                <input 
                  type="color"
                  className="w-8 h-8 rounded border-none cursor-pointer"
                  value={stage.color?.startsWith('#') ? stage.color : '#aaaaaa'}
                  onChange={e => updateStage(idx, { color: e.target.value })}
                  title="Choose Color (Note: CSS vars may not show correct initial color in picker)"
                />
                <input 
                  className="flex-1 px-3 py-2 border rounded-lg font-bold uppercase tracking-wide" 
                  value={stage.name}
                  onChange={e => updateStage(idx, { name: e.target.value })}
                  placeholder="Stage Name"
                />
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    className="w-20 px-3 py-2 border rounded-lg text-center" 
                    value={stage.probability}
                    onChange={e => updateStage(idx, { probability: parseInt(e.target.value, 10) || 0 })}
                    min="0" max="100"
                  />
                  <span className="text-sm text-[var(--soft-stone)]">%</span>
                </div>
                <Button variant="ghost" onClick={() => removeStage(idx)}>
                  <span className="material-symbols-outlined text-[var(--rose)]">delete</span>
                </Button>
              </div>
            ))}
          </div>
          <div className="pt-4">
            <Button variant="ghost" icon="add" onClick={addStage}>Add Stage</Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
