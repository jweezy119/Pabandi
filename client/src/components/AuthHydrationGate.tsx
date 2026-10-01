import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

/**
 * Waits for the persisted auth store to rehydrate before the router decides
 * whether the user is signed in.
 *
 * WHY THIS GATE HAS TO BLOCK
 * The store is Zustand + `persist`, so on a hard refresh the in-memory state
 * starts as `user: null, isAuthenticated: false` and is filled in
 * asynchronously from `auth-storage`. The router guards read exactly that flag.
 * Rendering children immediately means a refresh of any guarded URL evaluates
 * the guard before rehydration finishes, sees `false`, and bounces the user to
 * /login — while they hold a perfectly valid token. The previous version of
 * this component computed `ready` and then ignored it, which is why the
 * flash-redirect was still happening.
 *
 * The guard is a spinner rather than a redirect precisely so that "we don't
 * know yet" is never confused with "you are signed out". Redirecting on an
 * unknown state is what creates the loop; waiting does not.
 */
export default function AuthHydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    // Covers the case where hydration finished between the initialiser and
    // this effect, which would otherwise leave the gate waiting on an event
    // that has already fired.
    const unsub = useAuthStore.persist.onFinishHydration(() => setReady(true));
    setReady(useAuthStore.persist.hasHydrated());
    return () => unsub();
  }, []);

  if (!ready) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--cream)' }}
        role="status"
        aria-live="polite"
      >
        <span className="material-symbols-outlined" style={{ color: 'var(--clay)' }} aria-hidden="true">
          hourglass_top
        </span>
        <span className="sr-only">Loading your session</span>
      </div>
    );
  }

  return <>{children}</>;
}
