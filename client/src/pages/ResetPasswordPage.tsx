import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{ background: 'var(--color-bg)' }}>
      
      <div className="glow-blob w-[500px] h-[500px] bottom-[-100px] right-[-100px]"
        style={{ background: 'rgba(16,185,129,0.06)' }} />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
              P
            </div>
            <span className="text-xl font-black tracking-tight" style={{ color: '#e8edf3' }}>Pabandi</span>
          </Link>
        </div>

        <div className="auth-panel p-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#e8edf3' }}>Reset Password</h1>
          <p className="text-sm mb-6" style={{ color: '#7a90a8' }}>
            Choose a new password for your account.
          </p>

          {success ? (
            <div className="text-center">
              <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
                Password reset successfully! Redirecting to login...
              </div>
              <Link to="/login" className="btn-primary w-full">
                Go to Login Now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="password" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: '#5a7490' }}>New Password</label>
                <input id="password" type="password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-field" placeholder="Min. 8 characters" />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: '#5a7490' }}>Confirm New Password</label>
                <input id="confirmPassword" type="password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field" placeholder="••••••••" />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
