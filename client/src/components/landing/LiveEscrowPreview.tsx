import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api';
import { CLAY_SPRING, CLAY_FADE } from '../animations/clayMotion';

export interface QuoteData {
  totalUsd: number;
  depositRequiredUsd: number;
  completionPayoutUsd: number;
  totalPkr: number;
  depositRequiredPkr: number;
  completionPayoutPkr: number;
  estimatedDays: number;
  estimatedHours: number;
  breakdown: {
    baseLaborUsd: number;
    urgencyPremiumUsd: number;
    agentOrchestrationFeeUsd: number;
    escrowProtectionFeeUsd: number;
  };
}

interface ProjectPreset {
  id: string;
  name: string;
  icon: string;
  scale: number;
  urgency: number;
  quality: 'Standard' | 'Senior' | 'Lead';
}

const PRESETS: ProjectPreset[] = [
  { id: 'mvp', name: 'Full-Stack MVP', icon: '💻', scale: 3, urgency: 3, quality: 'Senior' },
  { id: 'agent', name: 'AI Agent Service', icon: '🤖', scale: 2, urgency: 2, quality: 'Lead' },
  { id: 'audit', name: 'Security & Legal Audit', icon: '⚖️', scale: 2, urgency: 4, quality: 'Lead' },
  { id: 'brand', name: 'Brand & Growth', icon: '🎨', scale: 1, urgency: 1, quality: 'Standard' },
];

function fallbackQuote(scale: number, urgency: number, quality: 'Standard' | 'Senior' | 'Lead'): QuoteData {
  const baseRates = { Standard: 45, Senior: 85, Lead: 140 };
  const baseLabor = scale * 12 * baseRates[quality];
  const urgencyPremium = Math.round(baseLabor * ((urgency - 1) * 0.12));
  const agentFee = 35;
  const escrowFee = 15;
  const totalUsd = baseLabor + urgencyPremium + agentFee + escrowFee;
  const depositRequiredUsd = Math.round(totalUsd * 0.5);
  const completionPayoutUsd = totalUsd - depositRequiredUsd;
  const usdToPkr = 279;

  return {
    totalUsd,
    depositRequiredUsd,
    completionPayoutUsd,
    totalPkr: totalUsd * usdToPkr,
    depositRequiredPkr: depositRequiredUsd * usdToPkr,
    completionPayoutPkr: completionPayoutUsd * usdToPkr,
    estimatedDays: Math.max(1, Math.round((scale * 4) / Math.max(1, urgency * 0.5))),
    estimatedHours: scale * 12,
    breakdown: {
      baseLaborUsd: baseLabor,
      urgencyPremiumUsd: urgencyPremium,
      agentOrchestrationFeeUsd: agentFee,
      escrowProtectionFeeUsd: escrowFee,
    },
  };
}

