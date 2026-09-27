import React, { useState, useEffect } from 'react';
import { PipelineFunnelWidget } from './PipelineFunnelWidget';
import { RevenueWidget } from './RevenueWidget';
import { ExpensesWidget } from './ExpensesWidget';
import { ClientHealthWidget } from './ClientHealthWidget';
import { TrustInsightsWidget } from './TrustInsightsWidget';
import { ActivityMetricsWidget } from './ActivityMetricsWidget';
import { Button } from '../../../components/primitives/Button';

export function ReportWidgetGrid({ data, loading }: { data: any, loading: boolean }) {
  const defaultLayout = [
    { id: 'pipeline', title: 'Pipeline Funnel', visible: true, width: 'md:col-span-1' },
    { id: 'revenue', title: 'Revenue', visible: true, width: 'md:col-span-1' },
    { id: 'expenses', title: 'Expenses', visible: true, width: 'md:col-span-1' },
    { id: 'clientHealth', title: 'Client Health', visible: true, width: 'md:col-span-1' },
    { id: 'trust', title: 'Trust Insights', visible: true, width: 'md:col-span-1' },
    { id: 'activity', title: 'Activity Metrics', visible: true, width: 'md:col-span-1' },
  ];

  const [layout, setLayout] = useState(defaultLayout);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pabandi_reports_layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length === defaultLayout.length) setLayout(parsed);
      } catch (e) {}
    }
  }, []);

  const saveLayout = (newLayout: any[]) => {
    setLayout(newLayout);
    localStorage.setItem('pabandi_reports_layout', JSON.stringify(newLayout));
  };

  const toggleVisibility = (id: string) => {
    saveLayout(layout.map(item => item.id === id ? { ...item, visible: !item.visible } : item));
  };

  const toggleSize = (id: string) => {
    saveLayout(layout.map(item => item.id === id ? { ...item, width: item.width === 'md:col-span-1' ? 'md:col-span-2' : 'md:col-span-1' } : item));
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const newLayout = [...layout];
    const draggedIdx = newLayout.findIndex(i => i.id === draggedItem);
    const targetIdx = newLayout.findIndex(i => i.id === targetId);
    
    const [removed] = newLayout.splice(draggedIdx, 1);
    newLayout.splice(targetIdx, 0, removed);
    
    saveLayout(newLayout);
    setDraggedItem(null);
  };

  const renderWidgetContent = (id: string) => {
    switch (id) {
      case 'pipeline': return <PipelineFunnelWidget data={data.pipeline || []} loading={loading} />;
      case 'revenue': return <RevenueWidget data={data.revenue} loading={loading} />;
      case 'expenses': return <ExpensesWidget data={data.expenses || []} loading={loading} />;
      case 'clientHealth': return <ClientHealthWidget data={data.clientHealth} loading={loading} />;
      case 'trust': return <TrustInsightsWidget data={data.trust} loading={loading} />;
      case 'activity': return <ActivityMetricsWidget data={data.activity} loading={loading} />;
      default: return null;
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="ghost" icon={isEditMode ? 'check' : 'edit'} onClick={() => setIsEditMode(!isEditMode)}>
          {isEditMode ? 'Done Editing' : 'Customize Dashboard'}
        </Button>
      </div>
      
      {isEditMode && (
        <div className="bg-[var(--warm-sand)]/20 p-4 rounded-xl border border-[var(--warm-sand)] mb-6 flex flex-wrap gap-2">
          {layout.map(item => (
            <div 
              key={`toggle-${item.id}`} 
              onClick={() => toggleVisibility(item.id)}
              className={`px-3 py-1.5 rounded-full text-sm cursor-pointer border transition-colors ${item.visible ? 'bg-[var(--clay)] text-white border-[var(--clay)]' : 'bg-white text-[var(--soft-stone)] border-[var(--warm-sand)]'}`}
            >
              {item.title} {item.visible ? '✓' : '+'}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {layout.filter(item => item.visible || isEditMode).map(item => (
          <div 
            key={item.id} 
            className={`${item.width} transition-all duration-300 relative ${isEditMode ? 'ring-2 ring-[var(--clay)] ring-dashed rounded-2xl opacity-80' : ''} ${!item.visible ? 'hidden' : ''}`}
            draggable={isEditMode}
            onDragStart={(e) => onDragStart(e, item.id)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, item.id)}
          >
            {isEditMode && (
              <div className="absolute top-2 left-2 z-10 flex gap-1">
                <button 
                  className="w-8 h-8 rounded-full bg-white text-[var(--warm-ink)] shadow-md flex items-center justify-center cursor-move"
                  title="Drag to move"
                >
                  <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                </button>
                <button 
                  className="w-8 h-8 rounded-full bg-white text-[var(--warm-ink)] shadow-md flex items-center justify-center cursor-pointer"
                  onClick={() => toggleSize(item.id)}
                  title="Toggle Width"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {item.width === 'md:col-span-1' ? 'width_full' : 'width_normal'}
                  </span>
                </button>
              </div>
            )}
            <div className={isEditMode ? 'pointer-events-none' : ''}>
              {renderWidgetContent(item.id)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
