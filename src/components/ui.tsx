import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  Shield,
  X,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Shield size={22} />
      </span>
      SENTINEL<span className="brand-version">/ V.01</span>
    </span>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone.toLowerCase()}`}>
      <i />
      {children}
    </span>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Panel({
  title,
  label,
  children,
  className = "",
}: {
  title: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {label && <span className="mono muted">{label}</span>}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title = "No records yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Shield size={30} />
      <h3>{title}</h3>
      <p>
        {children || "Your records will appear here as the system is used."}
      </p>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error-box">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Skeleton() {
  return (
    <div aria-label="Loading" className="skeleton-stack">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: number;
  note: string;
  accent?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 550, 1);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <div className={`metric ${accent || ""}`}>
      <div className="metric-label">
        {label}
        <ArrowUpRight size={16} />
      </div>
      <strong>{shown.toLocaleString()}</strong>
      <span>{note}</span>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="panel-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <ToastContext.Provider
      value={(message, error = false) => setToast({ message, error })}
    >
      {children}
      {toast && (
        <div role="status" className={`toast ${toast.error ? "error" : ""}`}>
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export const dateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
