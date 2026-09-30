import { useState } from 'react';
import { Surface, Badge, Button, tokens } from '../design-system';

interface Grant {
  id: string;
  projectName: string;
  description: string;
  amount: number;
  recipient: string;
  status: 'OPEN' | 'FUNDED' | 'COMPLETED';
  date: string;
}

export function GrantsPage() {
  const [showApplication, setShowApplication] = useState(false);
  const [formData, setFormData] = useState({ projectName: '', description: '', amount: '', team: '', email: '' });

  const grants: Grant[] = [
    { id: '1', projectName: 'Trust Widget for WordPress', description: 'Embeddable trust badge for WordPress sites', amount: 5000, recipient: 'DevStudio PK', status: 'COMPLETED', date: '2026-01-20' },
    { id: '2', projectName: 'Pabandi SDK for Python', description: 'Python client library for Trust API', amount: 10000, recipient: 'Open Source Contributor', status: 'FUNDED', date: '2026-03-15' },
    { id: '3', projectName: 'Escrow Plugin for Shopify', description: 'Shopify app for escrow-backed payments', amount: 25000, recipient: 'ShopifyDevs', status: 'OPEN', date: '2026-06-01' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Grant application submitted! We will review and respond within 2 weeks.');
    setShowApplication(false);
    setFormData({ projectName: '', description: '', amount: '', team: '', email: '' });
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🏆 Grants Program</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)] font-headline">
            $PAB Grants for Developers
          </h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto">
            Build on the Trust API and earn $1,000–$50,000 based on integration depth.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Surface className="text-center p-4">
            <div className="text-2xl font-bold text-[var(--warm-ink)]">$165K</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Total Funded</div>
          </Surface>
          <Surface className="text-center p-4">
            <div className="text-2xl font-bold text-[var(--sage)]">12</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Projects Funded</div>
          </Surface>
          <Surface className="text-center p-4">
            <div className="text-2xl font-bold text-[var(--clay)]">8</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Open Grants</div>
          </Surface>
          <Surface className="text-center p-4">
            <div className="text-2xl font-bold text-[var(--muted-ochre)]">45</div>
            <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Applications</div>
          </Surface>
        </div>

        {/* Past Grantees */}
        <Surface className="p-6 mb-6">
          <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Past Grantees</h2>
          <div className="space-y-3">
            {grants.map(grant => (
              <div key={grant.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--warm-sand)]">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[var(--warm-ink)]">{grant.projectName}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${grant.status === 'OPEN' ? 'bg-[var(--sage)]/20 text-[var(--sage)]' : grant.status === 'FUNDED' ? 'bg-[var(--clay)]/20 text-[var(--clay)]' : 'bg-[var(--soft-stone)]/20 text-[var(--soft-stone)]'}`}>
                      {grant.status}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--soft-stone)]">{grant.description}</p>
                  <p className="text-xs text-[var(--warm-ink)]/60 mt-1">By {grant.recipient} · {new Date(grant.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[var(--clay)]">${grant.amount.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </Surface>

        {/* Application Form */}
        <Surface className="p-6 md:p-8">
          <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-3">Apply for a Grant</h2>
          <p className="text-sm text-[var(--soft-stone)] mb-6">
            Tell us about your project. We fund integrations that expand the Trust API ecosystem.
          </p>

          {!showApplication ? (
            <Button onClick={() => setShowApplication(true)}>Start Application</Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--warm-ink)] mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={formData.projectName}
                  onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--warm-ink)] mb-1">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--warm-ink)] mb-1">Requested Amount (USD)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    max="50000"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                    style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--warm-ink)] mb-1">Team Size</label>
                  <input
                    type="text"
                    value={formData.team}
                    onChange={e => setFormData({ ...formData, team: e.target.value })}
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                    style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--warm-ink)] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit">Submit Application</Button>
                <Button variant="ghost" onClick={() => setShowApplication(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </Surface>
      </div>
    </div>
  );
}

export default GrantsPage;
