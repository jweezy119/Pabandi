import React, { useState } from 'react';
import { ShieldCheck, BadgeCheck, CheckCircle2 } from 'lucide-react';
import { ZkProofVerificationModal } from './ZkProofVerificationModal';
import { TrustPassportPayload } from '../types/passport';
import '../styles/pbn-tokens.css';

export interface ZkTrustBadgeProps {
  score?: number;
  disputeRate?: number | string;
  subjectName?: string;
  subjectId?: string;
  proofPayload?: TrustPassportPayload | null;
  variant?: 'pill' | 'compact' | 'tag' | 'card';
  interactive?: boolean;
  className?: string;
}

export const ZkTrustBadge: React.FC<ZkTrustBadgeProps> = ({
  score = 920,
  disputeRate = 0.5,
  subjectName,
  subjectId,
  proofPayload,
  variant = 'pill',
  interactive = true,
  className = '',
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  const formattedDispute = typeof disputeRate === 'number' ? `${disputeRate}%` : disputeRate;

  return (
    <>
      {variant === 'pill' && (
        <button
          type="button"
          onClick={handleClick}
          title="Click to verify BBS+ Zero-Knowledge Trust Passport"
          aria-label={`Verify ZK Trust Passport: Trust Score ${score}, Dispute Rate ${formattedDispute}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-950/70 transition-all cursor-pointer shadow-sm ${className}`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-bold">ZK Verified</span>
          <span className="text-emerald-500/50">·</span>
          <span>Trust &gt;{score > 800 ? 800 : score}</span>
          <span className="text-emerald-500/50">·</span>
          <span>&lt;{formattedDispute} Dispute</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          onClick={handleClick}
          title="Click to verify BBS+ ZK Proof"
          aria-label={`Trust Score ${score} ZK Verified`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 hover:border-emerald-400 transition-colors cursor-pointer ${className}`}
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="font-bold">{score}</span>
          <span className="text-[10px] text-emerald-500/60 uppercase">ZK</span>
        </button>
      )}

      {variant === 'tag' && (
        <span
          onClick={handleClick}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          title="BBS+ Zero-Knowledge Validated"
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${
            interactive ? 'hover:border-emerald-400 cursor-pointer' : ''
          } ${className}`}
        >
          <BadgeCheck className="w-3 h-3 text-emerald-400" />
          <span>ZK Passport</span>
        </span>
      )}

      {variant === 'card' && (
        <div
          onClick={handleClick}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          className={`p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 hover:border-emerald-400 transition-all ${
            interactive ? 'cursor-pointer hover:shadow-lg' : ''
          } ${className}`}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-emerald-400">ZK Trust Passport</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Verified
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs font-mono">
            <span className="text-slate-300">Trust Score Standing</span>
            <span className="text-emerald-400 font-bold text-sm">{score}/1000</span>
          </div>
          <div className="flex items-baseline justify-between text-xs font-mono mt-1">
            <span className="text-slate-400">Dispute Frequency</span>
            <span className="text-emerald-400 font-bold">&lt;{formattedDispute}</span>
          </div>
          {interactive && (
            <div className="mt-2 text-[10px] font-mono text-[var(--pbn-accent,#4fd1c5)] hover:underline">
              Click to inspect cryptographic predicates →
            </div>
          )}
        </div>
      )}

      {/* Verification Modal */}
      {interactive && (
        <ZkProofVerificationModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          subjectName={subjectName}
          subjectId={subjectId}
          score={score}
          disputeRate={disputeRate}
          proofPayload={proofPayload}
        />
      )}
    </>
  );
};

