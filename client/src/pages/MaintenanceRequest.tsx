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
  low: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-red-500/30 bg-red-500/10 text-red-300',
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
        <h1 className="text-2xl md:text-3xl font-bold text-white">Maintenance Request</h1>
        <p className="text-slate-400 text-sm mt-1">Report an issue in your unit</p>
      </div>

      {submitted && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-emerald-300 text-sm font-medium">Request submitted successfully!</span>
        </div>
      )}

      {/* New Request Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4">New Request</h2>

          {/* Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Provide details about the issue..."
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* Photos */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Photos</label>
            <div className="flex gap-3">
              {photos.map((_photo, i) => (
                <div key={i} className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-xs text-slate-500">
                  📷 {i + 1}
                </div>
              ))}
              <button
                type="button"
                onClick={handlePhotoUpload}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
              >
                <span className="material-symbols-outlined">add_photo_alternate</span>
              </button>
            </div>
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
            <div className="grid grid-cols-3 gap-3">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    priority === p.id ? PRIORITY_COLORS[p.id] : 'border-white/10 bg-white/5 text-slate-500'
                  }`}
                >
                  <div className="font-semibold text-sm">{p.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stake for Priority */}
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={stakeForPriority}
                onChange={(e) => setStakeForPriority(e.target.checked)}
                className="w-5 h-5 rounded bg-black/30 border-white/20 text-purple-500 focus:ring-purple-500"
              />
              <div>
                <div className="text-white text-sm font-medium">Stake PAB for priority processing</div>
                <div className="text-slate-400 text-xs">Get faster response by staking PAB tokens. Returned after completion.</div>
              </div>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={!category || !title}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Request
        </button>
      </form>

      {/* Existing Requests */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Your Requests</h2>
        <div className="space-y-3">
          {existingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  req.status === 'completed' ? 'bg-emerald-400' :
                  req.status === 'in_progress' ? 'bg-amber-400' : 'bg-blue-400'
                }`} />
                <div>
                  <div className="text-white text-sm font-medium">{req.title}</div>
                  <div className="text-slate-500 text-xs flex items-center gap-2">
                    <span className="capitalize">{req.category}</span>
                    <span>•</span>
                    <span>{new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    {req.hasStake && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400">Priority Staked</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                req.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                req.status === 'in_progress' ? 'bg-amber-500/20 text-amber-300' :
                'bg-blue-500/20 text-blue-300'
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
