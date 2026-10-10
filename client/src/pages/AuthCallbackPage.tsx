import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Decode the (public) JWT payload without verifying the signature — we only need the claims
 * (id, email, role, names) to seed the auth store. The backend already authenticated the user.
 */
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
    const refreshToken = params.get('refreshToken');
    const role = params.get('role');
    const returnTo = params.get('returnTo');

    if (!token) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    // The credentials are in the URL. Leaving them there means they live on in
    // history, in the address bar and in any screen sharing — and a reload of
    // this page would re-run the same redirect. Strip the query now that the
    // session is in the store.
    window.history.replaceState({}, '', window.location.pathname);

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

    // Pass the refresh token through. OAuth sessions used to get an access
    // token only, so they could never be renewed and every one of them died
    // with its 7-day token.
    setAuth(user as any, token, refreshToken || undefined);
    navigate(returnTo || '/dashboard', { replace: true });
  }, [params, navigate, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--clay)]/30 border-t-indigo-400" />
        <p className="text-sm text-[var(--warm-ink)]/70">Signing you in…</p>
      </div>
    </div>
  );
}