export function LiveEscrowPreview() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? CLAY_FADE : CLAY_SPRING;

  const [preset, setPreset] = useState<string>('mvp');
  const [scale, setScale] = useState<number>(3);
  const [urgency, setUrgency] = useState<number>(3);
  const [quality, setQuality] = useState<'Standard' | 'Senior' | 'Lead'>('Senior');
  const [currency, setCurrency] = useState<'USD' | 'PKR'>('USD');

  const [quote, setQuote] = useState<QuoteData>(() => fallbackQuote(3, 3, 'Senior'));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stage, setStage] = useState<'quote' | 'locked' | 'released'>('quote');

  const handlePresetSelect = (p: ProjectPreset) => {
    setPreset(p.id);
    setScale(p.scale);
    setUrgency(p.urgency);
    setQuality(p.quality);
    setStage('quote');
  };

  const fetchQuote = useCallback(async (s: number, u: number, q: 'Standard' | 'Senior' | 'Lead') => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; quote: QuoteData }>('/simulator/public/quote', {
        scale: s,
        timelineUrgency: u,
        quality: q,
      });
      if (res.data?.success && res.data.quote) {
        setQuote(res.data.quote);
      } else {
        setQuote(fallbackQuote(s, u, q));
      }
    } catch {
      // Offline fallback guarantees rock-solid UI response
      setQuote(fallbackQuote(s, u, q));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuote(scale, urgency, quality);
    }, 200);
    return () => clearTimeout(timer);
  }, [scale, urgency, quality, fetchQuote]);

  const displayTotal = useMemo(() => {
    return currency === 'USD'
      ? `$${quote.totalUsd.toLocaleString()}`
      : `PKR ${quote.totalPkr.toLocaleString()}`;
  }, [currency, quote.totalUsd, quote.totalPkr]);

  const displayDeposit = useMemo(() => {
    return currency === 'USD'
      ? `$${quote.depositRequiredUsd.toLocaleString()}`
      : `PKR ${quote.depositRequiredPkr.toLocaleString()}`;
  }, [currency, quote.depositRequiredUsd, quote.depositRequiredPkr]);

  const displayCompletion = useMemo(() => {
    return currency === 'USD'
      ? `$${quote.completionPayoutUsd.toLocaleString()}`
      : `PKR ${quote.completionPayoutPkr.toLocaleString()}`;
  }, [currency, quote.completionPayoutUsd, quote.completionPayoutPkr]);

  return (
    <div
      className="live-escrow-preview-widget"
      style={{
        background: 'var(--cream)',
        border: '1px solid rgba(191, 179, 163, 0.45)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        padding: '1.75rem',
        maxWidth: '520px',
        width: '100%',
        color: 'var(--warm-ink)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Banner: Status Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: stage === 'quote' ? '#D9A854' : stage === 'locked' ? '#C97B5A' : '#8A9A7B',
              boxShadow: `0 0 8px ${stage === 'quote' ? '#D9A854' : stage === 'locked' ? '#C97B5A' : '#8A9A7B'}`,
            }}
          />
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--terracotta)' }}>
            Live Escrow Simulation
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--warm-sand)', padding: '0.2rem', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            style={{
              border: 'none',
              background: currency === 'USD' ? 'white' : 'transparent',
              color: 'var(--warm-ink)',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: currency === 'USD' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => setCurrency('PKR')}
            style={{
              border: 'none',
              background: currency === 'PKR' ? 'white' : 'transparent',
              color: 'var(--warm-ink)',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: currency === 'PKR' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            PKR
          </button>
        </div>
      </div>

      {/* Preset Pill Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {PRESETS.map((p) => {
          const isSelected = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetSelect(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: isSelected ? '1.5px solid var(--clay)' : '1px solid rgba(191,179,163,0.35)',
                background: isSelected ? 'rgba(201, 123, 90, 0.08)' : 'white',
                color: 'var(--warm-ink)',
                fontSize: '0.8125rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
              }}
            >
              <span>{p.icon}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Scope Controls */}
      {stage === 'quote' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition}
          style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(191,179,163,0.25)' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-ink)', marginBottom: '0.25rem' }}>
                <span>Scope Scale</span>
                <span style={{ color: 'var(--clay)' }}>{scale} / 5</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--clay)', cursor: 'pointer' }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-ink)', marginBottom: '0.25rem' }}>
                <span>Urgency</span>
                <span style={{ color: 'var(--terracotta)' }}>{urgency === 5 ? 'Rush (24h)' : urgency >= 3 ? 'Standard' : 'Flexible'}</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={urgency}
                onChange={(e) => setUrgency(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--terracotta)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(191,179,163,0.3)' }}>
            <span style={{ fontWeight: 600, color: 'var(--warm-ink)' }}>Provider Tier:</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['Standard', 'Senior', 'Lead'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setQuality(tier)}
                  style={{
                    border: 'none',
                    background: quality === tier ? 'var(--warm-ink)' : 'var(--warm-sand)',
                    color: quality === tier ? 'white' : 'var(--warm-ink)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.45rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Dynamic Simulation Stages */}
      <AnimatePresence mode="wait">
        {stage === 'quote' && (
          <motion.div
            key="stage-quote"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            {/* Financial Summary Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(232,217,197,0.4) 0%, rgba(245,239,230,0.8) 100%)',
                border: '1px solid rgba(201,123,90,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--terracotta)', fontWeight: 700 }}>
                    Total Guaranteed Scope
                  </span>
                  <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--warm-ink)', lineHeight: 1.1 }}>
                    {isLoading ? 'Calculating...' : displayTotal}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--soft-stone)', fontWeight: 600 }}>Turnaround</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--clay)' }}>
                    ~{quote.estimatedDays} {quote.estimatedDays === 1 ? 'day' : 'days'}
                  </div>
                </div>
              </div>

              {/* Milestone Split Indicator */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(191,179,163,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  <span>🔒 Milestone 1: Upfront Deposit</span>
                  <span style={{ color: 'var(--terracotta)', fontWeight: 700 }}>{displayDeposit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--soft-stone)' }}>
                  <span>🏁 Milestone 2: Final Acceptance</span>
                  <span style={{ fontWeight: 700 }}>{displayCompletion}</span>
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => setStage('locked')}
              style={{
                width: '100%',
                background: 'var(--clay)',
                color: 'white',
                border: 'none',
                padding: '0.875rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-md)',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🔒</span>
              <span>Lock {displayDeposit} in Escrow</span>
            </button>
          </motion.div>
        )}

        {stage === 'locked' && (
          <motion.div
            key="stage-locked"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={transition}
          >
            {/* Escrow Locked Active Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(201,123,90,0.12) 0%, rgba(217,168,84,0.1) 100%)',
                border: '2px solid var(--clay)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'var(--clay)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  margin: '0 auto 0.75rem',
                  boxShadow: '0 4px 16px rgba(201,123,90,0.4)',
                }}
              >
                🔒
              </div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: 800, color: 'var(--warm-ink)' }}>
                Funds Secured in Pabandi Escrow
              </h4>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--soft-stone)', lineHeight: 1.4 }}>
                Settlement routed via Square / Safepay / Solana. Held in non-custodial custody until milestone approval.
              </p>

              <div
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  border: '1px solid rgba(191,179,163,0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--sage)', fontWeight: 700, marginBottom: '0.4rem' }}>
                  <span>✓</span>
                  <span>Milestone 1 Funded: {displayDeposit}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warm-ink)', fontWeight: 600 }}>
                  <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⚙</span>
                  <span>Deliverable in progress: Scope verified against spec</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStage('released')}
              style={{
                width: '100%',
                background: '#8A9A7B',
                color: 'white',
                border: 'none',
                padding: '0.875rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(138,154,123,0.35)',
              }}
            >
              <span>✓</span>
              <span>Verify Deliverables & Release Payout</span>
            </button>
          </motion.div>
        )}

        {stage === 'released' && (
          <motion.div
            key="stage-released"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={transition}
          >
            {/* Release Confirmed Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(138,154,123,0.15) 0%, rgba(245,239,230,0.9) 100%)',
                border: '2px solid #8A9A7B',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: '#8A9A7B',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  margin: '0 auto 0.75rem',
                  boxShadow: '0 4px 16px rgba(138,154,123,0.4)',
                }}
              >
                ✓
              </div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: 800, color: 'var(--warm-ink)' }}>
                Contract Settled & Payout Released
              </h4>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--soft-stone)', lineHeight: 1.4 }}>
                Funds instantly disbursed. Trust Passport reputation score updated across the hybrid network.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.5rem',
                  background: 'white',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  border: '1px solid rgba(191,179,163,0.3)',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--soft-stone)', fontWeight: 600 }}>RELIABILITY BOOST</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#8A9A7B' }}>+15 pts</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--soft-stone)', fontWeight: 600 }}>PROTOCOL REWARD</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--clay)' }}>25 $PAB</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setStage('quote')}
                style={{
                  flex: 1,
                  background: 'var(--warm-sand)',
                  color: 'var(--warm-ink)',
                  border: 'none',
                  padding: '0.75rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                ↻ Replay Demo
              </button>
              <button
                type="button"
                onClick={() => navigate('/p/estimate/demo')}
                style={{
                  flex: 1.5,
                  background: 'var(--clay)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Try Full Proposal →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust Footer Note */}
      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(191,179,163,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--soft-stone)' }}>
        <span>Supported: Square (USD) · Safepay (PKR) · Solana (USDC)</span>
        <span style={{ fontWeight: 600, color: 'var(--clay)' }}>Verified Non-Custodial</span>
      </div>
    </div>
  );
}
