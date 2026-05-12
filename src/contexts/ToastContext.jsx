import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timeoutRefs = useRef(new Map());
  // Monotonic ID source. Avoids Date.now()/Math.random() — both flagged as
  // impure by react-hooks/purity since the function is defined in the
  // component body — and is also collision-free for rapid-fire toasts.
  const nextIdRef = useRef(0);

  const addToast = (message, type = 'info', duration = 3000, action = null, actions = null) => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    const newToast = { id, message, type, action, actions };

    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      if (timeoutRefs.current.has(id)) {
        clearTimeout(timeoutRefs.current.get(id));
      }

      const timeoutId = setTimeout(() => {
        removeToast(id);
        timeoutRefs.current.delete(id);
      }, duration);

      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  };

  // Toast with an action button (e.g. "Undo"). Default duration is 5s — long
  // enough to reach for the button, short enough to stay out of the way.
  const actionToast = (message, action, options = {}) => {
    const { type = 'info', duration = 5000 } = options;
    return addToast(message, type, duration, action);
  };

  const removeToast = (id) => {
    // Clear timeout if it exists
    if (timeoutRefs.current.has(id)) {
      clearTimeout(timeoutRefs.current.get(id));
      timeoutRefs.current.delete(id);
    }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (message, duration) => addToast(message, 'success', duration);
  const error = (message, duration) => addToast(message, 'error', duration);
  const info = (message, duration) => addToast(message, 'info', duration);
  const warning = (message, duration) => addToast(message, 'warning', duration);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, info, warning, actionToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              flex items-center justify-between p-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out
              min-w-[300px] max-w-md
              ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
              ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-500 text-white' : ''}
              ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
            `}
          >
            <div className="flex items-center space-x-3">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'info' && <Info className="w-5 h-5" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <div className="flex items-center ml-4 space-x-1">
              {(toast.actions ?? (toast.action ? [toast.action] : [])).map((act, i) => (
                <button
                  key={i}
                  onClick={() => {
                    try { act.onClick(); } catch (err) { console.error('Toast action error:', err); }
                    if (act.dismissOnClick !== false) removeToast(toast.id);
                  }}
                  className="px-2 py-1 text-sm font-semibold rounded hover:bg-white/20 transition-colors"
                >
                  {act.label}
                </button>
              ))}
              <button
                onClick={() => removeToast(toast.id)}
                className="text-white hover:text-gray-200 transition-colors p-1"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
