import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastApi {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const styles: Record<ToastType, { icon: typeof CheckCircle2; ring: string; bg: string; iconClass: string }> = {
  success: { icon: CheckCircle2, ring: 'border-[#A8DFCA]', bg: 'bg-[#D8F3E8]', iconClass: 'text-[#236B50]' },
  error: { icon: XCircle, ring: 'border-[#F7BCAA]', bg: 'bg-[#FFE3D5]', iconClass: 'text-[#B94D48]' },
  info: { icon: Info, ring: 'border-[#A7CCF7]', bg: 'bg-[#DCEEFF]', iconClass: 'text-[#2C598F]' },
  warning: { icon: AlertTriangle, ring: 'border-[#F2D57A]', bg: 'bg-[#FFF1BD]', iconClass: 'text-[#8A5D12]' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current.slice(-3), { id, type, message, title }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, title) => push('success', message, title),
      error: (message, title) => push('error', message, title),
      info: (message, title) => push('info', message, title),
      warning: (message, title) => push('warning', message, title),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-5 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2.5 sm:right-6">
          {toasts.map((toast) => {
            const style = styles[toast.type];
            const Icon = style.icon;
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${style.ring} bg-white/95 p-4 shadow-lift backdrop-blur-xl animate-fade-up`}
                role="status"
              >
                <span className={`rounded-xl p-1.5 ${style.bg}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${style.iconClass}`} />
                </span>
                <div className="min-w-0 flex-1">
                  {toast.title && <p className="text-sm font-semibold text-plum-950">{toast.title}</p>}
                  <p className="text-sm leading-5 text-plum-900">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(toast.id)}
                  className="rounded-lg p-1 text-plum-600 transition hover:bg-lavender-50 hover:text-plum-950"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
