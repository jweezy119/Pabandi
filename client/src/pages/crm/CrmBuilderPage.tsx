import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives/Button';
import { Card } from '../../components/primitives/Card';
import { getAuthToken } from '../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

type FieldType = 'text' | 'longText' | 'number' | 'currency' | 'date' | 'boolean' | 'select' | 'multiSelect' | 'email' | 'phone' | 'link';

interface Field {
  id: string;
  name?: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
}

interface ObjectDef {
  id: string;
  name: string;
  pluralName?: string | null;
  icon: string;
  color: string;
  description?: string | null;
  fields: Field[];
  _count?: { records: number };
}

interface RecordRow {
  id: string;
  data: Record<string, unknown>;
}

interface Progress {
  xp: number;
  badges: string[];
}

const BLUEPRINTS = [
  {
    id: 'property', label: 'Property', emoji: '🏠', color: '#C97B5A',
    hint: 'Addresses, rent, lease dates',
    fields: [
      { label: 'Address', type: 'text' as FieldType },
      { label: 'Monthly rent', type: 'currency' as FieldType },
      { label: 'Lease ends', type: 'date' as FieldType },
      { label: 'Tenant', type: 'text' as FieldType },
    ],
  },
  {
    id: 'job', label: 'Job Site', emoji: '🧰', color: '#D9A854',
    hint: 'Crew, status, site notes',
    fields: [
      { label: 'Site address', type: 'text' as FieldType },
      { label: 'Job value', type: 'currency' as FieldType },
      { label: 'Start date', type: 'date' as FieldType },
      { label: 'Crew lead', type: 'text' as FieldType },
      { label: 'Completed', type: 'boolean' as FieldType },
    ],
  },
  {
    id: 'product', label: 'Product', emoji: '📦', color: '#8A9A7B',
    hint: 'SKU, price, stock',
    fields: [
      { label: 'SKU', type: 'text' as FieldType },
      { label: 'Price', type: 'currency' as FieldType },
      { label: 'In stock', type: 'number' as FieldType },
      { label: 'Available', type: 'boolean' as FieldType },
    ],
  },
  {
    id: 'client', label: 'VIP Client', emoji: '⭐', color: '#B8C9D4',
    hint: 'Goals, reminders, contact',
    fields: [
      { label: 'Contact email', type: 'email' as FieldType },
      { label: 'Phone', type: 'phone' as FieldType },
      { label: 'Next follow-up', type: 'date' as FieldType },
      { label: 'Internal note', type: 'longText' as FieldType },
    ],
  },
  {
    id: 'blank', label: 'My own thing', emoji: '✨', color: '#D4A5A5',
    hint: 'Start from a blank canvas',
    fields: [],
  },
];

const FIELD_CARDS: Array<{ type: FieldType; label: string; icon: string; example: string; defaultLabel: string }> = [
  { type: 'text', label: 'Short text', icon: 'T', example: 'e.g. Kitchen', defaultLabel: 'Name' },
  { type: 'longText', label: 'Notes', icon: '≡', example: 'Longer details', defaultLabel: 'Notes' },
  { type: 'number', label: 'Number', icon: '#', example: 'e.g. 12', defaultLabel: 'Quantity' },
  { type: 'currency', label: 'Money', icon: '$', example: 'e.g. 1,200', defaultLabel: 'Amount' },
  { type: 'date', label: 'Date', icon: '▦', example: 'Pick a day', defaultLabel: 'Date' },
  { type: 'boolean', label: 'Yes / No', icon: '✓', example: 'A checkbox', defaultLabel: 'Done?' },
  { type: 'select', label: 'Choice', icon: '◉', example: 'Pick one option', defaultLabel: 'Status' },
  { type: 'email', label: 'Email', icon: '@', example: 'name@example.com', defaultLabel: 'Email' },
  { type: 'phone', label: 'Phone', icon: '☎', example: '+1 555 0100', defaultLabel: 'Phone' },
  { type: 'link', label: 'Link', icon: '↗', example: 'https://…', defaultLabel: 'Website' },
];

const BADGE_LABELS: Record<string, string> = {
  first_object: 'First build',
  field_collector: 'Detail oriented',
  first_record: 'First entry',
  template_sharer: 'Good neighbour',
};

function fieldKey(field: Field) {
  return field.name || field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
}

function badgeForXp(xp: number) {
  if (xp >= 200) return 'CRM Architect';
  if (xp >= 100) return 'Builder';
  if (xp >= 50) return 'Apprentice';
  return 'Newcomer';
}

