import React from 'react';

export function ClayButton({ children, className = '', variant = 'primary', onClick, type = 'button', disabled = false }: any) {
  const base = "inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-sm shadow-emerald-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
  };
  
  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {children}
    </button>
  );
}
