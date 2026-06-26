import { useEffect, useState } from 'react';

export default function MobileInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!deferred) {
      return;
    }
    (deferred as any).prompt();
    const outcome = await (deferred as any).userChoice;
    if (outcome.outcome === 'accepted') {
      setShow(false);
    }
    setDeferred(null);
  };

  if (!show) {
    return null;
  }

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-50 px-4 md:bottom-6"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="max-w-md mx-auto bg-[#0a0f1a] border border-white/15 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.4)] px-4 py-3 flex items-center justify-between gap-3">
        <div className="text-xs text-gray-200 leading-snug">
          <span className="block font-bold text-white">Install Pabandi</span>
          <span>Works offline on Android</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShow(false)}
            className="text-[11px] font-bold px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="text-[11px] font-bold px-3 py-2 rounded-lg bg-[#14F195] text-black hover:bg-[#10e68a] transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
