import React from 'react';
import { useQuery } from 'react-query';
import { reliabilityService } from '../services/api';
import { ChartBarIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface ScoreReceipt {
  id: string;
  date: string;
  previousScore: number;
  newScore: number;
  totalChange: number;
  reasoning: string;
}

export const ScoreReceipts: React.FC = () => {
  const { data: history, isLoading } = useQuery('reliability-history', async () => {
    const res = await reliabilityService.getHistory();
    return res.data?.data as ScoreReceipt[];
  });

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-on-surface-variant animate-pulse">Loading score history...</div>;
  }

  if (!history || history.length === 0) {
    return (
      <div className="p-6 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <ChartBarIcon className="h-8 w-8 mx-auto text-on-surface-variant opacity-50 mb-3" />
        <p className="text-sm text-on-surface-variant">No score history available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4 text-sm text-on-surface-variant">
        <InformationCircleIcon className="h-5 w-5" />
        <span>Pabandi Global Trust Protocol Receipts</span>
      </div>
      
      <div className="relative border-l-2 border-primary/20 ml-3 space-y-6">
        {history.map((receipt) => {
          const isPositive = receipt.totalChange >= 0;
          return (
            <div key={receipt.id} className="relative pl-6">
              {/* Timeline Dot */}
              <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-surface bg-${isPositive ? 'primary' : 'error'}`} />
              
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {new Date(receipt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className={`flex items-center gap-1 font-headline font-black text-sm ${isPositive ? 'text-primary' : 'text-error'}`}>
                    {isPositive ? '+' : ''}{receipt.totalChange} pts
                  </div>
                </div>
                
                <p className="text-sm font-body text-on-surface mb-3 leading-relaxed">
                  {receipt.reasoning}
                </p>
                
                <div className="flex items-center gap-3 text-xs font-body font-semibold">
                  <span className="text-on-surface-variant line-through opacity-70">{receipt.previousScore}</span>
                  <span className="text-on-surface-variant">→</span>
                  <span className="text-on-surface">{receipt.newScore}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