export function CrmBuilderPage() {
  const reduced = Boolean(useReducedMotion());
  const [objects, setObjects] = useState<ObjectDef[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [progress, setProgress] = useState<Progress>({ xp: 0, badges: [] });
  const [step, setStep] = useState(0);
  const [blueprint, setBlueprint] = useState<(typeof BLUEPRINTS)[number] | null>(null);
  const [name, setName] = useState('');
  const [pluralName, setPluralName] = useState('');
  const [fields, setFields] = useState<Field[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeObject, setActiveObject] = useState<ObjectDef | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recordDraft, setRecordDraft] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    try {
      const [o, p, t] = await Promise.all([
        fetch(`${API_BASE}/api/v1/crm/builder/objects`, { headers: headers() }),
        fetch(`${API_BASE}/api/v1/crm/builder/progress`, { headers: headers() }),
        fetch(`${API_BASE}/api/v1/crm/builder/templates`, { headers: headers() }),
      ]);
      if (o.ok) setObjects((await o.json()).data || []);
      if (p.ok) setProgress(await p.json().then((b) => b.data || b));
      if (t.ok) setTemplates((await t.json()).data || []);
    } catch {
      setError('Could not load your builder. Refresh to try again.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadRecords = useCallback(async (objectId: string) => {
    const res = await fetch(`${API_BASE}/api/v1/crm/builder/objects/${objectId}/records`, { headers: headers() });
    if (res.ok) setRecords((await res.json()).data || []);
  }, []);

  const openObject = (object: ObjectDef) => {
    setActiveObject(object);
    setRecordDraft({});
    void loadRecords(object.id);
  };

  const chooseBlueprint = (bp: (typeof BLUEPRINTS)[number]) => {
    setBlueprint(bp);
    setName(bp.id === 'blank' ? '' : bp.label);
    setPluralName(bp.id === 'blank' ? '' : `${bp.label}s`);
    setFields(bp.fields.map((f, i) => ({
      ...f,
      id: `draft-${i}`,
      ...(f.type === 'select' ? { options: ['New', 'In progress', 'Done'] } : {}),
    })));
    setStep(1);
  };

  const useTemplate = async (templateId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/builder/templates/${encodeURIComponent(templateId)}/use`, {
        method: 'POST',
        headers: headers(),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load();
      setStep(4);
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 2600);
    } catch {
      setError('Could not use that template.');
    } finally {
      setSaving(false);
    }
  };

  const shareTemplate = async (object: ObjectDef) => {
    const name = window.prompt('Name your template', object.pluralName || object.name);
    if (!name?.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/builder/templates`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ objectId: object.id, name: name.trim(), isPublic: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load();
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 2200);
    } catch {
      setError('Could not share that template.');
    }
  };

  const addField = (type: FieldType) => {
    const card = FIELD_CARDS.find((c) => c.type === type)!;
    setFields((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${prev.length}`,
        label: card.defaultLabel,
        type,
        ...(type === 'select' ? { options: ['Option 1', 'Option 2', 'Option 3'] } : {}),
      },
    ]);
  };

  const publish = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/builder/objects`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          name: name.trim(),
          pluralName: pluralName.trim() || `${name.trim()}s`,
          icon: blueprint?.emoji || '✨',
          color: blueprint?.color || '#C97B5A',
          fields: fields.map((f) => ({
            label: f.label,
            type: f.type,
            name: f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
            options: f.options,
          })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load();
      setCelebrating(true);
      setStep(4);
      window.setTimeout(() => setCelebrating(false), 3200);
    } catch {
      setError('Could not publish your object. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveRecord = async () => {
    if (!activeObject) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/builder/objects/${activeObject.id}/records`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ data: recordDraft }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setRecordDraft({});
      await loadRecords(activeObject.id);
      await load();
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 2200);
    } catch {
      setError('Could not save that entry.');
    } finally {
      setSaving(false);
    }
  };

  const level = Math.floor(progress.xp / 100) + 1;
  const xpIntoLevel = progress.xp % 100;
  const confetti = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      delay: `${(i % 9) * 0.07}s`,
      color: ['#C97B5A', '#D9A854', '#8A9A7B', '#7C8CFF', '#5EE39A'][i % 5],
    })),
    [],
  );

  const stepTitles = [
    'What do you want to keep track of?',
    `What should we call your ${blueprint?.label.toLowerCase() || 'thing'}?`,
    'Pick the details that matter',
    'Ready to bring it to life?',
  ];

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="space-y-6">
        {/* Game HUD */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-[var(--cream)] p-4 sm:p-5" style={{ boxShadow: 'var(--shadow-soft)' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--soft-stone)]">CRM Builder</p>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--warm-ink)]">Make the CRM yours</h1>
            <p className="text-sm text-[var(--soft-stone)]">Build your own tools in a few taps — no tech skills needed.</p>
          </div>
          <div className="w-full sm:w-64">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--soft-stone)]">
              <span>Level {level} · {badgeForXp(progress.xp)}</span>
              <span>{progress.xp} XP</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--warm-sand)] overflow-hidden mt-1">
              <motion.div
                className="h-full rounded-full bg-[var(--clay)]"
                initial={false}
                animate={{ width: `${xpIntoLevel}%` }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {progress.badges?.map((b) => (
                <motion.span
                  key={b}
                  initial={reduced ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full bg-[var(--sage)]/15 px-2 py-1 text-[10px] font-bold text-[var(--sage)]"
                  title={b}
                >
                  🏅 {BADGE_LABELS[b] || b}
                </motion.span>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-[var(--dusty-rose)]">{error}</p>}

        {objects.length > 0 && step < 4 && (
          <Button variant="ghost" onClick={() => setStep(4)}>← Back to my stuff ({objects.length})</Button>
        )}

        <AnimatePresence mode="wait">
          {step < 4 && (
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0 : 0.22 }}
              className="space-y-5"
            >
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="h-2 flex-1 rounded-full"
                    style={{ background: i <= step ? 'var(--clay)' : 'var(--warm-sand)' }}
                    animate={reduced ? undefined : { scaleY: i === step ? 1.4 : 1 }}
                  />
                ))}
                <span className="text-xs font-bold text-[var(--soft-stone)] ml-2">{step + 1}/4</span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-[var(--warm-ink)]">{stepTitles[step]}</h2>

              {step === 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {BLUEPRINTS.map((bp, i) => (
                    <motion.button
                      key={bp.id}
                      type="button"
                      onClick={() => chooseBlueprint(bp)}
                      initial={reduced ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduced ? 0 : i * 0.05 }}
                      whileHover={reduced ? undefined : { y: -5, scale: 1.02 }}
                      whileTap={reduced ? undefined : { scale: 0.97 }}
                      className="rounded-2xl border border-[var(--warm-sand)] bg-white p-4 text-left shadow-sm hover:border-[var(--clay)]"
                    >
                      <div className="text-3xl mb-2">{bp.emoji}</div>
                      <p className="font-bold text-[var(--warm-ink)]">{bp.label}</p>
                      <p className="text-xs text-[var(--soft-stone)] mt-1">{bp.hint}</p>
                    </motion.button>
                  ))}
                </div>
              )}

              {templates.length > 0 && (
                <div className="rounded-2xl border border-[var(--warm-sand)] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mb-3">
                    Or start from a shared setup
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {templates.map((template) => (
                      <motion.button
                        key={template.id}
                        type="button"
                        onClick={() => useTemplate(template.id)}
                        whileHover={reduced ? undefined : { y: -3 }}
                        whileTap={reduced ? undefined : { scale: 0.97 }}
                        disabled={saving}
                        className="min-w-[170px] rounded-xl border border-[var(--warm-sand)] bg-[var(--cream)] p-3 text-left"
                      >
                        <span className="text-2xl">{template.icon}</span>
                        <p className="mt-1 text-sm font-bold text-[var(--warm-ink)]">{template.name}</p>
                        <p className="text-[11px] text-[var(--soft-stone)]">{template.description || 'One tap to install'}</p>
                        <p className="mt-1 text-[11px] font-bold text-[var(--clay)]">Use →</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <Card className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs font-bold text-[var(--warm-ink)]">I'll call it…</span>
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Property"
                        className="mt-1 w-full min-h-[48px] rounded-xl border border-[var(--warm-sand)] bg-white px-3 text-[var(--warm-ink)]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-[var(--warm-ink)]">More than one: (optional)</span>
                      <input
                        value={pluralName}
                        onChange={(e) => setPluralName(e.target.value)}
                        placeholder="e.g. Properties"
                        className="mt-1 w-full min-h-[48px] rounded-xl border border-[var(--warm-sand)] bg-white px-3 text-[var(--warm-ink)]"
                      />
                    </label>
                  </div>
                  <div className="rounded-xl bg-[var(--cream)] p-4 flex items-center gap-3">
                    <span className="text-3xl">{blueprint?.emoji}</span>
                    <div>
                      <p className="font-bold text-[var(--warm-ink)]">{name || 'Your new thing'}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{fields.length} details picked so far</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
                    <Button variant="primary" disabled={!name.trim()} onClick={() => setStep(2)}>Looks good →</Button>
                  </div>
                </Card>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-[var(--soft-stone)]">Tap the pieces you want. You can rename them next.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {FIELD_CARDS.map((card, i) => (
                      <motion.button
                        key={card.type}
                        type="button"
                        onClick={() => addField(card.type)}
                        initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: reduced ? 0 : i * 0.03 }}
                        whileHover={reduced ? undefined : { y: -4 }}
                        whileTap={reduced ? undefined : { scale: 0.95 }}
                        className="rounded-2xl border border-[var(--warm-sand)] bg-white p-3 text-left hover:border-[var(--clay)]"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--clay)]/10 text-lg font-bold text-[var(--clay)]">
                          {card.icon}
                        </span>
                        <p className="mt-2 text-sm font-bold text-[var(--warm-ink)]">{card.label}</p>
                        <p className="text-[11px] text-[var(--soft-stone)]">+ Add</p>
                      </motion.button>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-[var(--warm-sand)] bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mb-3">
                      Your details ({fields.length})
                    </p>
                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {fields.map((field) => (
                          <motion.div
                            key={field.id}
                            layout={!reduced}
                            initial={reduced ? false : { opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduced ? undefined : { opacity: 0, x: 12 }}
                            className="flex items-center gap-2 rounded-xl bg-[var(--cream)] p-2"
                          >
                            <span className="w-8 text-center font-bold text-[var(--clay)]">
                              {FIELD_CARDS.find((c) => c.type === field.type)?.icon}
                            </span>
                            <input
                              value={field.label}
                              onChange={(e) => setFields((f) => f.map((x) => x.id === field.id ? { ...x, label: e.target.value } : x))}
                              className="min-h-[40px] flex-1 rounded-lg border border-[var(--warm-sand)] bg-white px-2 text-sm text-[var(--warm-ink)]"
                              aria-label="Field label"
                            />
                            {field.type === 'select' && (
                              <input
                                value={(field.options || []).join(', ')}
                                onChange={(e) => setFields((f) => f.map((x) => x.id === field.id
                                  ? { ...x, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }
                                  : x))}
                                className="hidden sm:block min-h-[40px] w-40 rounded-lg border border-[var(--warm-sand)] bg-white px-2 text-xs"
                                aria-label="Choices, comma separated"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => setFields((f) => f.filter((x) => x.id !== field.id))}
                              aria-label={`Remove ${field.label}`}
                              className="min-h-[40px] min-w-[40px] rounded-lg text-[var(--dusty-rose)]"
                            >
                              ✕
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {fields.length === 0 && (
                        <p className="text-sm text-[var(--soft-stone)]">No details yet — tap a card above to add one.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                    <Button variant="primary" onClick={() => setStep(3)}>Review →</Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <Card className="space-y-5">
                  <div className="flex items-center gap-4 rounded-2xl bg-[var(--cream)] p-4">
                    <motion.span
                      animate={reduced ? undefined : { rotate: [0, -8, 8, 0] }}
                      transition={{ duration: 0.6 }}
                      className="text-4xl"
                    >
                      {blueprint?.emoji}
                    </motion.span>
                    <div>
                      <p className="text-xl font-bold text-[var(--warm-ink)]">{name}</p>
                      <p className="text-sm text-[var(--soft-stone)]">
                        {fields.length} details · {pluralName || `${name}s`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fields.map((f) => (
                      <span key={f.id} className="rounded-full bg-[var(--warm-sand)] px-3 py-1 text-xs font-semibold text-[var(--warm-ink)]">
                        {f.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-[var(--soft-stone)]">Publishing gives you +50 XP and a new badge. You can add entries right away.</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                    <Button variant="primary" onClick={publish} disabled={saving}>
                      {saving ? 'Building…' : '✨ Publish my tool'}
                    </Button>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="dashboard"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.24 }}
              className="space-y-5"
            >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--warm-ink)]">Your stuff</h2>
                <motion.div whileTap={reduced ? undefined : { scale: 0.97 }}>
                  <Button variant="primary" onClick={() => { setBlueprint(null); setName(''); setFields([]); setStep(0); }}>
                    ✨ Build something new
                  </Button>
                </motion.div>
              </div>

              {objects.length === 0 && (
                <Card className="text-center py-10">
                  <p className="text-4xl">🧱</p>
                  <p className="mt-3 font-bold text-[var(--warm-ink)]">Nothing built yet</p>
                  <p className="text-sm text-[var(--soft-stone)]">Pick a blueprint and make your first tool.</p>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {objects.map((object, i) => (
                  <motion.button
                    key={object.id}
                    type="button"
                    onClick={() => openObject(object)}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduced ? 0 : i * 0.05 }}
                    whileHover={reduced ? undefined : { y: -4 }}
                    className="rounded-2xl border border-[var(--warm-sand)] bg-white p-4 text-left"
                    style={{ borderTop: `4px solid ${object.color}` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-3xl">{object.icon}</div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); void shareTemplate(object); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void shareTemplate(object); } }}
                        className="rounded-full bg-[var(--clay)]/10 px-2 py-1 text-[10px] font-bold text-[var(--clay)]"
                        title="Share this setup as a template"
                      >
                        Share template
                      </span>
                    </div>
                    <p className="mt-2 font-bold text-[var(--warm-ink)]">{object.pluralName || object.name}</p>
                    <p className="text-xs text-[var(--soft-stone)]">
                      {object._count?.records ?? 0} entries · {object.fields.length} details
                    </p>
                  </motion.button>
                ))}
              </div>

              <AnimatePresence>
                {activeObject && (
                  <motion.div
                    initial={reduced ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: 12 }}
                    className="rounded-2xl border border-[var(--warm-sand)] bg-[var(--cream)] p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[var(--warm-ink)]">{activeObject.icon} {activeObject.pluralName || activeObject.name}</h3>
                      <button onClick={() => setActiveObject(null)} className="min-h-[40px] min-w-[40px] text-[var(--soft-stone)]">✕</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeObject.fields.map((field) => (
                        <label key={field.id} className="block text-sm">
                          <span className="text-xs font-bold text-[var(--warm-ink)]">{field.label}</span>
                          {field.type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={Boolean(recordDraft[fieldKey(field)])}
                              onChange={(e) => setRecordDraft((d) => ({ ...d, [fieldKey(field)]: e.target.checked }))}
                              className="ml-2 mt-2 h-5 w-5"
                            />
                          ) : field.type === 'select' ? (
                            <select
                              value={String(recordDraft[fieldKey(field)] ?? '')}
                              onChange={(e) => setRecordDraft((d) => ({ ...d, [fieldKey(field)]: e.target.value }))}
                              className="mt-1 w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-white px-2"
                            >
                              <option value="">Choose…</option>
                              {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
                              value={String(recordDraft[fieldKey(field)] ?? '')}
                              onChange={(e) => setRecordDraft((d) => ({ ...d, [fieldKey(field)]: e.target.value }))}
                              placeholder={FIELD_CARDS.find((c) => c.type === field.type)?.example}
                              className="mt-1 w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] bg-white px-3"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                    <Button variant="primary" onClick={saveRecord} disabled={saving || activeObject.fields.length === 0}>
                      {saving ? 'Saving…' : '+ Add entry (+25 XP)'}
                    </Button>

                    <div className="space-y-2">
                      {records.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No entries yet. Add your first above.</p>}
                      {records.map((record) => (
                        <div key={record.id} className="flex flex-wrap gap-2 rounded-xl bg-white p-3 text-sm text-[var(--warm-ink)]">
                          {activeObject.fields.map((field) => (
                            <span key={field.id} className="rounded-full bg-[var(--cream)] px-2 py-1">
                              <strong className="text-[var(--soft-stone)]">{field.label}:</strong>{' '}
                              {String(record.data?.[fieldKey(field)] ?? '—')}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {celebrating && (
            <motion.div
              className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {reduced ? null : confetti.map((c, i) => (
                <span
                  key={i}
                  className="confetti-piece"
                  style={{ left: c.left, background: c.color, animationDelay: c.delay }}
                />
              ))}
              <motion.div
                className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-2xl bg-[var(--warm-ink)] px-6 py-4 text-center shadow-2xl"
                initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduced ? undefined : { scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              >
                <p className="text-2xl">🎉</p>
                <p className="font-bold text-[var(--cream)]">Nice work!</p>
                <p className="text-sm text-[var(--cream)]/80">You earned XP and a new badge.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
