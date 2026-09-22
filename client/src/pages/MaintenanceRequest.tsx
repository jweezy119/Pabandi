import React from 'react';

const CATEGORIES = [
  { id: 'plumbing', label: 'Plumbing', icon: 'water_drop' },
  { id: 'electrical', label: 'Electrical', icon: 'bolt' },
  { id: 'hvac', label: 'HVAC / Heating', icon: 'thermostat' },
  { id: 'appliance', label: 'Appliance', icon: 'kitchen' },
  { id: 'pest', label: 'Pest Control', icon: 'bug_report' },
  { id: 'structural', label: 'Structural', icon: 'foundation' },
  { id: 'lock', label: 'Lock / Security', icon: 'lock' },
  { id: 'other', label: 'Other', icon: 'build' },
];

const PRIORITIES = [
  { id: 'low', label: 'Low', desc: 'Non-urgent (7 days)', color: 'slate' },
  { id: 'medium', label: 'Medium', desc: 'Standard (3 days)', color: 'amber' },
  { id: 'high', label: 'High', desc: 'Urgent (24 hrs)', color: 'red' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-slate-500/30 bg-slate-500/10 text-[var(--warm-ink)]',
  medium: 'border-[var(--muted-ochre)]/30 bg-[var(--muted-ochre)]/10 text-[var(--muted-ochre)]',
  high: 'border-[var(--terracotta)]/30 bg-[var(--terracotta)]/10 text-[var(--terracotta)]',
};

interface Request {
  id: string;
  category: string;
  title: string;
  priority: string;
  status: 'submitted' | 'in_progress' | 'completed';
  date: string;
  hasStake: boolean;
}

export default function MaintenanceRequest() {
  const [category, setCategory] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const [stakeForPriority, setStakeForPriority] = React.useState(false);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [submitted, setSubmitted] = React.useState(false);

  const existingRequests: Request[] = [
    { id: '1', category: 'plumbing', title: 'Kitchen sink leak', priority: 'high', status: 'in_progress', date: '2026-09-15', hasStake: true },
    { id: '2', category: 'electrical', title: 'Bedroom outlet not working', priority: 'low', status: 'completed', date: '2026-09-02', hasStake: false },
  ];

  const handlePhotoUpload = () => {
    // In production, would upload to server
    setPhotos((p) => [...p, `photo_${p.length + 1}.jpg`]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)]">Maintenance Request</h1>
        <p className="text-[var(--soft-stone)] text-sm mt-1">Report an issue in your unit</p>
      </div>

      {submitted && (
        <div className="rounded-xl bg-[var(--sage)]/15 border border-[var(--sage)]/30 p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[var(--sage)]">check_circle</span>
          <span className="text-[var(--sage)] text-sm font-medium">Request submitted successfully!</span>
        </div>
      )}

      {/* New Request Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-[var(--radius-card)] bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] p-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">New Request</h2>

          {/* Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--warm-ink)] mb-2">Category</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'border-[var(--sage)]/50 bg-[var(--sage)]/10 text-[var(--sage)]'
                      : 'border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:border-[rgba(191,179,163,0.4)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--warm-ink)] mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full px-4 py-3 rounded-xl bg-[var(--cream)]/30 border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] placeholder-slate-500 focus:outline-none focus:border-[var(--sage)]/50"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--warm-ink)] mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Provide details about the issue..."
              className="w-full px-4 py-3 rounded-xl bg-[var(--cream)]/30 border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] placeholder-slate-500 focus:outline-none focus:border-[var(--sage)]/50 resize-none"
            />
          </div>

          {/* Photos */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--warm-ink)] mb-2">Photos</label>
            <div className="flex gap-3">
              {photos.map((_photo, i) => (
                <div key={i} className="w-16 h-16 rounded-lg bg-[var(--warm-sand)] flex items-center justify-center text-xs text-[var(--soft-stone)]">
                  📷 {i + 1}
                </div>
              ))}
              <button
                type="button"
                onClick={handlePhotoUpload}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-[rgba(191,179,163,0.4)] flex items-center justify-center text-[var(--soft-stone)] hover:border-[var(--sage)]/50 hover:text-[var(--sage)] transition-all"
              >
                <span className="material-symbols-outlined">add_photo_alternate</span>
              </button>
            </div>
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--warm-ink)] mb-2">Priority</label>
            <div className="grid grid-cols-3 gap-3">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    priority === p.id ? PRIORITY_COLORS[p.id] : 'border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] text-[var(--soft-stone)]'
                  }`}
                >
                  <div className="font-semibold text-sm">{p.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stake for Priority */}
          <div className="rounded-xl bg-[var(--dusty-rose)]/10 border border-[var(--dusty-rose)]/20 p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={stakeForPriority}
                onChange={(e) => setStakeForPriority(e.target.checked)}
                className="w-5 h-5 rounded bg-[var(--cream)]/30 border-[rgba(191,179,163,0.4)] text-purple-500 focus:ring-purple-500"
              />
              <div>
                <div className="text-[var(--warm-ink)] text-sm font-medium">Stake PAB for priority processing</div>
                <div className="text-[var(--soft-stone)] text-xs">Get faster response by staking PAB tokens. Returned after completion.</div>
              </div>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={!category || !title}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--sage)] to-[var(--sky-wash)] text-[var(--warm-ink)] font-bold text-lg shadow-[var(--shadow-soft)] shadow-[rgba(138,154,123,0.2)] hover:shadow-[rgba(138,154,123,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Request
        </button>
      </form>

      {/* Existing Requests */}
      <div className="rounded-[var(--radius-card)] bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] p-6">
        <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Your Requests</h2>
        <div className="space-y-3">
          {existingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  req.status === 'completed' ? 'bg-[var(--sage)]' :
                  req.status === 'in_progress' ? 'bg-amber-400' : 'bg-[var(--sky-wash)]'
                }`} />
                <div>
                  <div className="text-[var(--warm-ink)] text-sm font-medium">{req.title}</div>
                  <div className="text-[var(--soft-stone)] text-xs flex items-center gap-2">
                    <span className="capitalize">{req.category}</span>
                    <span>•</span>
                    <span>{new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    {req.hasStake && (
                      <>
                        <span>•</span>
                        <span className="text-[var(--dusty-rose)]">Priority Staked</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                req.status === 'completed' ? 'bg-[var(--sage)]/20 text-[var(--sage)]' :
                req.status === 'in_progress' ? 'bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]' :
                'bg-[var(--sky-wash)]/20 text-[var(--sky-wash)]'
              }`}>
                {req.status === 'in_progress' ? 'In Progress' : req.status === 'completed' ? 'Completed' : 'Submitted'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
