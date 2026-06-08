import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 bg-surface">
      
      <div className="glow-blob w-[500px] h-[500px] top-[-100px] left-[-100px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black"
              style={{ background: 'linear-gradient(135deg,#0ea5e9, #14b8a6)' }}>
              P
            </div>
            <span className="text-xl font-black tracking-tight text-primary font-headline" >Pabandi</span>
          </Link>
        </div>

        <div className="auth-panel">
          <h1 className="text-2xl font-bold mb-2 text-on-surface font-headline" >Forgot Password</h1>
          <p className="text-sm mb-6 text-on-surface-variant font-body" >
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {message ? (
            <div className="text-center">
              <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                {message}
              </div>
              <Link to="/login" className="btn-secondary w-full">
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-xl text-sm font-medium bg-error-container text-on-error-container border border-error/20">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="email" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-on-surface-variant" >Email Address</label>
                <input id="email" type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input-field" placeholder="you@example.com" />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <p className="text-center text-xs mt-4 text-on-surface-variant" >
                Remembered your password?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
