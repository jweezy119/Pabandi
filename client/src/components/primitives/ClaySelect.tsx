import { useState } from 'react';

interface ClaySelectOption {
  value: string;
  label: string;
}

interface ClaySelectProps {
  label?: string;
  value: string;
  options: ClaySelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
}

export function ClaySelect({ label, value, options, onChange, placeholder = 'Select...', className = '', disabled, error, hint }: ClaySelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

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
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-all duration-200 clay-field-input clay-select-trigger ${isOpen ? 'clay-select-open' : ''}`}
          style={{
            backgroundColor: 'white',
            borderColor: error ? 'var(--dusty-rose)' : isOpen ? 'var(--clay)' : 'rgba(191,179,163,0.3)',
            boxShadow: error ? '0 0 0 3px rgba(212,165,165,0.12)' : isOpen ? '0 0 0 3px rgba(201,123,90,0.12)' : '0 1px 2px rgba(180,130,90,0.04)',
            color: value ? 'var(--warm-ink)' : 'var(--soft-stone)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="text-sm font-medium truncate">{selectedLabel}</span>
          <span className="material-symbols-outlined text-sm transition-transform duration-200" style={{
            color: 'var(--soft-stone)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            arrow_drop_down
          </span>
        </button>

        {isOpen && (
          <div
            className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden clay-dropdown-menu"
            style={{
              backgroundColor: 'white',
              border: '1px solid rgba(191,179,163,0.3)',
              boxShadow: '0 8px 24px rgba(42,37,32,0.12), 0 2px 4px rgba(180,130,90,0.06)',
              maxHeight: '240px',
              overflowY: 'auto',
            }}
          >
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setIsOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--warm-sand)]/40"
                style={{
                  backgroundColor: option.value === value ? 'rgba(201,123,90,0.10)' : 'transparent',
                  color: option.value === value ? 'var(--clay)' : 'var(--warm-ink)',
                  fontWeight: option.value === value ? 600 : 400,
                }}
                role="option"
                aria-selected={option.value === value}
              >
                <span className="text-sm">{option.label}</span>
                {option.value === value && (
                  <span className="material-symbols-outlined text-sm" style={{ color: 'var(--clay)', fontSize: '16px' }}>check</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--dusty-rose)', fontWeight: 500 }}>{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--soft-stone)' }}>{hint}</p>
      )}
    </div>
  );
}
