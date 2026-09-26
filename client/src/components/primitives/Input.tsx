import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  textarea?: boolean;
}

export function Input({ label, className = '', textarea = false, ...props }: InputProps) {
  const inputClasses = `w-full rounded-xl bg-white border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)] transition shadow-sm ${className}`;
  
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-bold text-[var(--warm-ink)] mb-1">{label}</label>}
      {textarea ? (
        <textarea className={inputClasses} {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input className={inputClasses} {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
}
