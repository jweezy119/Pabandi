import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

interface ClaySelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

export default function ClaySelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = false,
  clearable = false,
  error,
  hint,
  disabled = false,
}: ClaySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, search]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-sm font-medium text-[var(--warm-ink)] mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${
          error ? 'border-red-400' : 'border-[rgba(191,179,163,0.3)]'
        } ${disabled ? 'bg-[rgba(191,179,163,0.05)] text-[var(--soft-stone)] cursor-not-allowed' : 'bg-white/50 text-[var(--warm-ink)] hover:border-[var(--clay)]/40'}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.icon && <span>{selected.icon}</span>}
          <span className={selected ? '' : 'text-[var(--soft-stone)]'}>{selected?.label || placeholder}</span>
        </span>
        <div className="flex items-center gap-1">
          {clearable && value && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="p-0.5 hover:bg-[var(--warm-sand)] rounded"
            >
              <X size={14} className="text-[var(--soft-stone)]" />
            </span>
          )}
          <ChevronDown size={16} className={`text-[var(--soft-stone)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--cream)] shadow-lg overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-[rgba(191,179,163,0.1)]">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/60">
                <Search size={14} className="text-[var(--soft-stone)]" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-sm outline-none text-[var(--warm-ink)] placeholder-[var(--soft-stone)]"
                />
              </div>
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--soft-stone)] text-center">No options found</p>
            ) : (
              filtered.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { onChange(option.value); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[var(--warm-sand)]/30 transition-colors ${
                    value === option.value ? 'bg-[var(--clay)]/5 text-[var(--clay)]' : 'text-[var(--warm-ink)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {option.icon && <span>{option.icon}</span>}
                    {option.label}
                  </span>
                  {value === option.value && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--soft-stone)] mt-1">{hint}</p>}
    </div>
  );
}
