import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  danger: {
    icon: (
      <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    btn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    defaultConfirm: 'Delete',
  },
  warning: {
    icon: (
      <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    btn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
    defaultConfirm: 'Confirm',
  },
  info: {
    icon: (
      <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: 'bg-brand-50 dark:bg-brand-900/20',
    border: 'border-brand-200 dark:border-brand-800',
    btn: 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500 text-white',
    defaultConfirm: 'Confirm',
  },
  primary: {
    icon: (
      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: 'bg-brand-50 dark:bg-brand-900/20',
    border: 'border-brand-200 dark:border-brand-800',
    btn: 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500 text-white',
    defaultConfirm: 'Confirm',
  },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const style = variantStyles[variant];

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${style.bg} flex items-center justify-center`}>
              {style.icon}
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-transparent rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${style.btn}`}
          >
            {confirmLabel || style.defaultConfirm}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

// ─── Hook for easy usage ───
// Usage: const { confirm, ConfirmDialog } = useConfirm();
//        await confirm({ title: 'Delete?', message: '...', variant: 'danger' });

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
}

export function useConfirm() {
  const [state, setState] = React.useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: { message: '' },
    resolve: null,
  });

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmDialog = React.useMemo(
    () => (
      <ConfirmModal
        open={state.open}
        {...state.options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [state.open, state.options, handleConfirm, handleCancel]
  );

  return { confirm, ConfirmDialog };
}
