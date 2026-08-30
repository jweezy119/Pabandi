import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/** Decode the (public) JWT payload without verifying the signature — we only need the claims
 *  (id, email, role, names) to seed the auth store. The backend already authenticated the user. */
function decodeJwtPayload(token: string): any | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const token = params.get('token');
    const role = params.get('role');
    const returnTo = params.get('returnTo');

    if (!token) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    const claims = decodeJwtPayload(token);
    const user = {
      id: claims?.id || '',
      email: claims?.email || '',
      firstName: claims?.firstName || '',
      lastName: claims?.lastName || '',
      role: role || claims?.role || 'CUSTOMER',
      reliabilityScore: 750,
      trustScore: 73.8,
      verificationTier: 'BASIC',
      commerceScore: 73.75,
      hospitalityScore: 73.75,
      freelanceScore: 73.75,
      appointmentScore: 73.75,
      business: null,
    };

    setAuth(user as any, token);
    navigate(returnTo || '/dashboard', { replace: true });
  }, [params, navigate, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
        <p className="text-sm text-white/70">Signing you in…</p>
      </div>
    </div>
  );
}
