import { useState, useEffect } from 'react';

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const queueAction = (action: any) => {
    setOfflineQueue(prev => [...prev, { ...action, queuedAt: new Date().toISOString() }]);
  };

  const flushQueue = async (processor: (action: any) => Promise<any>) => {
    if (offlineQueue.length === 0) return;
    const queue = [...offlineQueue];
    setOfflineQueue([]);
    for (const action of queue) {
      try {
        await processor(action);
      } catch (e) {
        console.error('Failed to flush queued action', e);
      }
    }
  };

  return { isOnline, offlineQueue, queueAction, flushQueue };
}
