import React from 'react';

interface ClayTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
}

export function ClayTextarea({ label, error, hint, className = '', style, ...props }: ClayTextareaProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block mb-1.5 font-label" style={{
          fontSize: '11px', fontWeight: 600, color: 'var(--soft-stone)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {label}
        </label>
      )}
      <textarea
        className="clay-textarea"
        style={{
          borderRadius: 'var(--radius-input)',
          background: 'white',
          border: `1.5px solid ${error ? 'var(--dusty-rose)' : 'rgba(191,179,163,0.3)'}`,
          padding: '12px 16px',
          fontSize: '14px',
          color: 'var(--warm-ink)',
          outline: 'none',
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          boxShadow: error ? '0 0 0 3px rgba(212,165,165,0.12)' : '0 1px 2px rgba(180,130,90,0.04)',
          fontFamily: 'var(--font-body)',
          resize: 'vertical',
          minHeight: '100px',
          width: '100%',
          ...style,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = error ? 'var(--dusty-rose)' : 'var(--clay)';
          e.target.style.boxShadow = error ? '0 0 0 3px rgba(212,165,165,0.12)' : '0 0 0 3px rgba(201,123,90,0.12)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? 'var(--dusty-rose)' : 'rgba(191,179,163,0.3)';
          e.target.style.boxShadow = error ? '0 0 0 3px rgba(212,165,165,0.12)' : '0 1px 2px rgba(180,130,90,0.04)';
        }}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--dusty-rose)', fontWeight: 500 }}>{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--soft-stone)' }}>{hint}</p>
      )}
    </div>
  );
}
