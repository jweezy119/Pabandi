import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { referralService } from '../services/api';

interface ValidatePayload {
  success: boolean;
  code: string;
  referrerName: string;
  rateYear1: number;
  signupBounty: number;
}

export const ReferralLandingPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [data, setData] = useState<ValidatePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    referralService
      .validateCode(code)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) {
          setData(res.data);
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const pct = data ? Math.round((data.rateYear1 || 0) * 100) : 0;
  const signup = data?.signupBounty ?? 5;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.18), transparent 60%), #020617',
        color: 'var(--foreground)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <Link
          to="/"
          style={{ fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none' }}
        >
          ← Back to Pabandi
        </Link>

        {status === 'loading' && (
          <p style={{ marginTop: 32, color: 'var(--muted-foreground)' }}>Checking invitation…</p>
        )}

        {status === 'invalid' && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 44 }}>🔗</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 12 }}>
              This invite link is no longer active
            </h1>
            <p style={{ color: 'var(--muted-foreground)', marginTop: 10 }}>
              The referral code <code style={{ color: 'var(--foreground)' }}>{code}</code> isn’t valid.
              You can still join Pabandi directly.
            </p>
            <Link
              to="/register"
              style={{
                display: 'inline-block',
                marginTop: 24,
                padding: '12px 22px',
                borderRadius: 12,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: '#fff',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Join Pabandi
            </Link>
          </div>
        )}

        {status === 'valid' && data && (
          <div>
            <div style={{ fontSize: 44 }}>🎁</div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                marginTop: 12,
                background: 'linear-gradient(135deg,#818cf8,#c4b5fd)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {data.referrerName} invited you to Pabandi
            </h1>
            <p style={{ color: 'var(--muted-foreground)', marginTop: 10, lineHeight: 1.6 }}>
              Pabandi is the trust layer for local bookings — escrow-backed deposits, court &
              KYC screening, and $PAB rewards on every stay. Join through this invite and you both
              win.
            </p>

            <div
              style={{
                marginTop: 28,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div
                style={{
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: 16,
                  padding: '18px 14px',
                  background: 'rgba(99,102,241,0.06)',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa' }}>
                  {signup} $PAB
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 4 }}>
                  Signup bonus for you
                </div>
              </div>
              <div
                style={{
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: 16,
                  padding: '18px 14px',
                  background: 'rgba(99,102,241,0.06)',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa' }}>{pct}%</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 4 }}>
                  Your referrer earns per booking
                </div>
              </div>
            </div>

            <Link
              to={`/register?ref=${encodeURIComponent(data.code)}`}
              style={{
                display: 'inline-block',
                marginTop: 28,
                padding: '14px 30px',
                borderRadius: 12,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 10px 30px rgba(99,102,241,0.35)',
              }}
            >
              Claim my invite & join
            </Link>

            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 16 }}>
              Already a member?{' '}
              <Link to="/login" style={{ color: '#a78bfa', textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 40, opacity: 0.7 }}>
          Pabandi — Commitment, Secured.
        </p>
      </div>
    </div>
  );
};

export default ReferralLandingPage;
