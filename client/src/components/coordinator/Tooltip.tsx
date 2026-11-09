import { useEffect, useId, useRef, useState } from 'react';

export interface TooltipProps {
  /**
   * One plain-language sentence. This component exists because a risk score
   * or an AI suggestion means nothing to a first-time owner without it — see
   * §4.2 of the spec. Keep it to one sentence; a second sentence means the
   * explanation belongs in the inspector instead.
   */
  text: string;
  /** Accessible name for the trigger button. */
  label?: string;
  /**
   * Stable hook for the keyboard-navigation test. Every focusable element in
   * the shell carries one of these so a test can assert tab order by id
   * instead of by fragile DOM position.
   */
  focusId?: string;
}

/**
 * The "?" affordance used on every risk score, prediction and technical term.
 *
 * Keyboard behaviour: the trigger is a real button, so Enter and Space toggle
 * it. Escape closes it and stops propagation so it does not also close the
 * inspector underneath. A pointer-down outside the tooltip closes it too,
 * because a tooltip that stays open after you click away is clutter.
 */
export default function Tooltip({ text, label = 'What does this mean?', focusId }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <span className="pbn-tooltip" ref={rootRef}>
      <button
        type="button"
        className="pbn-tooltip__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-pbn-focus-id={focusId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <span id={id} role="tooltip" className="pbn-tooltip__bubble">
          {text}
        </span>
      )}
    </span>
  );
}
