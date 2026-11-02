import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

type BannerVariant = 'job_complete' | 'overdue_invoices' | 'score_dropping' | 'all_well';

interface AssistiveBannerProps {
  variant: BannerVariant;
  actionLabel: string;
  actionHref: string;
  dismissible?: boolean;
  /** Override the canned title (e.g. real escrow counts from the stats API). */
  title?: string;
  /** Override the canned body copy. */
  body?: string;
}

const BANNER_CONFIG: Record<BannerVariant, { icon: React.ReactNode; title: string; body: string; action: string; color: string }> = {
  job_complete: {
    icon: <CheckCircle className="w-5 h-5 text-[var(--sage)]" />,
    title: 'Work finished — review and release',
    body: 'Your roof repair is finished. Tap to review proof and release escrow.',
    action: 'Release Funds',
    color: 'text-[var(--terracotta)] bg-[var(--sage)]/15 border border-[var(--sage)]/40',
  },
  overdue_invoices: {
    icon: <AlertTriangle className="w-5 h-5 text-[var(--terracotta)]" />,
    title: 'Overdue invoices need attention',
    body: 'You have 2 overdue invoices. Tap to send a reminder.',
    action: 'Send Reminder',
    color: 'text-[var(--warm-ink)] bg-[var(--warm-sand)]/70 border border-[var(--clay)]/40',
  },
  score_dropping: {
    icon: <Clock className="w-5 h-5 text-[var(--terracotta)]" />,
    title: 'Trust Score alert',
    body: 'Your payment score dropped by 10 points. Book a service this week to recover it.',
    action: 'Book a Service',
    color: 'text-[var(--warm-ink)] bg-[var(--warm-sand)]/70 border border-[var(--clay)]/40',
  },
  all_well: {
    icon: <Sparkles className="w-5 h-5 text-[var(--sage)]" />,
    title: 'All caught up',
    body: "Your Trust Score is in good standing.",
    action: 'Continue',
    color: 'text-[var(--warm-ink)] bg-[var(--sage)]/15 border border-[var(--sage)]/40',
  },
};

export function AssistiveBanner({ variant, actionLabel, actionHref, dismissible = true, title, body }: AssistiveBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = BANNER_CONFIG[variant];

  // Auto-dismiss based on context (e.g., if score is good, show less urgently)
  useEffect(() => {
    // No auto-dismiss for actionable items
  }, []);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`mb-6 p-4 rounded-xl border ${config.color} flex items-start gap-3`}
        >
          <div className="flex-shrink-0">{config.icon}</div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">{title ?? config.title}</h3>
            <p className="text-xs text-[var(--soft-stone)] mt-1">{body ?? config.body}</p>
          </div>
          <div className="flex-shrink-0">
            <Link
              to={actionHref}
              className="px-3 py-2 rounded-lg bg-[var(--clay)] text-[var(--warm-ink)] font-label text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[var(--shadow-btn)]"
            >
              {actionLabel} <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
          {dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 ml-2 p-1 text-[var(--soft-stone)] hover:text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] rounded transition-colors"
              aria-label="Dismiss"
            >
              <span className="text-[10px]">✕</span>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AssistiveBanner;
