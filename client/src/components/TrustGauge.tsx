import { useEffect, useState } from 'react';

export interface TrustGaugeProps {
  /** 0-1000, the platform scale (session tiers, passports). */
  score: number;
  sublabel?: string;
  size?: number;
}

/**
 * Circular gauge for the Trust Score — the "speedometer" of the dossier.
 *
 * The score scale is 0-1000 and the arc is filled by the score itself, so a
 * viewer reads the instrument the same way they read the session tiers and
 * the storefront: 800+ is the large-tab tier. Colour steps at exactly those
 * tier boundaries so the instrument and the policy it feeds agree.
 */
export function TrustGauge({ score, sublabel, size = 148 }: TrustGaugeProps) {
  const [swept, setSwept] = useState(false);

  const clamped = Math.max(0, Math.min(1000, Math.round(score)));
  // 2πr, r = 54 → circumference ≈ 339.29
  const circumference = 339.29;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSwept(true);
      return;
    }
    const t = setTimeout(() => setSwept(true), 150);
    return () => clearTimeout(t);
  }, []);

  const arc = (clamped / 1000) * circumference;
  const stroke = clamped >= 800 ? 'var(--sage)' : clamped >= 500 ? 'var(--clay)' : 'var(--dusty-rose)';

  return (
    <div
      className="trust-gauge"
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={1000}
      aria-label={sublabel ? `Trust Score ${clamped} of 1000, ${sublabel}` : `Trust Score ${clamped} of 1000`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 128 128" width={size} height={size} aria-hidden="true">
        <circle className="trust-gauge-track" cx="64" cy="64" r="54" />
        <circle
          className="trust-gauge-arc"
          cx="64"
          cy="64"
          r="54"
          style={{
            stroke,
            strokeDasharray: clamped >= circumference ? '339.3' : `${arc.toFixed(1)} 339.3`,
            opacity: swept ? 1 : 0,
            transition: 'stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1), opacity 300ms ease, stroke 400ms ease',
          }}
        />
        <defs>
          <path id="trust-gauge-tick" d="M 64 6 A 58 58 0 0 1 122 64" />
        </defs>
      </svg>
      <div className="trust-gauge-center">
        <span className="trust-gauge-score" style={{ transform: swept ? undefined : 'translateY(4px)', transition: 'transform 600ms cubic-bezier(0.22,1,0.36,1)' }}>
          {clamped}
        </span>
        <span className="trust-gauge-scale">/ 1000</span>
        {sublabel && <span className="trust-gauge-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}

export default TrustGauge;
