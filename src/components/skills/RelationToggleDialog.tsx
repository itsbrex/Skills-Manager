import { Toggle } from "@/components/ui/toggle";
import {
  MODAL_LAYER_Z_INDEX,
  MODAL_OVERLAY_COLOR,
} from "@/constants/modal";

export type RelationToggleItem = {
  id: string;
  label: string;
  enabled: boolean;
  disabled: boolean;
  tooltip?: string;
  dimmed?: boolean;
};

export function RelationToggleDialog({
  title,
  description,
  query,
  enabledOnly,
  searchPlaceholder,
  enabledOnlyLabel,
  bulkToggleLabel,
  bulkToggleDisabled,
  bulkToggleTitle,
  items,
  emptyLabel,
  doneLabel,
  onQueryChange,
  onEnabledOnlyChange,
  onToggle,
  onBulkToggle,
  onClose,
}: {
  title: string;
  description: string;
  query: string;
  enabledOnly: boolean;
  searchPlaceholder: string;
  enabledOnlyLabel: string;
  bulkToggleLabel: string;
  bulkToggleDisabled: boolean;
  bulkToggleTitle?: string;
  items: RelationToggleItem[];
  emptyLabel: string;
  doneLabel: string;
  onQueryChange: (query: string) => void;
  onEnabledOnlyChange: (enabledOnly: boolean) => void;
  onToggle: (itemId: string, enabled: boolean) => void;
  onBulkToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: MODAL_OVERLAY_COLOR,
        zIndex: MODAL_LAYER_Z_INDEX,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(640px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 72px)",
          backgroundColor: "var(--background)",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 56px rgba(0,0,0,0.22)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 600, color: "var(--foreground)" }}>
              {title}
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              {description}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--secondary)",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 280px", minWidth: "200px" }}>
            <svg
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted-foreground)",
                pointerEvents: "none",
              }}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                padding: "8px 10px 8px 32px",
                fontSize: "12px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                backgroundColor: "var(--secondary)",
                color: "var(--foreground)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--muted-foreground)",
              userSelect: "none",
            }}
          >
            <Toggle
              checked={enabledOnly}
              onChange={(checked) => onEnabledOnlyChange(checked)}
            />
            {enabledOnlyLabel}
          </label>

          <button
            type="button"
            onClick={onBulkToggle}
            disabled={bulkToggleDisabled}
            title={bulkToggleTitle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 10px",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: bulkToggleDisabled ? "not-allowed" : "pointer",
              opacity: bulkToggleDisabled ? 0.6 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
            </svg>
            {bulkToggleLabel}
          </button>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "10px",
            backgroundColor: "var(--secondary)",
            overflow: "hidden",
          }}
        >
          <div style={{ maxHeight: "360px", overflow: "auto", padding: "6px" }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: "30px 14px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "var(--muted-foreground)",
                }}
              >
                {emptyLabel}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "8px",
                }}
              >
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      minHeight: "48px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      backgroundColor: item.enabled ? "rgba(9, 105, 218, 0.08)" : "var(--background)",
                      opacity: item.dimmed ? 0.6 : 1,
                    }}
                    title={item.tooltip}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "var(--foreground)",
                        lineHeight: 1.35,
                        minWidth: 0,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label}
                    </div>
                    <Toggle
                      checked={item.enabled}
                      disabled={item.disabled}
                      onChange={(checked) => onToggle(item.id, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--primary-foreground)",
              backgroundColor: "var(--foreground)",
              border: "none",
              borderRadius: "8px",
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
