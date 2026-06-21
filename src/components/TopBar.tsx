import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/i18n";
import { checkUpdate } from "@/services/updater";
import { AuthButton } from "@/components/auth/AuthButton";
import { ScopeSearchField } from "@/components/ScopeSearchField";
import { usePageHeaderState } from "@/components/PageHeaderContext";
import { UpdateInfo } from "@/types";

interface TopBarProps {
  onOpenPalette: () => void;
}

export function TopBar({ onOpenPalette }: TopBarProps) {
  const { t } = useTranslation();
  const { title, actions } = usePageHeaderState();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkUpdate()
      .then((info) => {
        if (info.has_update) setUpdateInfo(info);
      })
      .catch((err) => console.warn("Failed to check for updates:", err));
  }, []);

  async function handleUpdateClick() {
    if (updateInfo?.download_url) {
      await openUrl(updateInfo.download_url);
    }
  }

  return (
    <header
      style={{
        height: 52,
        minHeight: 52,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* Drag zone / traffic-light space — native window dragging */}
      <div
        onMouseDown={() => getCurrentWindow().startDragging()}
        data-tauri-drag-region
        style={{
          width: 72,
          height: "100%",
          flexShrink: 0,
          cursor: "grab",
          // @ts-ignore - WebKit specific property for native window dragging
          WebkitAppRegion: "drag",
        } as React.CSSProperties}
      />

      {/* Brand: ember ✦ + wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ color: "var(--ember)", fontSize: 14 }}>✦</span>
        <span
          style={{
            color: "var(--foreground)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {t("topbar.brand")}
        </span>
        {updateInfo?.has_update && (
          <button
            type="button"
            onClick={handleUpdateClick}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            title={`${t("settings.updateAvailable")}: ${updateInfo.latest_version}`}
            style={{
              marginLeft: 4,
              fontSize: 10,
              padding: "2px 8px",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              lineHeight: 1.4,
              flexShrink: 0,
              transition: "opacity 0.2s",
            }}
          >
            {t("marketplace.update")}
          </button>
        )}
      </div>

      {/* Page title (from context) — divider then title */}
      {title && (
        <>
          <div style={{ width: 1, height: 18, background: "var(--border)", flexShrink: 0 }} />
          <span
            style={{
              color: "var(--muted-foreground)",
              fontSize: 13,
              fontWeight: 500,
              flexShrink: 0,
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        </>
      )}

      {/* Center scope search */}
      <ScopeSearchField onOpenPalette={onOpenPalette} />

      {/* Page actions (from context) */}
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}

      {/* Right: auth */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        <AuthButton variant="sidebar" />
      </div>
    </header>
  );
}
