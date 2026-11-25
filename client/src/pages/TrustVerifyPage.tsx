import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { getAuthToken } from '../utils/authToken';
import GlassNavHeader from '../components/GlassNavHeader';

const API = `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1`;

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

  useEffect(() => {
    const fromLink = params.get('proof');
    if (fromLink) {
      setCode(fromLink);
      void check(fromLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setResult({ state: 'unreachable' });
    }
  }

  const selectedBar = BARS.find((b) => b.value === bar)!;

  return (
    <div className="pg-root">
      <div className="pg-grid-bg" aria-hidden="true" />
      <div className="pg-aurora a1" aria-hidden="true" />
      <div className="pg-aurora a2" aria-hidden="true" />

      <GlassNavHeader />

      <main className="pg-container" style={{ maxWidth: 760, paddingTop: 56, paddingBottom: 96 }}>
        <div className="mb-8">
          <span className="pg-eyebrow">Stateless Verification · Zero Account Needed</span>
          <h1 style={{ fontFamily: 'var(--pg-display)', fontSize: 'clamp(30px, 4.2vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em', margin: '10px 0 12px' }}>
            Check someone&apos;s <span className="pg-grad">standing</span>
          </h1>
          <p style={{ color: 'var(--pg-muted)', fontSize: 16, lineHeight: 1.6, maxWidth: '56ch', margin: 0 }}>
            Paste a Trust Passport code below to learn one fact: whether they clear the bar for the terms you want to offer — and nothing else. No login required, nothing stored.
          </p>
        </div>

        <div className="pg-glass p-6 sm:p-8 space-y-6">
          <div>
            <label htmlFor="verify-code" className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--pg-muted)' }}>
              Their verification code
            </label>
            <textarea
              id="verify-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={3}
              placeholder="Paste the Trust Passport disclosure code you were sent..."
              className="pg-textarea font-mono text-xs"
            />
          </div>

          <div>
            <label htmlFor="verify-bar" className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--pg-muted)' }}>
              What terms are you considering?
            </label>
            <select
              id="verify-bar"
              value={bar}
              onChange={(e) => setBar(Number(e.target.value))}
              className="pg-select"
            >
              {BARS.map((b) => (
                <option key={b.value} value={b.value}>
                  Can I offer {b.terms}? — {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => check(code)}
              disabled={!code.trim() || result.state === 'checking'}
              className="pg-btn pg-btn-primary"
            >
              <ShieldCheck className="w-4 h-4" />
              {result.state === 'checking' ? 'Verifying…' : 'Check standing'}
            </button>
            <Link to="/sandbox" className="pg-btn pg-btn-ghost">
              Try a sample in Sandbox →
            </Link>
          </div>

          {result.state === 'unreachable' && (
            <div role="alert" className="p-4 rounded-xl flex items-start gap-3 text-sm" style={{ background: 'rgba(255,122,144,0.12)', border: '1px solid rgba(255,122,144,0.35)', color: '#ffd0d8' }}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--pg-rose)' }} />
              <div>
                <p className="font-semibold m-0">Verification service unreachable</p>
                <p className="mt-1 m-0 opacity-85">
                  We couldn&apos;t check that just now. That&apos;s a problem on our side, not a bad result — try again in a moment.
                </p>
              </div>
            </div>
          )}

          {result.state === 'done' && !result.valid && (
            <div className="p-4 rounded-xl flex items-start gap-3 text-sm" style={{ background: 'rgba(240,180,106,0.12)', border: '1px solid rgba(240,180,106,0.35)' }}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--pg-amber)' }} />
              <div>
                <p className="font-semibold m-0" style={{ color: 'var(--pg-ink)' }}>This code doesn&apos;t check out</p>
                <p className="mt-1 m-0" style={{ color: 'var(--pg-muted)' }}>
                  {result.reason} A fresh code is valid for 24 hours, so ask for a new one if they gave it to you a while ago.
                </p>
              </div>
            </div>
          )}

          {result.state === 'done' && result.valid && (
            <div
              className="p-5 rounded-xl flex items-start gap-3 text-sm"
              style={{
                background: result.meets ? 'rgba(94,227,154,0.12)' : 'rgba(240,180,106,0.12)',
                border: result.meets ? '1px solid rgba(94,227,154,0.4)' : '1px solid rgba(240,180,106,0.4)',
              }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: result.meets ? 'var(--pg-green)' : 'var(--pg-amber)' }} />
              <div>
                <p className="font-bold text-base m-0" style={{ color: 'var(--pg-ink)' }}>
                  {result.meets
                    ? `Yes — you can offer ${selectedBar.terms}.`
                    : `Not quite — hold off on ${selectedBar.terms}.`}
                </p>
                <p className="mt-1.5 m-0" style={{ color: 'var(--pg-muted)', lineHeight: 1.6 }}>
                  Their standing is <strong style={{ color: 'var(--pg-ink)' }}>{BAND_WORDS[result.band ?? ''] ?? 'established'}</strong>.{' '}
                  {result.meets
                    ? 'That is all you learn from this — not their history, not who they are, and not anything about anyone else.'
                    : 'They may still be worth working with on different terms. This is a starting point, not a judgement.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pg-glass-subtle p-4 mt-6 flex items-start gap-3 text-xs" style={{ color: 'var(--pg-muted)', lineHeight: 1.6 }}>
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--pg-clay)' }} />
          <span>
            Codes are issued by Pabandi and can be verified offline or online by anyone, signed in or not. A check reveals one fact — whether the person clears the bar you set — and leaves nothing behind.
          </span>
        </div>
      </main>
    </div>
  );
}
