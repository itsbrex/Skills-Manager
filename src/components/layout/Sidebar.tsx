import { useState, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { checkUpdate } from "@/services/updater";
import {
  startGithubAuth,
  exchangeGithubAuth,
  startGoogleAuth,
  exchangeGoogleAuth,
  clearPendingAuthProvider,
  getAuthProfile,
  logoutAuth,
  setPendingAuthProvider,
  takePendingAuthProvider,
} from "@/services/auth";
import { AuthMeResponse, UpdateInfo } from "@/types";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";

const navItems = [
  { path: "/", labelKey: "nav.skills" as const, icon: "sparkles" },
  { path: "/tools", labelKey: "nav.tools" as const, icon: "wrench" },
  { path: "/marketplace", labelKey: "nav.marketplace" as const, icon: "store" },
  { path: "/settings", labelKey: "nav.settings" as const, icon: "cog" },
  { path: "/feedback", labelKey: "nav.feedback" as const, icon: "message" },
  { path: "/polls", labelKey: "nav.polls" as const, icon: "poll" },
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
  const [authProfile, setAuthProfile] = useState<AuthMeResponse | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<"github" | "google" | null>(null);
  const [devCallbackUrl, setDevCallbackUrl] = useState("");

  useEffect(() => {
    checkUpdate().then((info) => {
      if (info.has_update) {
        setUpdateInfo(info);
      }
    }).catch((err) => {
      console.warn("Failed to check for updates:", err);
    });
  }, []);

  const handleAuthCallback = useCallback(async (url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.protocol !== "skills-manager:" || parsed.host !== "auth" || parsed.pathname !== "/callback") {
      return;
    }
    const loginCode = parsed.searchParams.get("login_code");
    const state = parsed.searchParams.get("state");
    if (!loginCode || !state) {
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const resolvedProvider = pendingProvider ?? takePendingAuthProvider();
      const exchangeAuth = resolvedProvider === "google" ? exchangeGoogleAuth : exchangeGithubAuth;
      const profile = await exchangeAuth(loginCode, state);
      setAuthProfile(profile);
      setAuthModalOpen(false);
    } catch (err) {
      console.warn("Failed to exchange auth code:", err);
      setAuthError(t("auth.loginFailed"));
    } finally {
      setAuthLoading(false);
      setPendingProvider(null);
      clearPendingAuthProvider();
    }
  }, [pendingProvider, t]);

  const handleDevCallbackSubmit = useCallback(async () => {
    if (!devCallbackUrl.trim()) {
      return;
    }
    await handleAuthCallback(devCallbackUrl.trim());
  }, [devCallbackUrl, handleAuthCallback]);

  useEffect(() => {
    getAuthProfile()
      .then((profile) => setAuthProfile(profile))
      .catch((err) => {
        console.warn("Failed to load auth profile:", err);
      });
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    getCurrent()
      .then((urls) => {
        if (urls) {
          urls.forEach((url) => {
            void handleAuthCallback(url);
          });
        }
      })
      .catch(() => {
        // ignore deep link check failures
      });

    onOpenUrl((urls: string[]) => {
      urls.forEach((url: string) => {
        void handleAuthCallback(url);
      });
    })
      .then((stop: () => void) => {
        unlisten = stop;
      })
      .catch(() => {
        // ignore deep link listener failures
      });

    return () => {
      unlisten?.();
    };
  }, [handleAuthCallback]);

  const handleUpdateClick = async () => {
    if (updateInfo?.download_url) {
      await openUrl(updateInfo.download_url);
    }
  };

  const handleStartGithubAuth = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setPendingProvider("github");
    setPendingAuthProvider("github");
    try {
      const result = await startGithubAuth();
      console.info("OAuth auth_url:", result.auth_url);
      await openUrl(result.auth_url);
    } catch (err) {
      console.warn("Failed to start github auth:", err);
      setAuthError(t("auth.loginFailed"));
      setPendingProvider(null);
      clearPendingAuthProvider();
    } finally {
      setAuthLoading(false);
    }
  }, [t]);

  const handleStartGoogleAuth = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setPendingProvider("google");
    setPendingAuthProvider("google");
    try {
      const result = await startGoogleAuth();
      console.info("OAuth auth_url:", result.auth_url);
      await openUrl(result.auth_url);
    } catch (err) {
      console.warn("Failed to start google auth:", err);
      setAuthError(t("auth.loginFailed"));
      setPendingProvider(null);
      clearPendingAuthProvider();
    } finally {
      setAuthLoading(false);
    }
  }, [t]);

  const handleLogout = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await logoutAuth();
      setAuthProfile(null);
      setAuthModalOpen(false);
    } catch (err) {
      console.warn("Failed to logout:", err);
      setAuthError(t("auth.logoutFailed"));
    } finally {
      setAuthLoading(false);
    }
  }, [t]);

  const displayName = authProfile?.username || authProfile?.email || t("auth.login");
  const providerLabel = authProfile?.provider === "github"
    ? "GitHub"
    : authProfile?.provider === "google"
      ? "Google"
      : authProfile?.provider || "-";

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
          height: '52px',
          minHeight: '52px',
          cursor: 'default',
        }}
      />
      {/* App name */}
      <div
        style={{
          padding: '0 20px 12px 20px',
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
      <nav style={{ padding: '8px', flex: 1 }}>
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
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--muted-foreground)',
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {authProfile?.avatar_url ? (
              <img
                src={authProfile.avatar_url}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </div>
          <span style={{ color: 'var(--foreground)' }}>{displayName}</span>
        </button>
      </div>

      {authModalOpen && (
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
          onClick={() => setAuthModalOpen(false)}
        >
          <div
            style={{
              width: "min(520px, calc(100vw - 48px))",
              backgroundColor: "var(--background)",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 56px rgba(0,0,0,0.22)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 600, color: "var(--foreground)" }}>
                  {authProfile ? t("auth.accountTitle") : t("auth.loginTitle")}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  {authProfile ? t("auth.accountDesc") : t("auth.loginDesc")}
                </p>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
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

            {authProfile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      backgroundColor: "var(--muted)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {authProfile.avatar_url ? (
                      <img
                        src={authProfile.avatar_url}
                        alt={displayName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>
                      {displayName}
                    </div>
                    {authProfile.email && (
                      <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                        {authProfile.email}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {t("auth.provider")}: {providerLabel}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={authLoading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                    backgroundColor: "var(--secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    cursor: authLoading ? "wait" : "pointer",
                    opacity: authLoading ? 0.7 : 1,
                  }}
                >
                  {authLoading ? t("auth.loggingOut") : t("auth.logout")}
                </button>

                {authError && (
                  <div style={{ fontSize: "12px", color: "#dc2626" }}>
                    {authError}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  type="button"
                  onClick={handleStartGithubAuth}
                  disabled={authLoading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--primary-foreground)",
                    backgroundColor: "var(--primary)",
                    border: "1px solid var(--primary)",
                    borderRadius: "10px",
                    cursor: authLoading ? "wait" : "pointer",
                    opacity: authLoading ? 0.7 : 1,
                  }}
                >
                  {authLoading ? t("auth.loggingIn") : t("auth.githubLogin")}
                </button>
                <button
                  type="button"
                  onClick={handleStartGoogleAuth}
                  disabled={authLoading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                    backgroundColor: "var(--secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    cursor: authLoading ? "wait" : "pointer",
                    opacity: authLoading ? 0.7 : 1,
                  }}
                >
                  {authLoading ? t("auth.loggingIn") : t("auth.googleLogin")}
                </button>
                {import.meta.env.DEV && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "1px dashed var(--border)",
                      backgroundColor: "var(--secondary)",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                      {t("auth.devCallbackTip")}
                    </div>
                    <input
                      type="text"
                      value={devCallbackUrl}
                      onChange={(e) => setDevCallbackUrl(e.target.value)}
                      placeholder="skills-manager://auth/callback?login_code=...&state=..."
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "12px",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleDevCallbackSubmit}
                      disabled={authLoading}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "8px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--foreground)",
                        backgroundColor: "var(--secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        cursor: authLoading ? "wait" : "pointer",
                        opacity: authLoading ? 0.7 : 1,
                      }}
                    >
                      {t("auth.devCallbackApply")}
                    </button>
                  </div>
                )}
                {authError && (
                  <div style={{ fontSize: "12px", color: "#dc2626" }}>
                    {authError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
