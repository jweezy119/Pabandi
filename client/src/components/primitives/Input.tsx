import React from 'react';

export function Input({ label, className = '', textarea = false, hint, ...props }: any) {
  const inputStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-input)',
    background: 'white',
    border: '1.5px solid rgba(191, 179, 163, 0.3)',
    padding: '12px 16px',
    fontSize: '14px',
    color: 'var(--warm-ink)',
    outline: 'none',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
    boxShadow: '0 1px 2px rgba(180, 130, 90, 0.04)',
    width: '100%',
    fontFamily: 'var(--font-body)',
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          className="block mb-1.5"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--warm-ink)',
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
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--clay)';
            e.target.style.boxShadow = '0 0 0 3px rgba(201, 123, 90, 0.12)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(191, 179, 163, 0.3)';
            e.target.style.boxShadow = '0 1px 2px rgba(180, 130, 90, 0.04)';
          }}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className="clay-input"
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--clay)';
            e.target.style.boxShadow = '0 0 0 3px rgba(201, 123, 90, 0.12)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(191, 179, 163, 0.3)';
            e.target.style.boxShadow = '0 1px 2px rgba(180, 130, 90, 0.04)';
          }}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {hint && (
        <p className="mt-1" style={{ fontSize: '11px', color: 'var(--soft-stone)', fontFamily: 'var(--font-body)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
