import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const api = useMemo(() => ({
    push(message, tone = "success") {
      const id = crypto.randomUUID();
      setToasts(current => [...current, { id, message, tone }]);
      window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 3200);
    }
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">{toasts.map(toast => <div className={`toast ${toast.tone}`} key={toast.id}>{toast.message}</div>)}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
