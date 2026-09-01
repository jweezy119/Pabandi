import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/api';
import { tokens } from '../design-system';

export default function VerifyEmailPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  if (user?.isEmailVerified) {
    navigate('/');
    return null;
  }

  const sendCode = async () => {
    setSending(true);
    setError('');
    setMessage('');
    try {
      const res = await authService.sendVerificationCode();
      setMessage(res.data?.message || 'Verification code sent!');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!code.trim()) {
      setError('Please enter the verification code');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await authService.verifyEmail(code.trim());
      setMessage(res.data?.message || 'Email verified!');
      setTimeout(() => navigate('/'), 1500);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: tokens.color.background }}>
      <div className="max-w-md w-full">
        <div className="rounded-3xl p-8" style={{ background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-slate-100">Verify Your Email</h1>
            <p className="mt-2 text-sm" style={{ color: tokens.color.muted }}>
              We've sent a 6-digit code to <strong className="text-slate-100">{user?.email}</strong>. Enter it below to verify your account.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {message}
            </div>
          )}

          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            maxLength={6}
            className="w-full rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-widest outline-none"
            style={{ background: tokens.color.background, border: '1px solid rgba(255,255,255,0.12)' }}
          />

          <button
            onClick={verify}
            disabled={loading || !code.trim()}
            className="w-full mt-4 rounded-xl py-3 font-bold cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: tokens.color.primary, color: '#0a0a0a' }}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <div className="mt-4 text-center">
            <button
              onClick={sendCode}
              disabled={sending}
              className="text-sm font-semibold text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
            >
              {sending ? 'Sending...' : "Didn't receive a code? Resend"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
