import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';

type Step = 'details' | 'verify' | 'done';

export const RegisterPage: React.FC = () => {
  const [step, setStep] = useState<Step>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await authService.requestVerificationCode(email);
      const data = res.data?.data ?? res.data;
      if (!data?.success) throw new Error(data?.message || 'Could not send code');
      setStep('verify');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const complete = async () => {
    if (!firstName || !lastName || !password || !code) return;
    setLoading(true);
    setError('');
    try {
      const res = await authService.registerWithCode({ email, password, firstName, lastName, phone, code });
      const data = res.data?.data ?? res.data;
      if (!data?.accessToken) throw new Error(data?.message || 'Registration failed');
      localStorage.setItem('pabandi_token', data.accessToken);
      localStorage.setItem('pabandi_user', JSON.stringify(data.user));
      window.location.href = '/onboarding';
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'radial-gradient(circle at top left, #0f172a, #020617)' }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold font-headline text-slate-100">Create your account</h1>
          <p className="mt-2 text-sm" style={{ color: '#94a3b8' }}>{step === 'details' ? 'Start with your email, then verify with a code.' : 'Enter the 6-digit code we just emailed you.'}</p>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#dc26261a', color: '#fca5a5', border: '1px solid #dc262633' }}>{error}</div>}

        {step === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">First name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" placeholder="Jane" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Last name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" placeholder="Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone (optional)</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" placeholder="+1 555 0123" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" placeholder="Min 8 characters" />
              <p className="mt-1 text-xs" style={{ color: '#64748b' }}>Use 8+ characters with upper, lower, number, and symbol.</p>
            </div>
            <button disabled={loading || !email || !firstName || !lastName || password.length < 8} onClick={requestCode} className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50">
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>
            <p className="text-center text-xs" style={{ color: '#64748b' }}>Already have an account? <Link to="/login" className="text-indigo-300">Log in</Link></p>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Verification code</label>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400 text-center tracking-widest" placeholder="123456" maxLength={8} />
            </div>
            <button disabled={loading || code.length < 4} onClick={complete} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
              {loading ? 'Creating account…' : 'Verify & Create Account'}
            </button>
            <button onClick={requestCode} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10">Resend code</button>
          </div>
        )}
      </div>
    </div>
  );
};
