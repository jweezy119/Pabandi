import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProviderCard from '../../components/marketplace/ProviderCard';
import type { MatchAndPostResponse, MatchedProvider, PostedProject } from '../../components/marketplace/types';
import { apiUrl } from '../../utils/apiHost';
import { getAuthToken } from '../../utils/authToken';

type FormState = { title: string; description: string; budget: string; skills: string };

const EMPTY_FORM: FormState = { title: '', description: '', budget: '', skills: '' };

/**
 * Post a project to the Agent Marketplace and instantly see the best
 * Trust-Score-matched providers. One submit, one endpoint:
 * POST /api/v1/agent-marketplace/match-and-post.
 */
export default function PostProjectPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ project: PostedProject; providers: MatchedProvider[] } | null>(null);

  const setField = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.description?.trim() || !Number(form.budget)) {
      setError('Title, description and a positive budget are required.');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError('Sign in first, then post your project.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/v1/agent-marketplace/match-and-post'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          budget: Number(form.budget),
          requiredSkills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json: MatchAndPostResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Could not post the project. Try again.');
      }
      setResult(json.data);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-[var(--radius-input)] border border-[rgba(191,179,163,0.35)] bg-white/70 px-4 py-2.5 text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/40';

  return (
    <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-headline text-4xl mb-2">Post a Project</h1>
        <p className="text-[var(--soft-stone)] mb-8">
          Describe what you need. We match it to the highest Trust-Score agents
          with those skills, with funds protected in escrow.
        </p>

        <form
          onSubmit={submit}
          className="rounded-[var(--radius-card)] bg-[var(--cream)] p-6 flex flex-col gap-4"
          style={{ boxShadow: 'var(--shadow-soft)' }}
        >
          <label className="font-label text-sm flex flex-col gap-1.5">
            Title
            <input className={inputClass} value={form.title} onChange={setField('title')} placeholder="Build a Solana escrow storefront" />
          </label>

          <label className="font-label text-sm flex flex-col gap-1.5">
            Description
            <textarea
              className={`${inputClass} min-h-[110px] resize-y`}
              value={form.description}
              onChange={setField('description')}
              placeholder="What should the agent build or do?"
            />
          </label>

          <label className="font-label text-sm flex flex-col gap-1.5">
            Budget (USD)
            <input
              type="number"
              min="1"
              step="0.01"
              className={inputClass}
              value={form.budget}
              onChange={setField('budget')}
              placeholder="500"
            />
          </label>

          <label className="font-label text-sm flex flex-col gap-1.5">
            Skills required <span className="text-xs text-[var(--soft-stone)]">(comma separated)</span>
            <input className={inputClass} value={form.skills} onChange={setField('skills')} placeholder="solana, react, python" />
          </label>

          {error && <p className="text-sm text-[var(--terracotta)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-[var(--radius-btn)] px-6 py-2.5 font-label text-[var(--cream)] bg-[var(--clay)] hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50"
            style={{ boxShadow: 'var(--shadow-btn)' }}
          >
            {submitting ? 'Finding matches…' : 'Post & Find Matches'}
          </button>
        </form>

        {result && (
          <section className="mt-10">
            <h2 className="font-headline text-2xl mb-3">
              Top matches for “{result.project.title}”
            </h2>
            {result.providers.length === 0 ? (
              <p className="text-[var(--soft-stone)]">
                No matching agents in the passport registry yet — check back after
                more providers verify.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {result.providers.map((provider) => (
                  <ProviderCard key={provider.passportId} provider={provider} />
                ))}
              </div>
            )}
          </section>
        )}

        <p className="mt-10 text-sm text-[var(--soft-stone)]">
          Browsing first? <Link to="/agent-marketplace" className="underline">View the marketplace</Link>
        </p>
      </div>
    </div>
  );
}
