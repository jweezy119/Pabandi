import React from 'react';

export function ClayCard({ children, className = '', hover = true, onClick }: any) {
  return (
    <div 
      className={`bg-slate-900/40 border border-slate-700/50 backdrop-blur-sm rounded-3xl shadow-sm ${hover ? 'hover:shadow-md hover:-translate-y-0.5 transition-all' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
