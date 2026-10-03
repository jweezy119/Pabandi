import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { effectiveMode } from '../utils/accountMode';
import { BusinessModeGate } from './BusinessModeGate';

/**
 * Route guards, extracted from App.tsx so they can be tested.
 *
 * App.tsx is 600+ lines and imports every page in the app. Importing it into a test
 * pulls the whole application in, so an assertion about a guard would depend on every
 * unrelated module initialising cleanly. The guards are the part with the history of
 * silently breaking, so they are worth testing in isolation.
 */

/**
 * Gates business surfaces.
 *
 * The personal-mode branch used to be `<Navigate to="/" replace />`, which:
 *   - contradicted the nav, which offers "Contact OS" to everyone unconditionally;
 *   - gave the user no indication of why, so landing on the marketing homepage read as
 *     a broken app rather than a mode mismatch;
 *   - used `replace`, destroying the requested URL so Back could not recover it.
 *
 * It now renders BusinessModeGate, which explains the situation and switches mode
 * in place. The guard's intent is unchanged: Contact OS is a business surface.
 */
export function BusinessGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();

  // Signed out: send them to login, and keep the intended destination so that signing
  // in resumes where they meant to be. Without `state`, they land on the home page and
  // have to find the CRM again.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  if (effectiveMode(user) !== 'business') {
    return <BusinessModeGate />;
  }

  return <>{children}</>;
}

export function PersonalGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  if (effectiveMode(user) !== 'personal') {
    // Was `<Navigate to="/contact" replace />`, and /contact is itself BusinessGuard-
    // guarded. So for a business-mode user who followed a personal link, this bounced
    // them straight back to the page they came from — a loop that also lost the
    // original request.
    //
    // /dashboard is the one authenticated page with no mode guard, so it is always
    // somewhere real. There is deliberately no "switch to Personal" gate here: /me is
    // the entire personal surface, so the decision to go there has to be made from
    // somewhere that exists in both modes.
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
