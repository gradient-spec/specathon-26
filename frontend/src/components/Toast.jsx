import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);

let idCounter = 0;

/**
 * Lightweight toast system - no external dependency, just enough to replace
 * jarring `alert()` calls with a small animated stack in the corner.
 * Wrap the app in <ToastProvider> once, then call useToast() anywhere.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message, duration = 2800) => {
    idCounter += 1;
    const id = idCounter;
    setToasts((prev) => [...prev, { id, message }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto px-4 py-2.5 rounded-full glass-panel border border-white/10 shadow-glow-sm text-sm text-slate-100 whitespace-nowrap"
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Returns showToast(message, durationMs?) - call it wherever an action needs feedback. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
