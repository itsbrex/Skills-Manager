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
import { I18nProvider, Language } from "@/i18n";
import { AppConfig } from "@/types";

function App() {
  const { isInitialized, isLoading: initLoading, markInitialized } = useInitialization();
  const [language, setLanguage] = useState<Language>("en");
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load language preference from config on mount
  useEffect(() => {
    async function loadLanguage() {
      try {
        const config = await invoke<AppConfig>("get_config");
        if (config.preferences?.language) {
          setLanguage(config.preferences.language as Language);
        }
      } catch {
        // Use default language on error
      }
      setConfigLoaded(true);
    }
    loadLanguage();
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
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
      <I18nProvider language={language} onLanguageChange={handleLanguageChange}>
        <Welcome onComplete={markInitialized} />
      </I18nProvider>
    );
  }

  return (
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
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;
