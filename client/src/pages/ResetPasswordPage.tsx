import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { Surface, Button, tokens } from '../design-system';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiClient.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired token. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4" style={{ background: tokens.color.background }}>
      <div className="absolute right-[-100px] bottom-[-100px] h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white" style={{ background: 'linear-gradient(135deg,#0ea5e9, #14b8a6)' }}>
              P
            </div>
            <span className="font-headline text-xl font-black tracking-tight" style={{ color: tokens.color.primary }}>Pabandi</span>
          </Link>
        </div>

        <Surface>
          <h1 className="font-headline text-2xl font-bold" style={{ color: tokens.color.text }}>Reset Password</h1>
          <p className="mb-6 text-sm" style={{ color: tokens.color.muted }}>
            Choose a new password for your account.
          </p>

          {success ? (
            <div className="text-center">
              <div className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
                Password reset successfully! Redirecting to login...
              </div>
              <Link to="/login" className="block w-full">
                <Button className="w-full">Go to Login Now</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.color.muted }}>New Password</label>
                <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors" style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }} />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.color.muted }}>Confirm New Password</label>
                <input id="confirmPassword" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors" style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }} />
              </div>

              <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 8 }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </Surface>
      </div>
    </div>
  );
}
