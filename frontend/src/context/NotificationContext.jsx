import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const toast = { id, type, title, message };
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const notify = {
    success: (title, message, duration) => addToast({ type: 'success', title, message, duration }),
    error: (title, message, duration) => addToast({ type: 'error', title, message, duration }),
    info: (title, message, duration) => addToast({ type: 'info', title, message, duration }),
    warning: (title, message, duration) => addToast({ type: 'warning', title, message, duration }),
    dismiss: removeToast,
  };

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </NotificationContext.Provider>
  );
};

const ToastContainer = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
    {toasts.map((toast) => (
      <Toast key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
    ))}
  </div>
);

const Toast = ({ toast, onDismiss }) => {
  const styles = {
    success: {
      border: 'border-l-green-500',
      bg: 'bg-white dark:bg-gray-900',
      icon: (
        <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'text-green-700 dark:text-green-400',
    },
    error: {
      border: 'border-l-red-500',
      bg: 'bg-white dark:bg-gray-900',
      icon: (
        <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 9v2m0 4h.01M10.293 4.293a1 1 0 011.414 0L21 13.586V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-5.414l9.293-9.293z" />
        </svg>
      ),
      title: 'text-red-700 dark:text-red-400',
    },
    info: {
      border: 'border-l-blue-500',
      bg: 'bg-white dark:bg-gray-900',
      icon: (
        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'text-blue-700 dark:text-blue-400',
    },
    warning: {
      border: 'border-l-amber-500',
      bg: 'bg-white dark:bg-gray-900',
      icon: (
        <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
      ),
      title: 'text-amber-700 dark:text-amber-400',
    },
  };

  const s = styles[toast.type] || styles.info;

  return (
    <div
      role="alert"
      className={`pointer-events-auto border-l-4 ${s.border} ${s.bg} border border-gray-200 dark:border-gray-800
        rounded-lg shadow-lg animate-slideInRight overflow-hidden`}
    >
      <div className="flex items-start gap-3 p-4">
        {s.icon}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={`text-sm font-bold ${s.title}`}>{toast.title}</p>
          )}
          {toast.message && (
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400 break-words">
              {toast.message}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
};
