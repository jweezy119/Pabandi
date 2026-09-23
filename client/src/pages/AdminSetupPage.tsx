import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Surface, Button, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import { adminService } from '../services/adminService';

export const AdminSetupPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      // Already logged in as admin, no need to setup
    }
  }, [isAuthenticated, user]);

  // Redirect if already admin
  if (isAuthenticated && user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    setAlreadyExists(false);

    try {
      await adminService.setup({ email, password, firstName, lastName });
      setSuccess(true);
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;
      if (status === 409 || message?.toLowerCase().includes('already')) {
        setAlreadyExists(true);
      } else {
        setError(message || 'Failed to create admin. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4" style={{ background: 'var(--cream)' }}>
      <div className="absolute top-[-100px] left-[-100px] h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-100px] right-[-100px] h-[400px] w-[400px] rounded-full bg-secondary/5 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-[var(--warm-ink)]" style={{ background: 'linear-gradient(135deg, var(--sky-wash), var(--sage))' }}>
              P
            </div>
            <span className="font-headline text-xl font-black tracking-tight" style={{ color: 'var(--clay)' }}>Pabandi</span>
          </Link>
          <h1 className="text-2xl font-bold mt-4" style={{ color: 'var(--warm-ink)' }}>Admin Setup</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>Create the first administrator account</p>
        </div>

        <Surface className="p-6">
          {success ? (
            <div className="text-center">
              <div className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.25)", color: 'var(--sage)' }}>
                Admin account created successfully!
              </div>
              <Link to="/login" className="block w-full">
                <Button variant="primary" className="w-full">Go to Login</Button>
              </Link>
            </div>
          ) : alreadyExists ? (
            <div className="text-center">
              <div className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.25)", color: 'var(--muted-ochre)' }}>
                An admin account already exists.
              </div>
              <Link to="/login" className="block w-full">
                <Button variant="outline" className="w-full">Go to Login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.25)", color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--soft-stone)' }}>First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                    style={{ background: 'var(--cream)', borderColor: "rgba(191,179,163,0.3)", color: 'var(--warm-ink)' }}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--soft-stone)' }}>Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                    style={{ background: 'var(--cream)', borderColor: "rgba(191,179,163,0.3)", color: 'var(--warm-ink)' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--soft-stone)' }}>Email Address</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                  style={{ background: 'var(--cream)', borderColor: "rgba(191,179,163,0.3)", color: 'var(--warm-ink)' }}
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--soft-stone)' }}>Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                  style={{ background: 'var(--cream)', borderColor: "rgba(191,179,163,0.3)", color: 'var(--warm-ink)' }}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full" variant="primary" style={{ marginTop: 8 }}>
                {loading ? 'Creating...' : 'Create Admin Account'}
              </Button>

              <p className="text-center text-xs" style={{ color: 'var(--soft-stone)' }}>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--clay)' }}>
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Surface>
      </div>
    </div>
  );
};

export default AdminSetupPage;
