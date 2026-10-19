import { useEffect, useState } from 'react';
import { X, Shield, AlertTriangle } from 'lucide-react';

/**
 * Embedded deposit checkout.
 *
 * ─── WHY AN IFRAME AND NOT A PRIVY MODAL ────────────────────────────────────
 * Privy is installed and there is a `PrivyProvider` wrapper, but it is not
 * mounted anywhere in the app, it is gated on VITE_PRIVY_APP_ID, and it is
 * configured `walletChainType: 'solana-only'`. Building on it here would mean
 * first wiring up an unmounted provider, which is a larger change than this
 * step warrants and would affect every page.
 *
 * An iframe keeps the user in the app, which is the actual requirement: no
 * redirect away from the booking flow. The payment provider decides what lives
 * inside it.
 *
 * ─── THE SANDBOX IS LOAD-BEARING ────────────────────────────────────────────
 * `sandbox` is not optional and the attribute is not decorative. Without it the
 * framed document is same-origin with us and can reach `window.parent`,
 * including the session token the apiClient interceptor holds. With it, the
 * frame gets no allow-same-origin, so it is an opaque origin: it can run its
 * own script and take payment input, but it cannot read our DOM, our storage,
 * or our cookies.
 *
 * Do not add `allow-same-origin` and `allow-scripts` together -- that
 * combination removes the sandbox entirely and defeats the point.
 */

export interface DepositPrompt {
  /** Where to send the user to fund. Absolute URL supplied by the engine. */
  checkoutUrl: string;
  /** What the deposit is for, shown so the figure is not a mystery. */
  description?: string;
  amount?: number;
  currency?: string;
}

interface Props {
  prompt: DepositPrompt | null;
  onClose: () => void;
  /** Fired when the user says they have funded. Not proof -- the engine re-checks. */
  onFunded: () => void;
}

export function EmbeddedCheckoutModal({ prompt, onClose, onFunded }: Props) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Reset the spinner whenever a different checkout opens.
    setLoaded(false);
  }, [prompt?.checkoutUrl]);

  useEffect(() => {
    if (!prompt) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, onClose]);

  if (!prompt) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Complete your deposit"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--cream)] rounded-2xl border border-[rgba(191,179,163,0.3)] shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(191,179,163,0.2)]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[var(--sage)]" />
            <h2 className="text-base font-semibold text-[var(--warm-ink)]">Confirm your deposit</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-[var(--soft-stone)] hover:bg-[var(--warm-sand)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {prompt.amount !== undefined && (
          <div className="px-5 py-3 bg-[var(--sage)]/8 border-b border-[var(--sage)]/15">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--soft-stone)]">Deposit</span>
              <span className="text-lg font-bold text-[var(--warm-ink)]">
                {prompt.currency ?? 'USDC'} {prompt.amount}
              </span>
            </div>
            {prompt.description && (
              <p className="text-xs text-[var(--soft-stone)] mt-1">{prompt.description}</p>
            )}
          </div>
        )}

        <div className="relative bg-white/40" style={{ height: 420 }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin" />
            </div>
          )}
          <iframe
            src={prompt.checkoutUrl}
            title="Deposit checkout"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
          />
        </div>

        <div className="px-5 py-4 border-t border-[rgba(191,179,163,0.2)] space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-[var(--clay)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
              Your booking is held until the deposit clears. Close this window to go back and review your
              details — nothing is lost.
            </p>
          </div>
          <button
            onClick={onFunded}
            className="w-full py-3 rounded-xl bg-[var(--clay)] text-white font-semibold hover:bg-[var(--terracotta)] transition-colors"
          >
            I&apos;ve funded it
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmbeddedCheckoutModal;