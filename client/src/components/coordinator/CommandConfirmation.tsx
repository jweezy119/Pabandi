import { useEffect, useRef } from 'react';
import type { ExecutionPlan } from './useCoordinatorCommands';

export interface CommandConfirmationProps {
  plan: ExecutionPlan;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The confirmation dialog for a state-changing command (§4.6).
 *
 * The rules this component exists to enforce:
 *  - One sentence saying what will happen, in plain language.
 *  - The confirm button carries a verb ("Assign and send"), never "OK".
 *  - Cancel is neutral and changes nothing on the server.
 *  - Only a destructive action colours its confirm button; the rest of the
 *    dialog stays neutral.
 *  - Focus moves in on open and returns on close, and Tab is trapped while it
 *    is open — a modal that lets focus escape is not modal.
 */
export default function CommandConfirmation({
  plan,
  onConfirm,
  onCancel,
}: CommandConfirmationProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      returnFocusRef.current?.focus();
    };
  }, [onCancel]);

  return (
    <div
      className="pbn-dialog"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="pbn-dialog__panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pbn-confirm-title"
        aria-describedby="pbn-confirm-consequence"
      >
        <div className="pbn-dialog__header">
          <h2 className="pbn-dialog__title" id="pbn-confirm-title">
            {plan.title}
          </h2>
        </div>
        <div className="pbn-dialog__body">
          <p id="pbn-confirm-consequence">{plan.consequence}</p>
        </div>
        <div className="pbn-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="pbn-btn pbn-btn--ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`pbn-btn ${plan.destructive ? 'pbn-btn--danger' : 'pbn-btn--primary'}`}
            onClick={onConfirm}
          >
            {plan.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
