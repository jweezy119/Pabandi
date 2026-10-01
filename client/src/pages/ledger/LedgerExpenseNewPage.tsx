import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/primitives';
import { getAuthToken } from '../../utils/authToken';

const LEDGER_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/capital`;

type Category = string;

const CATEGORIES: Category[] = [
  'materials', 'labour', 'rent', 'utilities', 'transport',
  'equipment', 'software', 'marketing', 'insurance', 'taxes', 'other',
];

/**
 * Create an expense.
 *
 * Reached from the Expenses page's "Add Expense" button, which pointed at
 * /capital/expenses/new — a path with no route, so the primary action on that
 * page blanked the app. This is that page.
 */
export default function LedgerExpenseNewPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>('materials');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [incurredAt, setIncurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Number(amount) > 0 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${LEDGER_API}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken() || ''}`,
        },
        body: JSON.stringify({
          category,
          amount: Number(amount),
          description: description.trim() || undefined,
          incurredAt: new Date(`${incurredAt}T12:00:00`).toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not save (${res.status})`);
      }

      // Back to the list, which refetches on mount, so the new row appears.
      navigate('/capital/expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the expense');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/capital/expenses')} icon="arrow_back">
          Expenses
        </Button>
      </div>

      <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Add Expense</h1>

      <form
        onSubmit={handleSubmit}
        className="rounded-[var(--radius-card)] p-6 space-y-5"
        style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
      >
        <div>
          <label htmlFor="amount" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
            Amount (USD) *
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'rgba(191,179,163,0.4)' }}
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
            Category *
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'rgba(191,179,163,0.4)' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="incurredAt" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
            Date incurred
          </label>
          <input
            id="incurredAt"
            type="date"
            value={incurredAt}
            onChange={(e) => setIncurredAt(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'rgba(191,179,163,0.4)' }}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'rgba(191,179,163,0.4)' }}
          />
        </div>

        {error && (
          <div className="clay-alert clay-alert--critical">
            <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/capital/expenses')} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!canSubmit}>
            {saving ? 'Saving…' : 'Save Expense'}
          </Button>
        </div>
      </form>
    </div>
  );
}
