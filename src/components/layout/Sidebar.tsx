import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { checkUpdate } from "@/services/updater";
import { AuthButton } from "@/components/auth/AuthButton";
import { UpdateInfo } from "@/types";
import { getSidebarChromeMetrics } from "./sidebarChrome";

const navItems = [
  { path: "/", labelKey: "nav.skills" as const, icon: "sparkles" },
  { path: "/tools", labelKey: "nav.tools" as const, icon: "wrench" },
  { path: "/marketplace", labelKey: "nav.marketplace" as const, icon: "store" },
  { path: "/settings", labelKey: "nav.settings" as const, icon: "cog" },
  { path: "/feedback", labelKey: "nav.feedback" as const, icon: "message" },
];

const icons: Record<string, React.ReactNode> = {
  sparkles: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
      <path d="M19 15L20 18L23 19L20 20L19 23L18 20L15 19L18 18L19 15Z"/>
    </svg>
  ),
  wrench: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  store: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18l-1.2 12.2a2 2 0 0 1-2 1.8H6.2a2 2 0 0 1-2-1.8L3 7z"/>
      <path d="M3 7l2-4h14l2 4"/>
      <path d="M9 11a3 3 0 0 0 6 0"/>
    </svg>
  ),
  cog: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  poll: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  ),
};

export function Sidebar() {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkUpdate().then((info) => {
      if (info.has_update) {
        setUpdateInfo(info);
      }
    }).catch((err) => {
      console.warn("Failed to check for updates:", err);
    });
  }, []);

  const handleUpdateClick = async () => {
    if (updateInfo?.download_url) {
      await openUrl(updateInfo.download_url);
    }
  };

  const chromeMetrics = getSidebarChromeMetrics(
    typeof navigator === "undefined" ? "" : navigator.userAgent,
  );

  return (
    <aside
      style={{
        width: '200px',
        minWidth: '200px',
        height: '100%',
        backgroundColor: 'var(--sidebar)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Draggable titlebar region for macOS */}
      <div
        onMouseDown={() => getCurrentWindow().startDragging()}
        style={{
          height: `${chromeMetrics.topSpacerHeight}px`,
          minHeight: `${chromeMetrics.topSpacerHeight}px`,
          cursor: 'grab',
        }}
      />
      {/* App name */}
      <div
        style={{
          padding: chromeMetrics.brandPadding,
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--muted-foreground)',
          letterSpacing: '0.01em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Skills Manager</span>
        {updateInfo?.has_update && (
          <button
            onClick={handleUpdateClick}
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              lineHeight: 1,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            title={`New version available: ${updateInfo.latest_version}`}
          >
            Update
          </button>
        )}
      </div>
      {/* Navigation */}
      <nav style={{ padding: chromeMetrics.navPadding, flex: 1 }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {navItems.map((item) => (
            <li key={item.path} style={{ marginBottom: '2px' }}>
              <NavLink
                to={item.path}
                className={({ isActive }) => (isActive ? 'active' : '')}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: 'none',
                  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                  backgroundColor: isActive ? 'var(--sidebar-accent)' : 'transparent',
                  transition: 'background-color 0.15s, color 0.15s',
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>
                  {icons[item.icon as keyof typeof icons]}
                </span>
                <span>{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--sidebar-border)',
        }}
      >
        <AuthButton variant="sidebar" />
      </div>
    </aside>
  );
}
