import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../../store/authStore';
import {
  WIDGET_REGISTRY, getDefaultLayout, getWidgetDefinition,
  WidgetInstance, DashboardTheme, DEFAULT_THEME
} from './WidgetRegistry';
import {
  GripVertical, Eye, EyeOff, Plus, Settings, X, Check,
  Palette, RotateCcw, LayoutGrid
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ModularDashboardProps {
  businessId: string;
  data?: Record<string, unknown>;
}

type EditMode = 'none' | 'layout' | 'theme';

export default function ModularDashboard({ businessId, data }: ModularDashboardProps) {
  const { user } = useAuthStore();
  const [layout, setLayout] = useState<WidgetInstance[]>(getDefaultLayout());
  const [theme, setTheme] = useState<DashboardTheme>(DEFAULT_THEME);
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    loadLayout();
  }, [businessId]);

  const loadLayout = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/settings/dashboard-layout?businessId=${businessId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data?.layout?.length > 0) setLayout(json.data.layout);
        if (json.data?.theme) setTheme({ ...DEFAULT_THEME, ...json.data.theme });
      }
    } catch (err) {
      console.error('Failed to load dashboard layout:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = useCallback(async (newLayout: WidgetInstance[], newTheme: DashboardTheme) => {
    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/settings/dashboard-layout`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ businessId, layout: newLayout, theme: newTheme }),
        }
      );
      if (!res.ok) throw new Error('Save failed');
      toast.success('Dashboard saved');
    } catch (err) {
      toast.error('Failed to save dashboard');
    } finally {
      setSaving(false);
    }
  }, [businessId]);

  const handleToggleVisibility = (id: string) => {
    const newLayout = layout.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setLayout(newLayout);
    saveLayout(newLayout, theme);
  };

  const handleToggleWidth = (id: string) => {
    const newLayout = layout.map(w => w.id === id ? { ...w, width: w.width === 'half' ? 'full' : 'half' } : w);
    setLayout(newLayout);
    saveLayout(newLayout, theme);
  };

  const handleRemoveWidget = (id: string) => {
    const newLayout = layout.filter(w => w.id !== id);
    setLayout(newLayout);
    saveLayout(newLayout, theme);
  };

  const handleAddWidget = (widgetId: string) => {
    const def = getWidgetDefinition(widgetId);
    if (!def) return;
    const newWidget: WidgetInstance = {
      id: `widget-${widgetId}-${Date.now()}`,
      widgetId,
      visible: true,
      width: def.defaultWidth,
      position: layout.length,
    };
    const newLayout = [...layout, newWidget];
    setLayout(newLayout);
    saveLayout(newLayout, theme);
    setShowAddWidget(false);
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newLayout = [...layout];
    const [moved] = newLayout.splice(dragIndex, 1);
    newLayout.splice(index, 0, moved);
    setLayout(newLayout);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    saveLayout(layout, theme);
  };

  const handleReset = () => {
    setLayout(getDefaultLayout());
    setTheme(DEFAULT_THEME);
    saveLayout(getDefaultLayout(), DEFAULT_THEME);
  };

  const densityClass = {
    compact: 'gap-3 p-3',
    comfortable: 'gap-4 p-4',
    spacious: 'gap-6 p-6',
  }[theme.density];

  const radiusClass = {
    sharp: 'rounded-lg',
    rounded: 'rounded-2xl',
    pill: 'rounded-3xl',
  }[theme.borderRadius];

  const visibleWidgets = layout.filter(w => w.visible);
  const hiddenWidgets = layout.filter(w => !w.visible);
  const availableWidgets = WIDGET_REGISTRY.filter(w => !layout.some(l => l.widgetId === w.id));

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 rounded-2xl bg-[var(--warm-sand)]/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid size={18} className="text-[var(--clay)]" />
          <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Dashboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(editMode === 'layout' ? 'none' : 'layout')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              editMode === 'layout' ? 'bg-[var(--clay)] text-white' : 'bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]'
            }`}
          >
            <Settings size={12} />
            {editMode === 'layout' ? 'Done' : 'Customize'}
          </button>
          <button
            onClick={() => setEditMode(editMode === 'theme' ? 'none' : 'theme')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              editMode === 'theme' ? 'bg-[var(--clay)] text-white' : 'bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]'
            }`}
          >
            <Palette size={12} />
            Theme
          </button>
        </div>
      </div>

      {editMode === 'theme' && (
        <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--warm-ink)]">Theme</h3>
            <button onClick={handleReset} className="flex items-center gap-1 text-xs text-[var(--soft-stone)] hover:text-[var(--clay)]">
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--warm-ink)] block mb-2">Accent Color</label>
              <div className="flex items-center gap-2">
                {['#C97B5A', '#8A9A7B', '#D9A854', '#B8C9D4', '#D4A5A5'].map(c => (
                  <button
                    key={c}
                    onClick={() => { const t = { ...theme, accentColor: c }; setTheme(t); saveLayout(layout, t); }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${theme.accentColor === c ? 'border-[var(--warm-ink)] scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--warm-ink)] block mb-2">Density</label>
              <div className="flex gap-1">
                {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => { const t = { ...theme, density: d }; setTheme(t); saveLayout(layout, t); }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${theme.density === d ? 'bg-[var(--clay)] text-white' : 'bg-[var(--warm-sand)]/50 text-[var(--warm-ink)]'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--warm-ink)] block mb-2">Corners</label>
              <div className="flex gap-1">
                {(['sharp', 'rounded', 'pill'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => { const t = { ...theme, borderRadius: r }; setTheme(t); saveLayout(layout, t); }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${theme.borderRadius === r ? 'bg-[var(--clay)] text-white' : 'bg-[var(--warm-sand)]/50 text-[var(--warm-ink)]'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editMode === 'layout' && (
        <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[var(--warm-ink)]">Visible Widgets</h3>
            <button
              onClick={() => setShowAddWidget(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-[var(--clay)]/10 text-[var(--clay)] hover:bg-[var(--clay)]/20"
            >
              <Plus size={12} /> Add Widget
            </button>
          </div>
          <div className="space-y-1">
            {layout.map((widget, index) => {
              const def = getWidgetDefinition(widget.widgetId);
              if (!def) return null;
              return (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/40 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical size={14} className="text-[var(--soft-stone)]" />
                  <def.icon size={14} className="text-[var(--clay)]" />
                  <span className="flex-1 text-sm text-[var(--warm-ink)]">{def.title}</span>
                  <button onClick={() => handleToggleWidth(widget.id)} className="p-1 hover:bg-[var(--warm-sand)] rounded">
                    {widget.width === 'full' ? <LayoutGrid size={12} /> : <LayoutGrid size={12} />}
                  </button>
                  <button onClick={() => handleToggleVisibility(widget.id)} className="p-1 hover:bg-[var(--warm-sand)] rounded">
                    {widget.visible ? <Eye size={12} className="text-[var(--sage)]" /> : <EyeOff size={12} className="text-[var(--soft-stone)]" />}
                  </button>
                  <button onClick={() => handleRemoveWidget(widget.id)} className="p-1 hover:bg-red-50 rounded">
                    <X size={12} className="text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowAddWidget(false)}>
          <div className="bg-[var(--cream)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Add Widget</h3>
              <button onClick={() => setShowAddWidget(false)} className="p-1 hover:bg-[var(--warm-sand)] rounded">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {availableWidgets.map(w => (
                <button
                  key={w.id}
                  onClick={() => handleAddWidget(w.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--warm-sand)]/30 transition-colors text-left"
                >
                  <w.icon size={18} className="text-[var(--clay)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--warm-ink)]">{w.title}</p>
                    <p className="text-xs text-[var(--soft-stone)]">{w.description}</p>
                  </div>
                </button>
              ))}
              {availableWidgets.length === 0 && (
                <p className="text-sm text-[var(--soft-stone)] text-center py-4">All widgets added</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${densityClass}`}>
        {visibleWidgets.map(widget => {
          const def = getWidgetDefinition(widget.widgetId);
          if (!def) return null;
          const WidgetComponent = def.component;
          return (
            <div
              key={widget.id}
              className={`${widget.width === 'full' ? 'md:col-span-2 lg:col-span-3' : ''} ${radiusClass} bg-white/60 border border-[rgba(191,179,163,0.2)] shadow-[var(--shadow-soft)]`}
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <def.icon size={16} style={{ color: theme.accentColor }} />
                  <h3 className="text-sm font-bold text-[var(--warm-ink)]">{def.title}</h3>
                </div>
                <WidgetComponent data={data} />
              </div>
            </div>
          );
        })}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-[var(--warm-ink)] text-white text-xs font-medium shadow-lg">
          Saving...
        </div>
      )}
    </div>
  );
}
