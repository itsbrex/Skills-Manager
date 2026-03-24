import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Layout } from "@/components/layout/Layout";
import { Skills } from "@/pages/Skills";
import { Tools } from "@/pages/Tools";
import { Marketplace } from "@/pages/Marketplace";
import { Settings } from "@/pages/Settings";
import { Feedback } from "@/pages/Feedback";
import { Polls } from "@/pages/Polls";
import { EditorPage } from "@/pages/Editor";
import { Welcome } from "@/pages/Welcome";
import { useInitialization } from "@/hooks/useInitialization";
import { ThemeProvider } from "@/hooks/useTheme";
import { CloudSyncProvider } from "@/hooks/useCloudSyncAgent";
import { I18nProvider, Language } from "@/i18n";
import { registerTelemetryCloseHandler } from "@/telemetry/registerTelemetryCloseHandler";
import {
  resolveTelemetryConsent,
  shouldPromptForTelemetryConsent,
} from "@/telemetry/consent";
import { FontFamilyPreset, normalizeFontFamilyPreset } from "@/lib/fontFamily";
import { AppConfig, MarketplaceUpdateCheckResult, TelemetryConsent } from "@/types";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { CloudSyncConflictDialog } from "@/components/cloud/CloudSyncConflictDialog";
import { VaultConsentDialog } from "@/components/cloud/VaultConsentDialog";
import { TelemetryConsentDialog } from "@/components/telemetry/TelemetryConsentDialog";
import { defaultPreferences } from "@/constants/preferences";

type Theme = "light" | "dark" | "system";
const TELEMETRY_HEARTBEAT_INTERVAL_MS = 60_000;
const TELEMETRY_FLUSH_INTERVAL_MS = 600_000;
const TELEMETRY_STARTUP_FLUSH_DELAY_MS = 45_000;

function App() {
  const { isInitialized, isLoading: initLoading, markInitialized } = useInitialization();
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [fontFamily, setFontFamily] = useState<FontFamilyPreset>("system");
  const [telemetryConsent, setTelemetryConsent] = useState<TelemetryConsent>(
    defaultPreferences.telemetry_consent,
  );
  const [configLoaded, setConfigLoaded] = useState(false);
  const [telemetryConsentSaving, setTelemetryConsentSaving] = useState(false);
  const [telemetryConsentError, setTelemetryConsentError] = useState<string | null>(null);
  const { toasts, removeToast } = useToast();

  // Load preferences from config on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const config = await invoke<AppConfig>("get_config");
        if (config.preferences?.language) {
          setLanguage(config.preferences.language as Language);
        }
        if (config.preferences?.theme) {
          setTheme(config.preferences.theme as Theme);
        }
        setFontFamily(normalizeFontFamilyPreset(config.preferences?.font_family));
        setTelemetryConsent(resolveTelemetryConsent(config.preferences?.telemetry_consent));
      } catch {
        // Use defaults on error
      }
      setConfigLoaded(true);
    }
    loadPreferences();
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
  }, []);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  const handleFontFamilyChange = useCallback((newFontFamily: FontFamilyPreset) => {
    setFontFamily(newFontFamily);
  }, []);

  const handleTelemetryConsentChange = useCallback(async (nextConsent: TelemetryConsent) => {
    setTelemetryConsentSaving(true);
    setTelemetryConsentError(null);

    try {
      const config = await invoke<AppConfig>("get_config");
      const nextConfig: AppConfig = {
        ...config,
        preferences: {
          ...defaultPreferences,
          ...(config.preferences ?? {}),
          telemetry_consent: nextConsent,
        },
      };

      await invoke("save_config", { config: nextConfig });
      setTelemetryConsent(nextConsent);

      if (nextConsent === "granted") {
        void invoke("telemetry_initialize").catch(() => {
          // keep telemetry initialization silent on failures after consent changes
        });
      } else if (nextConsent === "denied") {
        void invoke("telemetry_clear_local_data").catch(() => {
          // keep telemetry cleanup silent on failures after consent changes
        });
      }
    } catch (error) {
      setTelemetryConsentError(error instanceof Error ? error.message : String(error));
    } finally {
      setTelemetryConsentSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || !configLoaded) {
      return;
    }

    const timer = window.setTimeout(() => {
      void invoke<MarketplaceUpdateCheckResult>("check_marketplace_updates_if_stale").catch(
        () => {
          // keep startup check silent on failures
        },
      );
    }, 20_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [configLoaded, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !configLoaded) {
      return;
    }

    void invoke("telemetry_initialize").catch(() => {
      // keep telemetry initialization silent on failures
    });

    const startupFlushTimer = window.setTimeout(() => {
      void invoke("telemetry_flush_pending").catch(() => {
        // keep telemetry flush silent on failures
      });
    }, TELEMETRY_STARTUP_FLUSH_DELAY_MS);

    const heartbeatTimer = window.setInterval(() => {
      void invoke("telemetry_record_heartbeat").catch(() => {
        // keep telemetry heartbeat silent on failures
      });
    }, TELEMETRY_HEARTBEAT_INTERVAL_MS);

    const flushTimer = window.setInterval(() => {
      void invoke("telemetry_flush_pending").catch(() => {
        // keep telemetry flush silent on failures
      });
    }, TELEMETRY_FLUSH_INTERVAL_MS);

    let disposed = false;
    let unlistenCloseRequested: (() => void) | undefined;

    void registerTelemetryCloseHandler({
      appWindow: getCurrentWindow(),
      endSession: async (reason) => {
        await invoke("telemetry_end_session", { reason });
      },
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }

        unlistenCloseRequested = unlisten;
      })
      .catch(() => {
        // keep telemetry shutdown registration silent on failures
      });

    return () => {
      disposed = true;
      window.clearTimeout(startupFlushTimer);
      window.clearInterval(heartbeatTimer);
      window.clearInterval(flushTimer);
      unlistenCloseRequested?.();
    };
  }, [
    configLoaded,
    isInitialized,
  ]);

  // Wait for both initialization check and config to load
  if (initLoading || !configLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <ThemeProvider
        theme={theme}
        fontFamily={fontFamily}
        onThemeChange={handleThemeChange}
        onFontFamilyChange={handleFontFamilyChange}
      >
        <I18nProvider language={language} onLanguageChange={handleLanguageChange}>
          <Welcome onComplete={markInitialized} />
        </I18nProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider
      theme={theme}
      fontFamily={fontFamily}
      onThemeChange={handleThemeChange}
      onFontFamilyChange={handleFontFamilyChange}
    >
      <I18nProvider language={language} onLanguageChange={handleLanguageChange}>
        <CloudSyncProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Skills />} />
                <Route path="tools" element={<Tools />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="settings" element={<Settings />} />
                <Route path="feedback" element={<Feedback />} />
                <Route path="polls" element={<Polls />} />
              </Route>
              <Route path="/editor" element={<EditorPage />} />
            </Routes>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
          </BrowserRouter>
          <CloudSyncConflictDialog />
          <VaultConsentDialog />
          <TelemetryConsentDialog
            open={isInitialized && configLoaded && shouldPromptForTelemetryConsent(telemetryConsent)}
            saving={telemetryConsentSaving}
            error={telemetryConsentError}
            onAccept={() => {
              void handleTelemetryConsentChange("granted");
            }}
            onDeny={() => {
              void handleTelemetryConsentChange("denied");
            }}
          />
        </CloudSyncProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
