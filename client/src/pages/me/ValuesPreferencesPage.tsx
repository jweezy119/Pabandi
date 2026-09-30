import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Heart, Shield, Handshake, Leaf, Users, Sparkles,
  Check, Info, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

interface ValuesPreferences {
  profitSharing?: boolean;
  ethicalSourcing?: boolean;
  communityFirst?: boolean;
  environmentalConsciousness?: boolean;
  inclusiveServing?: boolean;
  transparency?: boolean;
  customValues?: string[];
}

const VALUE_OPTIONS = [
  {
    id: 'profitSharing',
    icon: Handshake,
    title: 'Profit Sharing',
    description: 'Open to profit-sharing arrangements where profits and risks are shared fairly.',
    category: 'financial',
    color: 'var(--clay)',
  },
  {
    id: 'ethicalSourcing',
    icon: Leaf,
    title: 'Ethical Sourcing',
    description: 'Prefer businesses that source materials and labor ethically.',
    category: 'values',
    color: 'var(--sage)',
  },
  {
    id: 'communityFirst',
    icon: Users,
    title: 'Community First',
    description: 'Support businesses that prioritize community well-being over pure profit.',
    category: 'values',
    color: 'var(--muted-ochre)',
  },
  {
    id: 'environmentalConsciousness',
    icon: Leaf,
    title: 'Environmental Care',
    description: 'Prefer eco-friendly businesses and sustainable practices.',
    category: 'values',
    color: 'var(--sage)',
  },
  {
    id: 'inclusiveServing',
    icon: Heart,
    title: 'Inclusive Service',
    description: 'Welcome all customers regardless of background or identity.',
    category: 'values',
    color: 'var(--dusty-rose)',
  },
  {
    id: 'transparency',
    icon: Shield,
    title: 'Radical Transparency',
    description: 'Prefer businesses that are open about pricing, processes, and policies.',
    category: 'values',
    color: 'var(--sky-wash)',
  },
];

export default function ValuesPreferencesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<ValuesPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => { loadPreferences(); }, []);

  const loadPreferences = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/values/preferences`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.data || {});
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPrefs: ValuesPreferences) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/values/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ preferences: newPrefs }),
      });
      if (res.ok) {
        setPreferences(newPrefs);
        toast.success('Preferences saved');
      }
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleValue = (id: keyof ValuesPreferences) => {
    const newPrefs = { ...preferences, [id]: !preferences[id] };
    savePreferences(newPrefs);
  };

  const addCustomValue = () => {
    if (!customValue.trim()) return;
    const newPrefs = {
      ...preferences,
      customValues: [...(preferences.customValues || []), customValue.trim()],
    };
    savePreferences(newPrefs);
    setCustomValue('');
  };

  const removeCustomValue = (index: number) => {
    const newPrefs = {
      ...preferences,
      customValues: (preferences.customValues || []).filter((_, i) => i !== index),
    };
    savePreferences(newPrefs);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin" />
      </div>
    );
  }

  const financialValues = VALUE_OPTIONS.filter(v => v.category === 'financial');
  const valuesOptions = VALUE_OPTIONS.filter(v => v.category === 'values');

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--clay)]/20 bg-[var(--clay)]/10 px-4 py-1.5 text-sm font-medium text-[var(--clay)] mb-4">
            <Heart size={14} />
            Your Values
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
            Values & Preferences
          </h1>
          <p className="text-[var(--soft-stone)] mt-3 max-w-xl mx-auto">
            Shape your experience. Choose what matters to you — never forced, always optional.
          </p>
        </header>

        <div className="p-4 rounded-2xl bg-[var(--sage)]/5 border border-[var(--sage)]/15 mb-8">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-[var(--sage)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--soft-stone)]">
              These preferences help us match you with businesses and opportunities that align with your values.
              Everything is optional. You can change or remove any preference at any time.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4 flex items-center gap-2">
              <Handshake size={18} className="text-[var(--clay)]" />
              Financial Preferences
            </h2>
            <div className="space-y-3">
              {financialValues.map(option => (
                <ValueToggle
                  key={option.id}
                  option={option}
                  enabled={Boolean(preferences[option.id as keyof ValuesPreferences])}
                  onToggle={() => toggleValue(option.id as keyof ValuesPreferences)}
                  saving={saving}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4 flex items-center gap-2">
              <Heart size={18} className="text-[var(--dusty-rose)]" />
              Personal Values
            </h2>
            <div className="space-y-3">
              {valuesOptions.map(option => (
                <ValueToggle
                  key={option.id}
                  option={option}
                  enabled={Boolean(preferences[option.id as keyof ValuesPreferences])}
                  onToggle={() => toggleValue(option.id as keyof ValuesPreferences)}
                  saving={saving}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--muted-ochre)]" />
              Custom Values
            </h2>
            <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
              <p className="text-sm text-[var(--soft-stone)] mb-3">
                Add any other values that matter to you. These help us serve you better.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomValue())}
                  placeholder="e.g. family-owned, veteran-owned, women-led..."
                  className="flex-1 px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                />
                <button
                  onClick={addCustomValue}
                  className="px-4 py-2 rounded-xl bg-[var(--clay)] text-white text-sm font-medium hover:bg-[var(--terracotta)]"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {(preferences.customValues || []).map((value, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--warm-sand)]/50 text-[var(--warm-ink)]">
                    {value}
                    <button onClick={() => removeCustomValue(i)} className="hover:text-red-400">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={() => navigate('/me/profile')}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--clay)] hover:underline"
          >
            Back to Profile <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ValueToggle({ option, enabled, onToggle, saving }: {
  option: { id: string; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string; color: string };
  enabled: boolean;
  onToggle: () => void;
  saving: boolean;
}) {
  const Icon = option.icon;
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
        enabled ? 'border-[var(--clay)]/30 bg-[var(--clay)]/5' : 'border-[rgba(191,179,163,0.2)] bg-white/40'
      }`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${option.color} 15%, transparent)` }}
      >
        <Icon size={18} style={{ color: option.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--warm-ink)]">{option.title}</p>
        <p className="text-xs text-[var(--soft-stone)] mt-0.5">{option.description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={saving}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-[var(--clay)]' : 'bg-[var(--warm-sand)]'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-5' : ''
        }`} />
      </button>
    </div>
  );
}
