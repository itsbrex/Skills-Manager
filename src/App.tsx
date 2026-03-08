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
import { I18nProvider, Language } from "@/i18n";
import { registerTelemetryCloseHandler } from "@/telemetry/registerTelemetryCloseHandler";
import { AppConfig, MarketplaceUpdateCheckResult } from "@/types";
import { ToastContainer, useToast } from "@/components/ui/toast";

type Theme = "light" | "dark" | "system";
const TELEMETRY_HEARTBEAT_INTERVAL_MS = 60_000;
const TELEMETRY_FLUSH_INTERVAL_MS = 600_000;
const TELEMETRY_STARTUP_FLUSH_DELAY_MS = 45_000;

function App() {
  const { isInitialized, isLoading: initLoading, markInitialized } = useInitialization();
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [configLoaded, setConfigLoaded] = useState(false);
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
      <ThemeProvider theme={theme} onThemeChange={handleThemeChange}>
        <I18nProvider language={language} onLanguageChange={handleLanguageChange}>
          <Welcome onComplete={markInitialized} />
        </I18nProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme} onThemeChange={handleThemeChange}>
      <I18nProvider language={language} onLanguageChange={handleLanguageChange}>
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
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
