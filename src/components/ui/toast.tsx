import { useState, useEffect, useCallback } from "react";

export interface Toast {
  id: string;
  message: string;
  type: "error" | "success" | "info";
  persistent?: boolean; // 持久化 toast，不自动关闭
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.persistent) return; // 持久化 toast 不自动关闭

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.persistent, onRemove]);

  const bgColor = toast.type === "error" ? "#fef2f2" : toast.type === "success" ? "#f0fdf4" : "#eff6ff";
  const borderColor = toast.type === "error" ? "#fecaca" : toast.type === "success" ? "#bbf7d0" : "#bfdbfe";
  const textColor = toast.type === "error" ? "#dc2626" : toast.type === "success" ? "#16a34a" : "#2563eb";

  return (
    <div
      style={{
        padding: "12px 16px",
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "10px",
        color: textColor,
        fontSize: "14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "translateX(100%)" : "translateX(0)",
        transition: "opacity 0.3s, transform 0.3s",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {toast.type === "error" && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="m15 9-6 6M9 9l6 6"/>
        </svg>
      )}
      {toast.type === "success" && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      )}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "2px",
          color: textColor,
          opacity: 0.6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "400px",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"] = "error", persistent: boolean = false) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, persistent }]);
    return id; // 返回 id 以便后续更新
  }, []);

  const updateToast = useCallback((id: string, message: string, type?: Toast["type"], persistent?: boolean) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, message, type: type !== undefined ? type : t.type, persistent: persistent !== undefined ? persistent : t.persistent }
          : t
      )
    );
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, updateToast, removeToast };
}
