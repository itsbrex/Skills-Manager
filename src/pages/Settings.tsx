import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AppConfig,
  UserPreferences,
  DetectedEditor,
  UpdateInfo,
  MarketplaceSource,
  LlmProvider,
} from "@/types";
import { defaultPreferences } from "@/constants/preferences";
import { startGithubAuth, startGoogleAuth, clearPendingAuthProvider, setPendingAuthProvider } from "@/services/auth";
import { buildAuthErrorMessage } from "@/services/authError";
import { checkUpdate } from "@/services/updater";
import { useTranslation, Language, TranslationPath } from "@/i18n";
import { useSkillTranslation } from "@/hooks/useSkillTranslation";
import { useTheme } from "@/hooks/useTheme";
import { useCloudSync } from "@/hooks/useCloudSyncAgent";
import { resolveTelemetryConsent } from "@/telemetry/consent";
import { getEditorIcon } from "@/assets/editors";
import { FontFamilyPreset, normalizeFontFamilyPreset } from "@/lib/fontFamily";
import wechatRewardCode from "@/assets/donation/wechat-reward-code.jpg";
import alipayRewardCode from "@/assets/donation/alipay-reward-code.jpg";
import { Toggle } from "@/components/ui/toggle";
import { buildCloudSyncIntervalOptions } from "@/services/cloudSyncSettingsOptions";
import { setCloudSyncSettingsSnapshot } from "@/services/cloudSyncSettingsStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { SunIcon, MoonIcon, MonitorIcon } from "@/components/icons/theme-icons";
import { resolveActiveProjectId } from "./projectBindings";

