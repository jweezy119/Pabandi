import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAuthToken } from '../utils/authToken';

/**
 * The other side of a trust proof.
 *
 * A client hands a business a short code. The business pastes it here and learns one
 * thing: whether this person clears the bar for the terms they were about to offer.
 *
 * This page is deliberately PUBLIC and works with no account. That is the whole reason
 * a proof is worth anything: it can be checked by a business that has never heard of
 * us, using only the published key. Putting this behind a login would leave the
 * stranger with nothing — they would have to sign up to learn whether a stranger is
 * safe to work with, which is the exact friction the proof exists to remove.
 *
 * ── WHAT THE VERIFIER LEARNS ─────────────────────────────────────────────────
 *
 * A band, and whether it clears the bar they chose. Not the score. Not who they are.
 * Not anything about anyone else. The verification is stateless, so there is no
 * account, no record and nothing stored about who checked what.
 *
 * ── WHY THE THRESHOLD IS THE FIRST QUESTION ──────────────────────────────────
 *
 * A band on its own is a number the verifier has to interpret. The decision they are
 * actually making is "can I offer this person net-30", so the control is stated in
 * those terms and the thresholds match the invoice terms tiers exactly. A proof that
 * says ESTABLISHED is worth nothing; a proof that says "yes, you can safely offer net-30"
 * changes what happens next.
 *
 * ── THE VOCABULARY ───────────────────────────────────────────────────────────
 *
 * The same rule as the issuing side: no wallet, no signature, no credential, no
 * blockchain. A business owner checking whether to extend terms is doing a commercial
 * check, and naming the technology would make it sound like a technical one.
 */

const API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1`;

/** These are the same tiers the invoice terms engine prices with, deliberately. */
const BARS = [
  { value: 0, label: 'Any standing', terms: 'due on receipt' },
  { value: 40, label: 'Build a relationship', terms: 'deposit first' },
  { value: 50, label: 'Work on their terms', terms: 'due on receipt' },
  { value: 70, label: 'Offer normal terms', terms: 'net-30' },
  { value: 80, label: 'Offer extended terms', terms: 'net-60' },
];

const BAND_WORDS: Record<string, string> = {
  TOP: 'Established',
  ESTABLISHED: 'Established',
  STEADY: 'Steady',
  DEVELOPING: 'Building',
  EARLY: 'Building',
};

type Result =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'unreachable' }
  | { state: 'done'; valid: boolean; band?: string; meets?: boolean; reason?: string };

export default function TrustVerifyPage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState('');
  const [bar, setBar] = useState(70);
  const [result, setResult] = useState<Result>({ state: 'idle' });

  // Arriving with ?proof= means the client sent them a link rather than a paste, which
  // is the better case: they cannot fat-finger it and the proof is not sitting in a
  // chat history they might accidentally forward.
  useEffect(() => {
    const fromLink = params.get('proof');
    if (fromLink) {
      setCode(fromLink);
      void check(fromLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Signed-in businesses scope the check to themselves, which turns the audience
   *  guarantee on: a proof minted for someone else is then rejected rather than
   *  accepted as merely genuine. */
  function audience(): string | undefined {
    try {
      const raw = localStorage.getItem('businessId');
      return raw || undefined;
    } catch {
      return undefined;
    }
  }

  async function check(value: string) {
    const token = getAuthToken();
    setResult({ state: 'checking' });
    try {
      const res = await fetch(`${API}/trust/verify-disclosure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional. A signed-in business gets their audience bound; a stranger does
          // not need an account to check a proof.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ credential: value, threshold: bar, audienceBusinessId: audience() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('unreachable');

      setResult({
        state: 'done',
        valid: !!body?.data?.valid,
        band: body?.data?.band,
        meets: body?.data?.meetsThreshold,
        reason: body?.data?.reason,
      });
    } catch {
      // Distinguishes "we could not check" from "the proof did not check out", which
      // are very different and conflating them would have someone refusing work on a
      // network problem.
      setResult({ state: 'unreachable' });
    }
  }

  const selectedBar = BARS.find((b) => b.value === bar)!;

  return (
    <div className="min-h-screen bg-[var(--warm-sand)]/25 clay-fade">
      <div className="max-w-2xl mx-auto px-5 py-14">
        <Link to="/" className="text-sm text-[var(--soft-stone)] hover:text-[var(--warm-ink)] inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Pabandi
        </Link>

        <h1 className="text-3xl font-bold clay-heading mt-6" style={{ fontFamily: 'var(--font-headline)' }}>
          Check someone's standing
        </h1>
        <p className="mt-2" style={{ color: 'var(--soft-stone)', maxWidth: '46ch' }}>
          If someone gave you a code, paste it here. You'll find out whether they meet
          the bar for the terms you were going to offer them — and nothing else. No
          account needed, and nothing about them is kept.
        </p>

        <div className="mt-8 p-6 rounded-2xl bg-white shadow-sm border border-[rgba(191,179,163,0.4)] space-y-5">
          <div>
            <label htmlFor="verify-code" className="block text-sm font-medium mb-2" style={{ color: 'var(--warm-ink)' }}>
              Their code
            </label>
            <textarea
              id="verify-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={3}
              placeholder="Paste the code you were sent"
              className="w-full px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-sm"
            />
          </div>

          <div>
            <label htmlFor="verify-bar" className="block text-sm font-medium mb-2" style={{ color: 'var(--warm-ink)' }}>
              What do you need to know?
            </label>
            <select
              id="verify-bar"
              value={bar}
              onChange={(e) => setBar(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-sm bg-white"
            >
              {BARS.map((b) => (
                <option key={b.value} value={b.value}>
                  Can I offer {b.terms}? — {b.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => check(code)}
            disabled={!code.trim() || result.state === 'checking'}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--clay)' }}
          >
            {result.state === 'checking' ? 'Checking…' : 'Check it'}
          </button>

          {result.state === 'unreachable' && (
            <p role="alert" className="text-sm" style={{ color: 'var(--dusty-rose)' }}>
              We couldn't check that just now. That's a problem on our side, not a bad
              result — try again in a moment.
            </p>
          )}

          {result.state === 'done' && !result.valid && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(232,217,197,0.4)' }}>
              <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>
                This code doesn't check out
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>
                {result.reason} A fresh code is valid for 24 hours, so ask for a new one
                if they gave it to you a while ago.
              </p>
            </div>
          )}

          {result.state === 'done' && result.valid && (
            <div
              className="p-4 rounded-xl"
              style={{ background: result.meets ? 'rgba(143,166,128,0.2)' : 'rgba(232,217,197,0.4)' }}
            >
              <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>
                {result.meets
                  ? `Yes — you can offer ${selectedBar.terms}.`
                  : `Not quite — hold off on ${selectedBar.terms}.`}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>
                Their standing is {BAND_WORDS[result.band ?? ''] ?? 'established'}.{' '}
                {result.meets
                  ? 'That is all you learn from this — not their history, not who they are, and not anything about anyone else.'
                  : 'They may still be worth working with on different terms. This is a starting point, not a judgement.'}
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs" style={{ color: 'var(--soft-stone)', maxWidth: '52ch' }}>
          Codes are issued by Pabandi and can be checked by anyone, signed in or not. A
          check reveals one fact — whether the person is above the bar you set — and
          leaves nothing behind.
        </p>
      </div>
    </div>
  );
}
