import React from 'react';

interface InputProps {
  label?: string;
  className?: string;
  textarea?: boolean;
  /** Helper text under the field. */
  hint?: string;
  /**
   * Validation message. When set, the border goes danger and the message replaces
   * the hint — a field should say one thing about itself, not two.
   */
  error?: string;
  rows?: number;
  // Typed explicitly rather than left to the index signature below. Without these,
  // an inline `onChange={(e) => ...}` has no contextual type and `e` becomes an
  // implicit any — which is why forms here cast their event handlers by hand.
  onChange?: React.ChangeEventHandler<any>;
  onBlur?: React.FocusEventHandler<any>;
  onFocus?: React.FocusEventHandler<any>;
  [key: string]: any;
}

/**
 * The field every CRM form is built from.
 *
 * WHY ERROR WAS ADDED
 * There was no way to show a validation message, so every form either validated
 * nothing or validated on the server and surfaced the failure somewhere the person
 * could not see it. A field that cannot explain itself teaches people to ignore it.
 *
 * WHY ONBLUR IS COMPOSED RATHER THAN OVERWRITTEN
 * This component handled focus and blur itself, to animate the border, then spread
 * the caller's props after them — so passing an onBlur silently replaced the reset
 * and left the field stuck in its focused state. Anything wanting to react to blur
 * had to re-implement the visual by hand. Composing means a caller can validate on
 * blur without knowing the border is animated underneath.
 */
export function Input({ label, className = '', textarea = false, hint, error, ...props }: InputProps) {
  const { onFocus, onBlur, ...rest } = props as {
    onFocus?: React.FocusEventHandler<any>;
    onBlur?: React.FocusEventHandler<any>;
  };

  const base: React.CSSProperties = {
    borderRadius: 'var(--radius-input)',
    background: 'white',
    border: error
      ? '1.5px solid var(--dusty-rose)'
      : '1.5px solid rgba(191, 179, 163, 0.3)',
    padding: '12px 16px',
    fontSize: '14px',
    color: 'var(--warm-ink)',
    outline: 'none',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
    boxShadow: '0 1px 2px rgba(180, 130, 90, 0.04)',
    width: '100%',
    fontFamily: 'var(--font-body)',
  };

  const restStyle = error ? { borderColor: 'var(--dusty-rose)' } : { borderColor: 'rgba(191, 179, 163, 0.3)' };

  const sharedHandlers = {
    onFocus: (e: React.FocusEvent<any>) => {
      if (!error) {
        e.target.style.borderColor = 'var(--clay)';
        e.target.style.boxShadow = '0 0 0 3px rgba(201, 123, 90, 0.12)';
      }
      onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<any>) => {
      e.target.style.borderColor = restStyle.borderColor as string;
      e.target.style.boxShadow = '0 1px 2px rgba(180, 130, 90, 0.04)';
      onBlur?.(e);
    },
    // The browser's own required-message is replaced by ours. Left on, it fires
    // before onSubmit and blocks it, which would mean the two validations never
    // both run and the person sees a different complaint depending on the browser.
    ...(props.noValidate ? {} : { noValidate: props.noValidate }),
  };

  const message = error || hint;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          className="block mb-1.5"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: error ? 'var(--dusty-rose)' : 'var(--warm-ink)',
            fontFamily: 'var(--font-label)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </label>
      )}
      {textarea ? (
        <textarea
          className="clay-input"
          style={base}
          {...sharedHandlers}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className="clay-input"
          style={base}
          aria-invalid={error ? true : undefined}
          {...sharedHandlers}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {message && (
        <p
          className="mt-1"
          role={error ? 'alert' : undefined}
          style={{
            fontSize: '11px',
            color: error ? 'var(--dusty-rose)' : 'var(--soft-stone)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}