export function Settings() {
  const { t, language, setLanguage } = useTranslation();
  const { setTheme, setFontFamily } = useTheme();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editorDropdownOpen, setEditorDropdownOpen] = useState(false);
  const [availableEditors, setAvailableEditors] = useState<DetectedEditor[]>([]);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  const cloudSync = useCloudSync();
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const tRef = useRef(t);
  const addToastRef = useRef(addToast);
  useEffect(() => {
    tRef.current = t;
    addToastRef.current = addToast;
  });

  const fetchConfig = useCallback(async () => {
    setError(null);
    try {
      const configResult = await invoke<AppConfig>("get_config");
      configResult.preferences = {
        ...defaultPreferences,
        ...(configResult.preferences ?? {}),
      };
      const nextActiveProjectId = resolveActiveProjectId(configResult.active_project_id, configResult.projects ?? []);
      if (nextActiveProjectId !== configResult.active_project_id) {
        addToastRef.current(tRef.current("settings.currentProjectMissing"), "info");
      }
      setConfig({ ...configResult, active_project_id: nextActiveProjectId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    async function loadEditors() {
      try {
        const editors = await invoke<DetectedEditor[]>("get_available_editors");
        setAvailableEditors(editors);
      } catch (err) {
        // Error handled silently - editors list will remain empty
      }
    }
    loadEditors();
  }, []);

  // Auto-check for updates on mount
  useEffect(() => {
    async function autoCheckUpdate() {
      try {
        const info = await checkUpdate();
        if (info.has_update) {
          setUpdateInfo(info);
        }
      } catch (err) {
        console.error("Failed to auto-check update:", err);
      }
    }
    autoCheckUpdate();
  }, []);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!config) return;

    const newConfig = {
      ...config,
      preferences: {
        ...defaultPreferences,
        ...config.preferences,
        [key]: value,
      },
    };
    setConfig(newConfig);

    // If language changed, update the app language immediately
    if (key === "language") {
      setLanguage(value as Language);
    }

    // If theme changed, update the app theme immediately
    if (key === "theme") {
      setTheme(value as "light" | "dark" | "system");
    }

    if (key === "font_family") {
      setFontFamily(value as FontFamilyPreset);
    }
  };

  const updateMarketplaceSource = (
    sourceId: string,
    updates: Partial<MarketplaceSource>
  ) => {
    if (!config) return;
    const sources = config.marketplace_sources || [];
    const updatedSources = sources.map((source) =>
      source.id === sourceId ? { ...source, ...updates } : source
    );
    setConfig({
      ...config,
      marketplace_sources: updatedSources,
    });
  };


  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await invoke("save_config", { config });
      const prefs = config.preferences || defaultPreferences;
      setCloudSyncSettingsSnapshot({
        auto: prefs.cloud_sync_auto,
        intervalMinutes: prefs.cloud_sync_interval_minutes,
      });
      await cloudSync.refreshVaultConsent();
      const telemetryConsent = resolveTelemetryConsent(prefs.telemetry_consent);
      if (telemetryConsent === "granted") {
        void invoke("telemetry_initialize").catch((err) => {
          console.warn("Failed to initialize telemetry after settings save:", err);
        });
      } else if (telemetryConsent === "denied") {
        void invoke("telemetry_clear_local_data").catch((err) => {
          console.warn("Failed to clear telemetry after settings save:", err);
        });
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckUpdate = async () => {
    if (updateInfo) {
      if (updateInfo.download_url) {
        await openUrl(updateInfo.download_url);
      }
      return;
    }

    setCheckingUpdate(true);
    try {
      const info = await checkUpdate();
      if (info.has_update) {
        setUpdateInfo(info);
        addToast(`${t("settings.updateAvailable")}: ${info.latest_version}`, "success");
      } else {
        addToast(t("settings.latestVersion"), "success");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleStartGithubLogin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setPendingAuthProvider("github");
    try {
      const result = await startGithubAuth(language);
      await openUrl(result.auth_url);
    } catch (err) {
      console.warn("Failed to start github auth:", err);
      setAuthError(
        buildAuthErrorMessage(t, err, {
          provider: "github",
          stage: "start",
        }),
      );
      clearPendingAuthProvider();
    } finally {
      setAuthLoading(false);
    }
  }, [language, t]);

  const handleStartGoogleLogin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setPendingAuthProvider("google");
    try {
      const result = await startGoogleAuth(language);
      await openUrl(result.auth_url);
    } catch (err) {
      console.warn("Failed to start google auth:", err);
      setAuthError(
        buildAuthErrorMessage(t, err, {
          provider: "google",
          stage: "start",
        }),
      );
      clearPendingAuthProvider();
    } finally {
      setAuthLoading(false);
    }
  }, [language, t]);

  const handleLogout = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await cloudSync.logout();
    } catch (err) {
      console.warn("Failed to logout:", err);
      setAuthError(t("auth.logoutFailed"));
    } finally {
      setAuthLoading(false);
    }
  }, [cloudSync, t]);

  const handleManualSync = useCallback(async () => {
    setAuthError(null);
    await cloudSync.manualSync();
  }, [cloudSync]);

  if (error) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: '24px 32px', color: 'var(--muted-foreground)' }}>
        {t("common.loading")}
      </div>
    );
  }

  const prefs = config.preferences || defaultPreferences;
  const cloudSyncIntervals = buildCloudSyncIntervalOptions([5, 10, 15, 30, 60]);
  const selectedEditor = availableEditors.find(e => e.id === prefs.default_editor) || availableEditors[0];
  const FallbackEditorIcon = selectedEditor ? getEditorIcon(selectedEditor.id) : null;
  const marketplaceSources = config.marketplace_sources || [];
  const marketplaceRows = marketplaceSources;
  const authProfile = cloudSync.authProfile;
  const vaultConsent = prefs.vault_backup_consent ?? "unknown";
  const telemetryConsent = resolveTelemetryConsent(prefs.telemetry_consent);
  const vaultConsentLabel = vaultConsent === "granted"
    ? t("settings.vaultBackupConsentStatusGranted")
    : vaultConsent === "denied"
      ? t("settings.vaultBackupConsentStatusDenied")
      : t("settings.vaultBackupConsentStatusUnknown");
  const telemetryConsentLabel = telemetryConsent === "granted"
    ? t("settings.telemetryConsentStatusGranted")
    : telemetryConsent === "denied"
      ? t("settings.telemetryConsentStatusDenied")
      : t("settings.telemetryConsentStatusUnknown");
  const lastSyncedLabel = cloudSync.lastSyncedAt
    ? t("cloudSync.lastSynced").replace("{time}", new Date(cloudSync.lastSyncedAt * 1000).toLocaleString())
    : t("cloudSync.neverSynced");
  const providerLabel = authProfile?.provider === "github"
    ? "GitHub"
    : authProfile?.provider === "google"
      ? "Google"
      : authProfile?.provider || "-";

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      <PageHeader
        title={t("settings.title")}
        actions={
          <>
            {saveSuccess && (
              <span style={{
                fontSize: '13px',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {t("common.saved")}
              </span>
            )}
            {saveError && (
              <span style={{ fontSize: '13px', color: 'var(--color-error)' }}>
                {saveError}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--primary-foreground)',
                backgroundColor: 'var(--foreground)',
                border: 'none',
                borderRadius: '8px',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => !saving && (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => !saving && (e.currentTarget.style.opacity = '1')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              {saving ? t("common.saving") : t("settings.saveSettings")}
            </button>
          </>
        }
      />

      {/* Content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px',
      }}>
        <div style={{ maxWidth: '680px' }}>
          {/* General Section */}
          <SectionTitle>{t("settings.general")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.skillsDirectory")}
              description={t("settings.skillsDirectoryDesc")}
              isLast={false}
            >
              <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <code
                  title={config.skills_dir}
                  style={{
                  display: 'block',
                  width: '100%',
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                  backgroundColor: 'var(--secondary)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.5,
                }}
                >
                  {config.skills_dir}
                </code>
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.defaultEditor")}
              description={t("settings.defaultEditorDesc")}
              isLast={false}
            >
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setEditorDropdownOpen(!editorDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    backgroundColor: editorDropdownOpen ? 'var(--secondary)' : 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    minWidth: '140px',
                    justifyContent: 'space-between',
                  }}
                >
                  {selectedEditor?.icon_data ? (
                    <img
                      src={selectedEditor.icon_data}
                      alt={selectedEditor.name}
                      style={{ width: 24, height: 24, borderRadius: 6 }}
                    />
                  ) : (
                    FallbackEditorIcon && <FallbackEditorIcon />
                  )}
                  <span>{selectedEditor?.name || t("editors.builtin")}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {editorDropdownOpen && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10,
                      }}
                      onClick={() => setEditorDropdownOpen(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                      zIndex: 20,
                      minWidth: '180px',
                      padding: '4px',
                      overflow: 'hidden',
                    }}>
                      {availableEditors.map((editor) => {
                        const FallbackIcon = getEditorIcon(editor.id);
                        return (
                          <button
                            key={editor.id}
                            onClick={() => {
                              updatePreference("default_editor", editor.id);
                              setEditorDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: '13px',
                              color: 'var(--foreground)',
                              backgroundColor: prefs.default_editor === editor.id ? 'var(--secondary)' : 'transparent',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {editor.icon_data ? (
                              <img
                                src={editor.icon_data}
                                alt={editor.name}
                                style={{ width: 24, height: 24, borderRadius: 6 }}
                              />
                            ) : (
                              <FallbackIcon />
                            )}
                            <span>{editor.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.autoSync")}
              description={t("settings.autoSyncDesc")}
              isLast={false}
            >
              <Toggle
                checked={prefs.auto_sync}
                onChange={(v) => updatePreference("auto_sync", v)}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.removeLinksWhenDisablingTool")}
              description={t("settings.removeLinksWhenDisablingToolDesc")}
              isLast={false}
            >
              <Toggle
                checked={prefs.remove_links_when_disabling_tool}
                onChange={(v) => updatePreference("remove_links_when_disabling_tool", v)}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.syncNotifications")}
              description={t("settings.syncNotificationsDesc")}
              isLast={true}
            >
              <Toggle
                checked={prefs.show_sync_notifications}
                onChange={(v) => updatePreference("show_sync_notifications", v)}
              />
            </SettingsRow>
          </SettingsCard>

          {/* Marketplace Section */}
          <SectionTitle>{t("settings.marketplace")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.githubToken")}
              description={t("settings.githubTokenDesc")}
              isLast={marketplaceRows.length === 0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="password"
                  value={prefs.github_token || ""}
                  onChange={(e) => updatePreference("github_token", e.target.value)}
                  placeholder={t("settings.githubTokenPlaceholder")}
                  style={{
                    width: '220px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    outline: 'none',
                  }}
                />
                <span style={{
                  fontSize: '12px',
                  color: (prefs.github_token || "").trim() ? 'var(--color-success)' : 'var(--muted-foreground)',
                }}>
                  {(prefs.github_token || "").trim()
                    ? t("settings.marketplaceKeySaved")
                    : t("settings.marketplaceKeyMissing")}
                </span>
              </div>
            </SettingsRow>

            {marketplaceRows.length === 0 ? (
              <div style={{
                padding: '16px 0',
                fontSize: '13px',
                color: 'var(--muted-foreground)',
              }}>
                {t("settings.marketplaceEmpty")}
              </div>
            ) : (
              marketplaceRows.map((source, index) => {
                const isLast = index === marketplaceRows.length - 1;
                const typeLabel = source.source_type === "github_repo"
                  ? t("settings.marketplaceSourceTypeGithub")
                  : t("settings.marketplaceSourceTypeApi");
                return (
                  <SettingsRow
                    key={`${source.id}-source`}
                    label={source.name}
                    description={`${typeLabel} · ${source.url}`}
                    isLast={isLast}
                  >
                    <Toggle
                      checked={source.enabled}
                      onChange={(v) => updateMarketplaceSource(source.id, { enabled: v })}
                    />
                  </SettingsRow>
                );
              })
            )}
          </SettingsCard>

          {/* Appearance Section */}
          <SectionTitle>{t("settings.appearance")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.theme")}
              description={t("settings.themeDesc")}
              isLast={false}
            >
              <ThemeSelector
                value={prefs.theme}
                onChange={(v) => updatePreference("theme", v)}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.fontFamily")}
              description={t("settings.fontFamilyDesc")}
              isLast={false}
            >
              <SegmentedControl
                value={normalizeFontFamilyPreset(prefs.font_family)}
                onChange={(v) => updatePreference("font_family", normalizeFontFamilyPreset(v))}
                options={[
                  { value: "system", label: t("settings.fontFamilySystem") },
                  { value: "rounded", label: t("settings.fontFamilyRounded") },
                  { value: "serif", label: t("settings.fontFamilySerif") },
                ]}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.language")}
              description={t("settings.languageDesc")}
              isLast={true}
            >
              <SegmentedControl
                value={language}
                onChange={(v) => updatePreference("language", v as "en" | "zh")}
                options={[
                  { value: "en", label: "English" },
                  { value: "zh", label: "中文" },
                ]}
              />
            </SettingsRow>
          </SettingsCard>

          {/* AI Translation */}
          <SectionTitle>{t("settings.llmTitle")}</SectionTitle>
          <SettingsCard>
            <LlmProviderSection
              provider={config.llm_provider ?? null}
              onChange={(p) => setConfig((prev) => prev ? { ...prev, llm_provider: p } : prev)}
              addToast={addToast}
              t={t}
            />
          </SettingsCard>

          {/* Account & Cloud Sync */}
          <SectionTitle>{t("settings.account")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.accountStatus")}
              description={t("settings.accountDesc")}
              isLast={false}
            >
              {authProfile ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {authProfile.avatar_url ? (
                    <img
                      src={authProfile.avatar_url}
                      alt={authProfile.username || "avatar"}
                      style={{ width: 36, height: 36, borderRadius: '10px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      backgroundColor: 'var(--secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'var(--muted-foreground)',
                    }}>
                      {providerLabel.slice(0, 1)}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                      {authProfile.username || authProfile.email || t("auth.login")}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                      {t("auth.provider")}: {providerLabel}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={authLoading}
                    style={{
                      marginLeft: 'auto',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      backgroundColor: 'var(--secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      cursor: authLoading ? 'wait' : 'pointer',
                      opacity: authLoading ? 0.7 : 1,
                    }}
                  >
                    {authLoading ? t("auth.loggingOut") : t("auth.logout")}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleStartGithubLogin}
                      disabled={authLoading}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        backgroundColor: 'var(--secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: authLoading ? 'wait' : 'pointer',
                        opacity: authLoading ? 0.7 : 1,
                      }}
                    >
                      {authLoading ? t("auth.loggingIn") : t("auth.githubLogin")}
                    </button>
                    <button
                      onClick={handleStartGoogleLogin}
                      disabled={authLoading}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'white',
                        backgroundColor: 'var(--color-primary)',
                        border: '1px solid var(--color-primary)',
                        borderRadius: '8px',
                        cursor: authLoading ? 'wait' : 'pointer',
                        opacity: authLoading ? 0.7 : 1,
                      }}
                    >
                      {authLoading ? t("auth.loggingIn") : t("auth.googleLogin")}
                    </button>
                  </div>
                  {authError && (
                    <div style={{ fontSize: '12px', color: 'var(--color-error)' }}>
                      {authError}
                    </div>
                  )}
                </div>
              )}
            </SettingsRow>

            <SettingsRow
              label={t("settings.cloudSync")}
              description={t("settings.cloudSyncDesc")}
              isLast={false}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                    {authProfile ? t("cloudSync.statusConnected") : t("cloudSync.statusDisconnected")}
                  </span>
                  <button
                    onClick={handleManualSync}
                    disabled={!authProfile || cloudSync.syncing}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: authProfile ? 'var(--foreground)' : 'var(--muted-foreground)',
                      backgroundColor: 'var(--secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      cursor: !authProfile || cloudSync.syncing ? 'not-allowed' : 'pointer',
                      opacity: !authProfile || cloudSync.syncing ? 0.6 : 1,
                    }}
                  >
                    {cloudSync.syncing ? t("cloudSync.syncing") : t("cloudSync.syncNow")}
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                  {authProfile ? lastSyncedLabel : t("cloudSync.notSignedIn")}
                </div>
                {cloudSync.syncStage === "pulling" && (
                  <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                    {t("cloudSync.pulling")}
                  </div>
                )}
                {cloudSync.syncStage === "pushing" && (
                  <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                    {t("cloudSync.pushing")}
                  </div>
                )}
                {cloudSync.conflict && (
                  <div style={{ fontSize: '12px', color: 'var(--color-warning)' }}>
                    {t("cloudSync.conflictNotice")}
                  </div>
                )}
                {cloudSync.error && (
                  <div style={{ fontSize: '12px', color: 'var(--color-error)' }}>
                    {cloudSync.error}
                  </div>
                )}
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.telemetryConsent")}
              description={t("settings.telemetryConsentDesc")}
              isLast={false}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <Toggle
                  checked={telemetryConsent === "granted"}
                  onChange={(v) => updatePreference("telemetry_consent", v ? "granted" : "denied")}
                />
                <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {telemetryConsentLabel}
                </div>
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.vaultBackupConsent")}
              description={t("settings.vaultBackupConsentDesc")}
              isLast={false}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <Toggle
                  checked={vaultConsent === "granted"}
                  onChange={(v) => updatePreference("vault_backup_consent", v ? "granted" : "denied")}
                />
                <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {vaultConsentLabel}
                </div>
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.cloudSyncAuto")}
              description={t("settings.cloudSyncAutoDesc")}
              isLast={false}
            >
              <Toggle
                checked={prefs.cloud_sync_auto}
                onChange={(v) => updatePreference("cloud_sync_auto", v)}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.cloudSyncInterval")}
              description={t("settings.cloudSyncIntervalDesc")}
              isLast={true}
            >
              <select
                value={prefs.cloud_sync_interval_minutes}
                disabled={!prefs.cloud_sync_auto}
                onChange={(e) => updatePreference("cloud_sync_interval_minutes", Number(e.target.value))}
                style={{
                  padding: '8px 10px',
                  fontSize: '12px',
                  color: 'var(--foreground)',
                  backgroundColor: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  opacity: prefs.cloud_sync_auto ? 1 : 0.6,
                  cursor: prefs.cloud_sync_auto ? 'pointer' : 'not-allowed',
                }}
              >
                {cloudSyncIntervals.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {t("settings.cloudSyncIntervalOption").replace("{minutes}", String(minutes))}
                  </option>
                ))}
              </select>
            </SettingsRow>
          </SettingsCard>

          {/* About Section */}
          <SectionTitle>{t("settings.about")}</SectionTitle>
          <SettingsCard>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
            }}>
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  marginBottom: '2px',
                }}>
                  <a
                    href="https://github.com/jiweiyeah/Skills-Manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {t("settings.appName")}
                  </a>
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--muted-foreground)',
                }}>
                  {t("settings.appDescription")}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <a
                    href={language === 'zh'
                      ? "https://github.com/jiweiyeah/Skills-Manager/blob/main/PRIVACY_CN.md"
                      : "https://github.com/jiweiyeah/Skills-Manager/blob/main/PRIVACY.md"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '12px',
                      color: 'var(--primary)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {t("settings.privacyPolicy")}
                  </a>
                </div>
              </div>
              <span style={{
                fontSize: '13px',
                color: 'var(--muted-foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>v{config.version}</span>
                <button
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: updateInfo ? 'var(--primary-foreground)' : 'var(--primary)',
                    backgroundColor: updateInfo ? 'var(--primary)' : 'rgba(9, 105, 218, 0.1)',
                    border: updateInfo ? 'none' : '1px solid rgba(9, 105, 218, 0.2)',
                    borderRadius: '4px',
                    cursor: checkingUpdate ? 'wait' : 'pointer',
                    opacity: checkingUpdate ? 0.7 : 1,
                  }}
                >
                  {checkingUpdate
                    ? t("common.checking")
                    : updateInfo
                      ? t("settings.updateNow")
                      : t("settings.checkUpdate")
                  }
                </button>
              </span>
            </div>
          </SettingsCard>

          <SectionTitle>{t("settings.support")}</SectionTitle>
          <SettingsCard>
            <div style={{ padding: '20px 0' }}>
              <div style={{
                fontSize: '13px',
                color: 'var(--muted-foreground)',
                marginBottom: '16px',
              }}>
                {t("settings.supportDesc")}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
              }}>
                <RewardCodeCard
                  title={t("settings.wechatRewardCode")}
                  imageSrc={wechatRewardCode}
                />
                <RewardCodeCard
                  title={t("settings.alipayRewardCode")}
                  imageSrc={alipayRewardCode}
                />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '16px',
                fontSize: '13px',
              }}>
                <span style={{ color: 'var(--muted-foreground)' }}>
                  {t("settings.kofiSupport")}
                </span>
                <a
                  href="https://ko-fi.com/yeheboo"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--primary)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  ko-fi.com/yeheboo
                </a>
              </div>
            </div>
          </SettingsCard>
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// --- Sub-components ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '15px',
      fontWeight: 600,
      color: 'var(--foreground)',
      margin: '0 0 12px 0',
    }}>
      {children}
    </h2>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'var(--secondary)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      padding: '0 20px',
      marginBottom: '32px',
    }}>
      {children}
    </div>
  );
}

