import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function AuthHydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setReady(true));
    return () => unsub();
  }, []);

  // Always render children immediately - don't block the router
  // The auth store will hydrate in the background
  return <>{children}</>;
}
