import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Layout } from "@/components/layout/Layout";
import { Skills } from "@/pages/Skills";
import { Tools } from "@/pages/Tools";
import { Settings } from "@/pages/Settings";
import { EditorPage } from "@/pages/Editor";
import { Welcome } from "@/pages/Welcome";
import { useInitialization } from "@/hooks/useInitialization";
import { ThemeProvider } from "@/hooks/useTheme";
import { I18nProvider, Language } from "@/i18n";
import { AppConfig } from "@/types";
import { checkUpdate } from "@/services/updater";
import { ToastContainer, useToast } from "@/components/ui/toast";

type Theme = "light" | "dark" | "system";

function App() {
  const { isInitialized, isLoading: initLoading, markInitialized } = useInitialization();
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [configLoaded, setConfigLoaded] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // Check for updates on mount
  useEffect(() => {
    async function checkForUpdates() {
      try {
        const info = await checkUpdate();
        if (info.has_update) {
          addToast(`Update available: ${info.latest_version}`, "info");
          // Optionally auto-open or just notify.
          // Since toast in this app is simple, we might just notify.
          // Or we can modify toast to support actions, but for now simple notification is fine.
        }
      } catch (e) {
        console.warn("Auto-update check failed:", e);
      }
    }
    // Only run if initialized to avoid cluttering welcome screen
    if (isInitialized) {
      checkForUpdates();
    }
  }, [isInitialized, addToast]);

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
              <Route path="settings" element={<Settings />} />
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
