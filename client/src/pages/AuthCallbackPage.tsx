import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * This page handles the redirect from the backend after Google OAuth.
 * URL: /auth/callback?token=xxx&role=yyy
 * It reads the JWT, stores it in the auth store, then navigates to /dashboard.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error || !token) {
      navigate('/login?error=' + (error || 'oauth_failed'));
      return;
    }

    // Decode JWT payload (base64) to get user info — no secret needed client-side
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setToken(token);
      setUser({
        id: payload.id,
        email: payload.email,
        firstName: payload.firstName || payload.email.split('@')[0],
        lastName: payload.lastName || '',
        role: payload.role,
      });
      navigate('/dashboard');
    } catch {
      navigate('/login?error=token_parse_failed');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-bg)' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm" style={{ color: '#7a90a8' }}>Completing sign-in…</p>
      </div>
    </div>
  );
}