interface RewardCodeCardProps {
  title: string;
  imageSrc: string;
}

function RewardCodeCard({ title, imageSrc }: RewardCodeCardProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      padding: '16px',
      borderRadius: '10px',
      border: '1px solid var(--border)',
      backgroundColor: 'var(--background)',
    }}>
      <img
        src={imageSrc}
        alt={title}
        style={{
          width: '100%',
          maxWidth: '140px',
          aspectRatio: '1 / 1',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          backgroundColor: '#ffffff',
          objectFit: 'cover',
        }}
      />
      <div style={{
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--foreground)',
      }}>
        {title}
      </div>
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
  isLast?: boolean;
}

function SettingsRow({ label, description, children, isLast = false }: SettingsRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, marginRight: '16px' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--foreground)',
          marginBottom: '2px',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '13px',
          color: 'var(--muted-foreground)',
        }}>
          {description}
        </div>
      </div>
      {children}
    </div>
  );
}

interface ThemeSelectorProps {
  value: "light" | "dark" | "system";
  onChange: (value: "light" | "dark" | "system") => void;
}

function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const { t } = useTranslation();

  const options = [
    { value: "light" as const, labelKey: "settings.themeLight" as const, icon: <SunIcon /> },
    { value: "dark" as const, labelKey: "settings.themeDark" as const, icon: <MoonIcon /> },
    { value: "system" as const, labelKey: "settings.themeSystem" as const, icon: <MonitorIcon /> },
  ];

  return (
    <div style={{
      display: 'flex',
      backgroundColor: 'var(--background)',
      borderRadius: '8px',
      padding: '3px',
      border: '1px solid var(--border)',
    }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 500,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: value === option.value ? 'var(--secondary)' : 'transparent',
            color: value === option.value ? 'var(--foreground)' : 'var(--muted-foreground)',
            transition: 'all 0.15s',
          }}
        >
          {option.icon}
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div style={{
      display: 'flex',
      backgroundColor: 'var(--background)',
      borderRadius: '8px',
      padding: '3px',
      border: '1px solid var(--border)',
    }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 500,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: value === option.value ? 'var(--secondary)' : 'transparent',
            color: value === option.value ? 'var(--foreground)' : 'var(--muted-foreground)',
            transition: 'all 0.15s',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type ToastFn = (msg: string, kind?: "success" | "error" | "info") => void;
type TFn = (key: TranslationPath) => string;

interface LlmErrorPayload {
  kind?: string;
  info?: unknown;
}

function formatLlmError(err: unknown, t: TFn): string {
  if (typeof err === "object" && err !== null && "kind" in err) {
    const e = err as LlmErrorPayload;
    switch (e.kind) {
      case "not_configured":
        return t("settings.llmErrorNotConfigured");
      case "bad_base_url":
        return t("settings.llmErrorBadBaseUrl");
      case "network_error":
        return t("settings.llmErrorNetwork");
      case "unauthorized":
        return t("settings.llmErrorUnauthorized");
      case "rate_limited":
        return t("settings.llmErrorRateLimited");
      case "server_error": {
        const info = e.info as { status?: number } | undefined;
        const code = String(info?.status ?? 0);
        return t("settings.llmErrorServer").replace("{code}", code);
      }
      case "timeout":
        return t("settings.llmErrorTimeout");
      case "parse_error":
        return t("settings.llmErrorParse");
      case "content_too_large":
        return t("settings.llmErrorTooLarge");
    }
  }
  return typeof err === "string" ? err : String(err);
}

function isValidBaseUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\/.+/.test(trimmed);
}

