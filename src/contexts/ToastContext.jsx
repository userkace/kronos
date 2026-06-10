import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence initial={false}>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 48, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`
              flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border
              min-w-[300px] max-w-md
              ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
              ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : ''}
              ${toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : ''}
              ${toast.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
            `}
          >
            <div className="flex items-center gap-3 min-w-0">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0 text-green-500" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />}
              {toast.type === 'info' && <Info className="w-5 h-5 shrink-0 text-blue-500" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(toast.actions ?? (toast.action ? [toast.action] : [])).map((act, i) => (
                <button
                  key={i}
                  onClick={() => {
                    try { act.onClick(); } catch (err) { console.error('Toast action error:', err); }
                    if (act.dismissOnClick !== false) removeToast(toast.id);
                  }}
                  className="px-2.5 py-1 text-sm font-semibold rounded-lg hover:bg-black/5 transition-colors duration-150"
                >
                  {act.label}
                </button>
              ))}
              <button
                onClick={() => removeToast(toast.id)}
                className={`
                  p-1.5 rounded-lg transition-colors duration-150
                  ${toast.type === 'success' ? 'text-green-500 hover:text-green-700 hover:bg-green-100' : ''}
                  ${toast.type === 'error' ? 'text-red-500 hover:text-red-700 hover:bg-red-100' : ''}
                  ${toast.type === 'warning' ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-100' : ''}
                  ${toast.type === 'info' ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-100' : ''}
                `}
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
