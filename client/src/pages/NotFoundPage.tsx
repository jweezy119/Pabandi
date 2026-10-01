import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/primitives';

/**
 * Catch-all for unmatched routes.
 *
 * WHY THIS EXISTS
 * React Router 6 renders nothing for a path that matches no route. The SPA had
 * 38+ link targets with no matching route, so every one of them blanked the
 * app to a white screen. Worse for the flow the user cares about: a blank page
 * has no visible Back affordance, so the browser's back button becomes the only
 * escape and a user who hit Back twice was thrown out of the app entirely.
 *
 * This page always gives three ways out — a real Back button, a way to the
 * dashboard, and the module they most likely wanted — so a bad link is a
 * recoverable detour rather than a dead end.
 */
export default function NotFoundPage() {
  const location = useLocation();

  // A path like /contact/clients/abc is far more likely a broken sub-link than
  // a genuinely unknown top-level destination, so send the user to the
  // nearest module root.
  const segments = location.pathname.split('/').filter(Boolean);
  const moduleRoot = segments.length > 0 ? `/${segments[0]}` : '/';
  const moduleName = moduleRoot === '/capital' ? 'CapitalOS' : moduleRoot === '/contact' ? 'ContactOS' : 'Pabandi';

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--cream)' }}>
      <div
        className="w-full max-w-md rounded-[var(--radius-card)] p-8 text-center clay-rise"
        style={{ background: 'white', boxShadow: 'var(--shadow-soft)', borderTop: '1px solid rgba(255,255,255,0.6)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(201,123,90,0.12)' }}
        >
          <span className="material-symbols-outlined" style={{ color: 'var(--clay)', fontSize: '28px' }} aria-hidden="true">
            explore_off
          </span>
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--warm-ink)' }}>
          That page doesn't exist
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--soft-stone)' }}>
          Nothing is at{' '}
          <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--warm-sand)' }}>
            {location.pathname}
          </code>
          . Nothing is lost — your data is untouched.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else window.location.assign('/dashboard');
            }}
          >
            Go back
          </Button>

          <Link to={moduleRoot} className="block">
            <Button variant="secondary" className="w-full">
              {moduleName}
            </Button>
          </Link>

          <Link to="/dashboard">
            <Button variant="ghost" className="w-full">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
