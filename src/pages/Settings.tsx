import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { AppConfig, UserPreferences, DetectedEditor } from "@/types";
import { useTranslation, Language } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";
import { getEditorIcon } from "@/assets/editors";

// Default preferences
const defaultPreferences: UserPreferences = {
  theme: "system",
  language: "en",
  auto_sync: true,
  sync_on_save: true,
  default_editor: "system",
  tab_size: 2,
  show_sync_notifications: true,
};


export function Settings() {
  const { t, language, setLanguage } = useTranslation();
  const { setTheme } = useTheme();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editorDropdownOpen, setEditorDropdownOpen] = useState(false);
  const [availableEditors, setAvailableEditors] = useState<DetectedEditor[]>([]);

  const fetchConfig = useCallback(async () => {
    setError(null);
    try {
      const configResult = await invoke<AppConfig>("get_config");
      if (!configResult.preferences) {
        configResult.preferences = { ...defaultPreferences };
      }
      setConfig(configResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInitialLoading(false);
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
        console.error("Failed to load editors:", err);
      }
    }
    loadEditors();
  }, []);

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("settings.skillsDirectory"),
      });
      if (selected && config) {
        setConfig({
          ...config,
          skills_dir: selected as string,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

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
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await invoke("save_config", { config });
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

  if (error) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          color: '#dc2626',
          fontSize: '14px',
        }}>
          {error}
        </div>
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
  const selectedEditor = availableEditors.find(e => e.id === prefs.default_editor) || availableEditors[0];
  const FallbackEditorIcon = selectedEditor ? getEditorIcon(selectedEditor.id) : null;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      {/* Top Bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--background)',
        flexShrink: 0,
      }}>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--foreground)',
          margin: 0,
        }}>
          {t("settings.title")}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saveSuccess && (
            <span style={{
              fontSize: '13px',
              color: '#16a34a',
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
            <span style={{ fontSize: '13px', color: '#dc2626' }}>
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
        </div>
      </header>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                  backgroundColor: 'var(--secondary)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {config.skills_dir}
                </code>
                <button
                  onClick={handleSelectDirectory}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {t("common.change")}
                </button>
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
                  {t("settings.appName")}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--muted-foreground)',
                }}>
                  {t("settings.appDescription")}
                </div>
              </div>
              <span style={{
                fontSize: '13px',
                color: 'var(--muted-foreground)',
              }}>
                v{config.version}
              </span>
            </div>
          </SettingsCard>
        </div>
      </main>
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

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        backgroundColor: checked ? '#3b82f6' : 'var(--border)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '22px' : '2px',
        width: '20px',
        height: '20px',
        borderRadius: '10px',
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

interface ThemeSelectorProps {
  value: "light" | "dark" | "system";
  onChange: (value: "light" | "dark" | "system") => void;
}

function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const { t } = useTranslation();

  const options = [
    { value: "light" as const, labelKey: "settings.themeLight" as const, icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    )},
    { value: "dark" as const, labelKey: "settings.themeDark" as const, icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    )},
    { value: "system" as const, labelKey: "settings.themeSystem" as const, icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    )},
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
