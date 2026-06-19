import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleX, X } from 'lucide-react';
import { subscribeToasts } from '../../services/toastService';

const icons = {
  success: CheckCircle2,
  error: CircleX,
  warning: AlertTriangle,
};

const titles = {
  success: 'Exito',
  error: 'Error',
  warning: 'Advertencia',
};

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      const id = crypto.randomUUID();
      const nextToast = {
        id,
        type: toast.type || 'success',
        title: toast.title,
        message: toast.message,
        duration: toast.duration ?? 4500,
      };

      setToasts((current) => [...current, nextToast].slice(-4));

      if (nextToast.duration > 0) {
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, nextToast.duration);
      }
    });
  }, []);

  function dismiss(id) {
    setToasts((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-label="Notificaciones">
        {toasts.map((item) => {
          const Icon = icons[item.type] || CheckCircle2;

          return (
            <div className={`toast-card ${item.type}`} key={item.id} role="status">
              <span className="toast-icon">
                <Icon size={18} />
              </span>
              <div className="toast-copy">
                <strong>{item.title || titles[item.type] || 'Aviso'}</strong>
                <span>{item.message}</span>
              </div>
              <button className="toast-close" type="button" onClick={() => dismiss(item.id)} title="Cerrar aviso" aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
