import React, { useState, useRef, useEffect } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface InlineEditProps {
  value: string | number;
  onSave: (val: string | number) => Promise<void> | void;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: { label: string; value: string | number }[];
  placeholder?: string;
  validate?: (val: string | number) => string | null; // returns error message if invalid
  className?: string;
  textClassName?: string;
  inputClassName?: string;
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  options = [],
  placeholder = 'Click to edit',
  validate,
  className = '',
  textClassName = '',
  inputClassName = '',
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (validate) {
      const err = validate(currentValue);
      if (err) {
        setError(err);
        return;
      }
    }

    if (currentValue !== value) {
      try {
        await onSave(currentValue);
        toast.success('Updated successfully', { style: { background: '#1C1917', color: '#F5EFE6', borderRadius: '12px' }});
      } catch (err: any) {
        setCurrentValue(value); // Revert on failure
        toast.error(err.message || 'Failed to update', { style: { background: '#EF4444', color: '#FFFFFF', borderRadius: '12px' }});
      }
    }
    
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
      setError(null);
    } else if (e.key === 'Enter' && type !== 'textarea') {
      handleSave();
    }
  };

  const displayValue = () => {
    if (type === 'select') {
      const opt = options.find(o => String(o.value) === String(currentValue));
      return opt ? opt.label : (currentValue || placeholder);
    }
    return currentValue || placeholder;
  };

  if (!isEditing) {
    return (
      <div 
        className={`group relative inline-flex items-center gap-2 cursor-pointer rounded -ml-2 px-2 py-1 hover:bg-[rgba(191,179,163,0.1)] transition-colors ${className}`}
        onClick={() => setIsEditing(true)}
        title="Click to edit"
      >
        <span className={`truncate ${!currentValue ? 'text-[var(--clay)] italic' : ''} ${textClassName}`}>
          {displayValue()}
        </span>
        <PencilIcon className="w-3.5 h-3.5 text-[var(--clay)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  const baseInputClass = `w-full rounded-md border ${error ? 'border-red-500 focus:border-red-500' : 'border-[var(--clay)] focus:border-[var(--warm-ink)]'} bg-[var(--warm-sand)] px-3 py-1.5 text-sm text-[var(--warm-ink)] outline-none transition-colors ${inputClassName}`;

  return (
    <div className={`relative ${className}`}>
      {type === 'textarea' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={currentValue as string}
          onChange={(e) => { setCurrentValue(e.target.value); setError(null); }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`${baseInputClass} min-h-[80px] resize-y`}
          placeholder={placeholder}
        />
      ) : type === 'select' ? (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={currentValue as string}
          onChange={(e) => { setCurrentValue(e.target.value); setError(null); }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={baseInputClass}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={currentValue as string | number}
          onChange={(e) => { setCurrentValue(e.target.value); setError(null); }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={baseInputClass}
          placeholder={placeholder}
        />
      )}
      {error && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500 font-medium z-10 bg-white px-2 py-1 rounded shadow-sm border border-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