interface LlmProviderSectionProps {
  provider: LlmProvider | null;
  onChange: (p: LlmProvider | null) => void;
  addToast: ToastFn;
  t: TFn;
}

function LlmProviderSection({ provider, onChange, addToast, t }: LlmProviderSectionProps) {
  const { refreshConfigured } = useSkillTranslation();
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? "");
  const [apiKey, setApiKey] = useState(provider?.api_key ?? "");
  const [model, setModel] = useState(provider?.model ?? "gpt-4o-mini");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildProvider = (): LlmProvider | null => {
    const base = baseUrl.trim();
    const key = apiKey.trim();
    const m = model.trim();
    if (!base || !key || !m) return null;
    if (!isValidBaseUrl(base)) return null;
    return {
      base_url: base.replace(/\/+$/, ""),
      api_key: key,
      model: m,
      temperature: null,
      max_tokens: null,
      timeout_secs: null,
    };
  };

  const validateForm = (): LlmProvider | null => {
    if (baseUrl.trim() && !isValidBaseUrl(baseUrl)) {
      addToast(t("settings.llmErrorBadBaseUrl"), "error");
      return null;
    }
    return buildProvider();
  };

  const handleTest = async () => {
    const p = validateForm();
    if (!p) return;
    setTesting(true);
    try {
      await invoke<string>("test_llm_provider", { provider: p });
      addToast(t("settings.llmTestSuccess"), "success");
    } catch (err) {
      addToast(formatLlmError(err, t), "error");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const p = validateForm();
    if (!p) return;
    setSaving(true);
    try {
      await invoke("save_llm_provider", { provider: p });
      addToast(t("settings.llmSaved"), "success");
      onChange(p);
      void refreshConfigured();
    } catch (err) {
      addToast(typeof err === "string" ? err : String(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      await invoke("clear_llm_provider");
      setBaseUrl("");
      setApiKey("");
      setModel("");
      addToast(t("settings.llmCleared"), "info");
      onChange(null);
      void refreshConfigured();
    } catch (err) {
      addToast(typeof err === "string" ? err : String(err), "error");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: "13px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    outline: "none",
  };

  return (
    <div style={{ padding: "12px 0" }}>
      <p
        style={{
          fontSize: "12px",
          color: "var(--muted-foreground)",
          margin: "0 0 16px 0",
        }}
      >
        {t("settings.llmDesc")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Field label={t("settings.llmBaseUrl")} hint={t("settings.llmBaseUrlHint")}>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            style={inputStyle}
          />
        </Field>

        <Field label={t("settings.llmApiKey")}>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              style={{
                padding: "0 12px",
                fontSize: "12px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                background: "transparent",
                color: "var(--foreground)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {showKey ? t("settings.llmHideKey") : t("settings.llmShowKey")}
            </button>
          </div>
        </Field>

        <Field label={t("settings.llmModel")} hint={t("settings.llmModelHint")}>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            style={inputStyle}
            list="llm-model-presets"
          />
          <datalist id="llm-model-presets">
            <option value="gpt-4o-mini" />
            <option value="gpt-4o" />
            <option value="deepseek-chat" />
            <option value="qwen-plus" />
            <option value="claude-3-5-haiku-latest" />
          </datalist>
        </Field>

        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || saving}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              background: "transparent",
              color: "var(--foreground)",
              cursor: testing ? "not-allowed" : "pointer",
              opacity: testing ? 0.6 : 1,
            }}
          >
            {testing ? t("settings.llmTesting") : t("settings.llmTest")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={testing || saving}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              border: "none",
              borderRadius: "6px",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {t("settings.llmSave")}
          </button>
          {provider && (
            <button
              type="button"
              onClick={handleClear}
              disabled={testing || saving}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                background: "transparent",
                color: "var(--muted-foreground)",
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              {t("settings.llmClear")}
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={async () => {
              try {
                await invoke("clear_translation_cache");
                addToast(t("settings.llmCacheCleared"), "info");
              } catch (err) {
                addToast(typeof err === "string" ? err : String(err), "error");
              }
            }}
            style={{
              fontSize: "12px",
              color: "var(--muted-foreground)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {t("settings.llmClearCache")}
          </button>
          <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
            <span>{t("settings.llmNoApiHint")} </span>
            <button
              type="button"
              onClick={() => {
                void openUrl("https://yutou.virtualgoods.top");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary)",
                cursor: "pointer",
                padding: 0,
                fontSize: "12px",
                textDecoration: "underline",
              }}
            >
              {t("settings.llmNoApiCta")} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--foreground)",
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
