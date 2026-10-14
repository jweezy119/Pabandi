import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthToken } from '../../../utils/authToken';
import { useBusinessSettings } from '../../../hooks/useBusinessSettings';

/**
 * First-run guidance, driven by what is actually in the account.
 *
 * WHY THIS IS NOT THE TOUR THAT WAS ALREADY IN THE REPO
 *
 * `OnboardingTour` was a coach-mark tour: six steps, each anchored to a `targetId`,
 * each measuring the element's `getBoundingClientRect` to place a tooltip. All six of
 * its target ids — balance-card, trust-tier, pay-rent-btn, staking-card,
 * maintenance-btn, history-card — match zero elements anywhere in the codebase. Every
 * step would have fallen through to its centred fallback, so the six tooltips would
 * have stacked on top of each other in the middle of the screen.
 *
 * The content was also for a different product: staking PAB, trust tiers, paying rent
 * in USDC. Shipping it would have told a salon owner that their new CRM is a crypto
 * wallet.
 *
 * Anchoring a tour to DOM ids is fragile by construction — an id is a string, nothing
 * validates it, and a renamed element breaks it silently. So this does not anchor
 * anything. It reports what the account actually contains and links to the real
 * screens, and it disappears when the work is genuinely done.
 *
 * That also makes it self-verifying: the checklist cannot tell someone they are ready
 * when they are not, because readiness is read from the same rows the rest of the CRM
 * reads.
 */

interface Progress {
  clients: number;
  jobs: number;
  deals: number;
  openTasks: number;
  sentInvoices: number;
}

type Step = {
  key: keyof Progress;
  title: string;
  detail: string;
  href: string;
  cta: string;
  /** Feature flag from the vertical preset; a step for a disabled feature is omitted. */
  feature?: string;
};

const STEPS: Step[] = [
  {
    key: 'clients',
    title: 'Add your first client',
    detail: 'Everyone you do business with, with their details and how you found them.',
    href: '/contact/clients',
    cta: 'Add a client',
    feature: 'clients',
  },
  {
    key: 'jobs',
    title: 'Record a job',
    detail: 'Log work as you do it. Completed jobs build the client’s trust score.',
    href: '/contact/jobs',
    cta: 'Schedule a job',
    feature: 'jobs',
  },
  {
    key: 'sentInvoices',
    title: 'Send an invoice',
    detail: 'A draft is not counted — send it once the work is agreed.',
    href: '/contact/invoices',
    cta: 'Create an invoice',
    feature: 'invoices',
  },
  {
    key: 'deals',
    title: 'Track a deal',
    detail: 'Anything you have quoted but not yet started.',
    href: '/contact/deals',
    cta: 'Add a deal',
    feature: 'deals',
  },
  {
    key: 'openTasks',
    title: 'Create a task',
    detail: 'The follow-ups you would otherwise keep in your head.',
    href: '/contact/tasks',
    cta: 'Add a task',
    feature: 'tasks',
  },
];

const DISMISS_KEY = 'pabandi.firstRunChecklist.dismissed';

export function FirstRunChecklist() {
  const { settings } = useBusinessSettings();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    // localStorage can throw in private browsing; an undismissable checklist is a far
    // better failure than a page that will not render.
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

    fetch(`${base}/api/v1/crm/setup-progress`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (!cancelled) setProgress(body?.data ?? null);
      })
      // A failure leaves progress null and renders nothing. Guessing at zero would show
      // a new user five "you haven't done this yet" items for a workspace that is in
      // fact fully set up.
      .catch(() => { if (!cancelled) setProgress(null); });

    return () => { cancelled = true; };
  }, []);

  if (dismissed || !progress) return null;

  const enabled = settings.enabledFeatures?.contact ?? [];
  // A step for a feature this vertical does not have is not "not done", it does not
  // apply. Offering it would send someone to a page that redirects straight back.
  const steps = STEPS.filter((s) => !s.feature || enabled.includes(s.feature));
  const remaining = steps.filter((s) => (progress[s.key] ?? 0) === 0);

  // Nothing left to do — get out of the way. Reappearing at the bottom of the list on
  // a page someone visits every day would make it noise they learn to skip.
  if (remaining.length === 0) return null;

  const done = steps.length - remaining.length;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Non-fatal: it is hidden for this session either way.
    }
  };

  return (
    <section
      aria-labelledby="first-run-heading"
      className="clay-rise p-5 rounded-2xl bg-white border border-[rgba(191,179,163,0.4)]"
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 id="first-run-heading" className="text-lg font-bold clay-heading">
            Getting started
          </h2>
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
            {done} of {steps.length} done. This disappears once it’s finished.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss getting started"
          className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-[var(--warm-sand)]/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%`, background: 'var(--sage)' }}
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={steps.length}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => {
          const complete = (progress[step.key] ?? 0) > 0;
          return (
            <li key={step.key}>
              {complete ? (
                <div className="flex items-start gap-3 p-2.5 rounded-xl opacity-60">
                  <span className="material-symbols-outlined text-[18px] mt-0.5" style={{ color: 'var(--sage)' }} aria-hidden="true">
                    check_circle
                  </span>
                  <span className="text-sm" style={{ color: 'var(--soft-stone)' }}>
                    {step.title}
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[var(--warm-sand)]/15 transition-colors">
                  <span className="material-symbols-outlined text-[18px] mt-0.5" style={{ color: 'var(--soft-stone)' }} aria-hidden="true">
                    radio_button_unchecked
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>
                      {step.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                      {step.detail}
                    </p>
                  </div>
                  <Link
                    to={step.href}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
                    style={{ background: 'var(--clay)' }}
                  >
                    {step.cta}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default FirstRunChecklist;