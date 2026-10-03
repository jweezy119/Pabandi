import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Shown instead of a business surface when the account is in Personal mode.
 *
 * WHY THIS EXISTS
 * ---------------
 * BusinessGuard used to answer a personal-mode request for a business page with
 * `<Navigate to="/" replace />`. Three things were wrong with that:
 *
 *   1. The navigation offered "Contact OS" unconditionally, so the guard and the nav
 *      disagreed. The user could click a link the app had already decided to refuse.
 *   2. The bounce was silent. Nothing said "personal accounts cannot open this", so
 *      the only observable effect was landing on the marketing homepage — which reads
 *      as the app being broken rather than as a mode mismatch. This is the report
 *      "clicking Contact OS brings us back to pabandi.com".
 *   3. `replace` destroyed the requested URL, so Back could not return them to it and
 *      retrying was impossible. PersonalGuard's own comment criticises landing users
 *      "on a marketing page"; BusinessGuard was doing exactly that.
 *
 * So the guard's intent is kept — Contact OS stays a business surface — but the click
 * is no longer discarded. The requested path is captured before switching and the user
 * is returned to it afterwards, so "Contact OS" actually opens Contact OS.
 */
export function BusinessModeGate({ areaName = 'this tool' }: { areaName?: string }) {
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleMode } = useAuthStore();

  // Captured from the location rather than passed in: BusinessGuard replaces the
  // element, so the requested path is the only record of what was asked for.
  const intended = location.pathname + location.search;

  const handleSwitch = async () => {
    setIsSwitching(true);
    setError(null);
    try {
      // Navigate only after the switch is confirmed. Navigating first would land on a
      // route whose guard still reads the OLD mode and would bounce straight back.
      await toggleMode('business');
      navigate(intended, { replace: true });
    } catch (err) {
      console.error('Failed to switch to business mode:', err);
      setError('Could not switch account. Try again, or switch from the avatar menu.');
      setIsSwitching(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div
        className="max-w-md w-full text-center rounded-2xl p-8"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--outline-variant)',
        }}
      >
        <h2 className="font-headline text-xl font-bold mb-2" style={{ color: 'var(--warm-ink)' }}>
          {areaName} is part of your business account
        </h2>

        <p className="text-sm mb-6" style={{ color: 'var(--warm-ink)' }}>
          You are currently in <strong>Personal</strong> mode. Switch to <strong>Business</strong>{' '}
          to open {areaName} — it is where your clients, jobs and invoices live.
        </p>

        <button
          type="button"
          onClick={handleSwitch}
          disabled={isSwitching}
          className="px-5 py-2.5 rounded-full font-headline text-sm font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--clay)' }}
        >
          {isSwitching ? 'Switching…' : 'Switch to Business'}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--terracotta)' }}>
            {error}
          </p>
        )}

        <p className="mt-5 text-xs" style={{ color: 'var(--warm-ink)' }}>
          Your personal account and its rewards are still there — switch back any time from the
          avatar menu.
        </p>
      </div>
    </div>
  );
}
