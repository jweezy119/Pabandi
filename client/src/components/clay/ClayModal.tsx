import React from 'react';
import { X } from 'lucide-react';
import { ClayCard } from './ClayCard';

export function ClayModal({ title, onClose, children, maxWidth = 'max-w-md' }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <ClayCard className={`relative w-full ${maxWidth} p-6 shadow-2xl bg-slate-900 border-slate-700`} hover={false}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </ClayCard>
    </div>
  );
}
