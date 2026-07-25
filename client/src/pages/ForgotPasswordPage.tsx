import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import { Surface, Button, tokens } from '../design-system';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4" style={{ background: tokens.color.background }}>
      <div className="absolute top-[-100px] left-[-100px] h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white" style={{ background: 'linear-gradient(135deg,#0ea5e9, #14b8a6)' }}>
              P
            </div>
            <span className="font-headline text-xl font-black tracking-tight" style={{ color: tokens.color.primary }}>Pabandi</span>
          </Link>
        </div>

        <Surface className="p-6">
          <h1 className="font-headline text-2xl font-bold" style={{ color: tokens.color.text }}>Forgot Password</h1>
          <p className="mb-6 text-sm" style={{ color: tokens.color.muted }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {message ? (
            <div className="text-center">
              <div className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
                {message}
              </div>
              <Link to="/login" className="block w-full">
                <Button variant="outline" className="w-full">Return to Login</Button>
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
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.color.muted }}>Email Address</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors" style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }} />
              </div>

              <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 8 }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <p className="text-center text-xs" style={{ color: tokens.color.muted }}>
                Remembered your password?{' '}
                <Link to="/login" className="font-semibold hover:underline" style={{ color: tokens.color.primary }}>
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Surface>
      </div>
    </div>
  );
}
