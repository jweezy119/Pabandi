import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { tokens } from '../design-system';

/**
 * This page handles the redirect from the backend after Google OAuth.
 * URL: /auth/callback?token=xxx&role=yyy
 * It reads the JWT, stores it in the auth store, then navigates to /dashboard.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');
    const returnTo = params.get('returnTo');

    if (error || !token) {
      navigate('/login?error=' + (error || 'oauth_failed'));
      return;
    }

    // Decode JWT payload (base64) to get user info — no secret needed client-side
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const payload = JSON.parse(jsonPayload);
      setAuth(
        {
          id: payload.id,
          email: payload.email,
          firstName: payload.firstName || payload.email.split('@')[0],
          lastName: payload.lastName || '',
          role: payload.role,
        },
        token
      );
      if (returnTo) {
        navigate(returnTo, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch {
      navigate('/login?error=token_parse_failed');
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: tokens.color.background }}>
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#0ea5e955] border-t-transparent" />
        <p className="text-sm" style={{ color: tokens.color.muted }}>Completing sign-in…</p>
      </div>
    </div>
  );
}
