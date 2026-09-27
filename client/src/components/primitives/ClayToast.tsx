import React, { useState, useCallback, useContext, createContext } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ClayToastProvider');
  return ctx;
}

export function ClayToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    const duration = toast.duration ?? 3500;
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ClayToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(138,154,123,0.15)', border: 'rgba(138,154,123,0.3)', icon: 'check_circle' },
  error: { bg: 'rgba(212,165,165,0.15)', border: 'rgba(212,165,165,0.3)', icon: 'error' },
  info: { bg: 'rgba(201,123,90,0.12)', border: 'rgba(201,123,90,0.25)', icon: 'info' },
  warning: { bg: 'rgba(217,168,84,0.15)', border: 'rgba(217,168,84,0.3)', icon: 'warning' },
};

function ClayToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map(toast => {
        const style = typeStyles[toast.type] || typeStyles.info;
        return (
          <div
            key={toast.id}
            className="clay-rise rounded-2xl p-4 flex items-start gap-3 clay-toast"
            style={{
              backgroundColor: 'white',
              border: `1px solid ${style.border}`,
              boxShadow: '0 4px 16px rgba(42,37,32,0.10), 0 1px 2px rgba(180,130,90,0.06)',
            }}
          >
            <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color: 'var(--clay)' }}>
              {style.icon}
            </span>
            <p className="text-sm font-medium flex-1" style={{ color: 'var(--warm-ink)' }}>{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="flex-shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--warm-sand)]/40"
              style={{ color: 'var(--soft-stone)' }}
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
