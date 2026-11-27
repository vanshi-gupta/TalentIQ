import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-plum-950/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-lavender-200 bg-white shadow-lift animate-fade-up sm:rounded-2xl',
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-lavender-100 bg-ivory px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-plum-950">{title}</h2>
            {description && <p className="mt-1 max-w-2xl text-xs leading-5 text-plum-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-plum-600 transition hover:bg-lavender-100 hover:text-plum-950"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="border-t border-lavender-100 bg-ivory px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  loading,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-xl border border-lavender-200 bg-white px-3.5 text-xs font-medium text-plum-900 transition hover:bg-lavender-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition disabled:opacity-50',
              destructive ? 'bg-peach-700 text-white hover:bg-[#a13d38]' : 'bg-accent text-white hover:bg-accent-deep',
            )}
          >
            {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-plum-700">{description}</p>
    </Modal>
  );
}
