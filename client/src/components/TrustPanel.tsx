import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity } from 'lucide-react';

interface TrustPanelProps {
  score: number;
  entityType: string;
  entityName: string;
}

export function TrustPanel({ score, entityType, entityName }: TrustPanelProps) {
  console.log("TrustPanel");
  const getStatus = () => {
    if (score >= 90) return { color: 'text-[var(--sage)]', bg: 'bg-[rgba(163,177,138,0.1)]', icon: ShieldCheck, label: 'High Trust' };
    if (score >= 70) return { color: 'text-[var(--clay)]', bg: 'bg-[rgba(180,130,90,0.1)]', icon: Shield, label: 'Good Standing' };
    return { color: 'text-[var(--dusty-rose)]', bg: 'bg-[rgba(201,123,90,0.1)]', icon: ShieldAlert, label: 'Requires Attention' };
  };

  const status = getStatus();
  const Icon = status.icon;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)] p-6 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--warm-ink)] flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--clay)]" />
          Trust Profile
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="text-sm text-[var(--soft-stone)] font-medium">Reliability Score</div>
          <div className="flex items-end gap-2">
            <div className={`text-4xl font-headline font-bold ${status.color}`}>{score}</div>
            <div className="text-sm text-[var(--soft-stone)] mb-1 font-bold">/ 100</div>
          </div>
          <div className="w-full bg-[rgba(191,179,163,0.2)] rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full ${score >= 90 ? 'bg-[var(--sage)]' : score >= 70 ? 'bg-[var(--clay)]' : 'bg-[var(--dusty-rose)]'}`}
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm font-medium text-[var(--soft-stone)]">Recent Signals</div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[rgba(191,179,163,0.1)] flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-[var(--soft-stone)]" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--warm-ink)]">Consistently delivers on time</div>
                <div className="text-xs font-medium text-[var(--soft-stone)]">Historical performance</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[rgba(163,177,138,0.1)] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[var(--sage)]" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--warm-ink)]">Identity Verified</div>
                <div className="text-xs font-medium text-[var(--soft-stone)]">Document checks passed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
