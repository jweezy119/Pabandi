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
}

const BANNER_CONFIG: Record<BannerVariant, { icon: React.ReactNode; title: string; body: string; action: string; color: string }> = {
  job_complete: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    title: 'Work finished — review and release',
    body: 'Your roof repair is finished. Tap to review proof and release escrow.',
    action: 'Release Funds',
    color: 'text-emerald-700 bg-emerald-50',
  },
  overdue_invoices: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    title: 'Overdue invoices need attention',
    body: 'You have 2 overdue invoices. Tap to send a reminder.',
    action: 'Send Reminder',
    color: 'text-amber-700 bg-amber-50',
  },
  score_dropping: {
    icon: <Clock className="w-5 h-5 text-amber-500" />,
    title: 'Trust Score alert',
    body: 'Your payment score dropped by 10 points. Book a service this week to recover it.',
    action: 'Book a Service',
    color: 'text-amber-700 bg-amber-50',
  },
  all_well: {
    icon: <Sparkles className="w-5 h-5 text-emerald-500" />,
    title: 'All caught up',
    body: "Your Trust Score is in good standing.",
    action: 'Continue',
    color: 'text-emerald-700 bg-emerald-50',
  },
};

export function AssistiveBanner({ variant, actionLabel, actionHref, dismissible = true }: AssistiveBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { user } = useAuthStore();
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
            <h3 className="font-bold text-sm {config.color.split(' ')[0]}">{config.title}</h3>
            <p className="text-xs text-amber-600 mt-1">{config.body}</p>
          </div>
          <div className="flex-shrink-0">
            <Link
              to={actionHref}
              className="px-3 py-2 rounded-lg bg-white text-amber-700 font-bold text-xs hover:bg-amber-100 transition-colors shadow-sm"
            >
              {actionLabel} <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
          {dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 ml-2 p-1 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
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
