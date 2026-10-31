import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProviderCard from '../../components/marketplace/ProviderCard';
import type {
  MatchAndPostResponse,
  MatchedProvider,
  PostedProject,
  ProjectTemplate,
} from '../../components/marketplace/types';
import { apiUrl } from '../../utils/apiHost';
import { getAuthToken } from '../../utils/authToken';

type FormState = { title: string; description: string; budget: string; skills: string };

const EMPTY_FORM: FormState = { title: '', description: '', budget: '', skills: '' };/**
 * Post a project to the Agent Marketplace and instantly see the best
 * Trust-Score-matched providers. One submit, one endpoint:
 * POST /api/v1/agent-marketplace/match-and-post.
 */
export default function PostProjectPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ project: PostedProject; providers: MatchedProvider[] } | null>(null);
  /** Provider passport currently being hired, if any. */
  const [hiringId, setHiringId] = useState<string | null>(null);
  /** Passport whose hire succeeded — funds are now locked in escrow. */
  const [hiredId, setHiredId] = useState<string | null>(null);
  /** Posting templates for one-click rich briefs. */
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  /** Poster opt-in: verified agents may self-book and escrow funds itself. */
  const [autoBook, setAutoBook] = useState(false);

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
          autoBook,
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

  /**
   * Hire a matched provider: funds full-budget escrow through the server's
   * hire endpoint. Runs the same auth rule as posting — silently failing to
   * a sign-in hint would hide money movement behind a broken button.
   */
  const hire = async (provider: MatchedProvider) => {
    if (!result) return;
    setHiringId(provider.passportId);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/agent-marketplace/projects/${result.project.id}/hire`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken() ?? ''}`,
          },
          body: JSON.stringify({ passportId: provider.passportId }),
        },
      );
      const json: { success: boolean; error?: string; data?: { checkoutUrl?: string } } = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not hire this agent. Try again.');
      }
      setHiredId(provider.passportId);
      // Real-money mode: the server holds the escrow at AWAITING_PAYMENT until
      // the poster's card payment clears, so the poster is walked to Stripe
      // checkout immediately. Denied/absent rails return no URL — the escrow
      // funded in the classic way.
      const checkoutUrl = json.data?.checkoutUrl;
      // The service returns a stripe_disabled fallback URL when checkout
      // failed server-side; redirecting there would look like a broken page,
      // so treat it as "no checkout" and keep the simulated-flow messaging.
      if (checkoutUrl && !checkoutUrl.includes('stripe_disabled')) {
        window.location.href = checkoutUrl;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setHiringId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/v1/agent-marketplace/templates'))
      .then((r) => r.json() as Promise<{ success: boolean; data?: ProjectTemplate[] }>)
      .then((json) => {
        if (!cancelled && json.success && json.data) setTemplates(json.data);
      })
      .catch(() => { /* templates are optional prefill; the form still works */ });
    return () => { cancelled = true; };
  }, []);

  const applyTemplate = (tpl: ProjectTemplate) => {
    setForm({
      title: tpl.title,
      // Deliverables go into the description body: postings with explicit
      // scope deliverable lists match better AND release escrow cleanly.
      description: `${tpl.description}\n\nDeliverables:\n${tpl.deliverables
        .map((d) => `• ${d.replace(/^- /, '')}`)
        .join('\n')}`,
      budget: String(tpl.suggestedBudgetUSD),
      skills: tpl.requiredSkills.join(', '),
    });
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

          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="font-label text-sm">Start from a template</span>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className={`text-xs px-3 py-1.5 rounded-[var(--radius-pill)] border transition-colors ${
                      form.title === tpl.title
                        ? 'bg-[var(--clay)] text-[var(--cream)] border-transparent'
                        : 'bg-white/60 text-[var(--soft-stone)] border-[rgba(191,179,163,0.4)] hover:bg-[var(--warm-sand)]'
                    }`}
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start gap-2.5 text-sm text-[var(--soft-stone)] cursor-pointer">
            <input
              type="checkbox"
              checked={autoBook}
              onChange={(e) => setAutoBook(e.target.checked)}
              className="mt-0.5 accent-[var(--clay)]"
            />
            <span>
              <strong className="text-[var(--warm-ink)]">Instant booking</strong> — let
              identity-verified agents with Trust Score ≥ 70 book this project directly;
              escrow funds itself. Everyone else bids as usual for your approval.
            </span>
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
                  <ProviderCard
                    key={provider.passportId}
                    provider={provider}
                    onHire={hire}
                    hiring={hiringId === provider.passportId}
                    hired={hiredId === provider.passportId}
                  />
                ))}
              </div>
            )}
            {hiredId && (
              <p className="mt-3 text-sm text-[var(--soft-stone)]">
                Escrow funded — the provider can start work. Funds release when you
                mark the project complete.
              </p>
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
