import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { WelcomeStep } from "@/components/welcome/WelcomeStep";
import { ToolDetectionStep } from "@/components/welcome/ToolDetectionStep";
import { DirectorySetupStep } from "@/components/welcome/DirectorySetupStep";
import { ImportSkillsStep } from "@/components/welcome/ImportSkillsStep";
import { SunIcon, MoonIcon, MonitorIcon } from "@/components/icons/theme-icons";
import { useTranslation } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";
import { AppConfig } from "@/types";
import { defaultPreferences } from "@/constants/preferences";

type WizardStep = "welcome" | "tools" | "directory" | "import";

interface WelcomeProps {
  onComplete: () => Promise<void>;
}

export function Welcome({ onComplete }: WelcomeProps) {
  const { language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");

  const steps: WizardStep[] = ["welcome", "tools", "directory", "import"];
  const currentIndex = steps.indexOf(currentStep);

  // Save preferences to config whenever they change
  useEffect(() => {
    async function savePreferences() {
      try {
        const config = await invoke<AppConfig>("get_config");
        const updatedConfig = {
          ...config,
          preferences: {
            ...defaultPreferences,
            ...config.preferences,
            language,
            theme,
          },
        };
        await invoke("save_config", { config: updatedConfig });
        const prefs = updatedConfig.preferences;
        if (prefs) {  // 
      //  // Removed: cloud sync feature
        }
      } catch (error) {
        // Error handled silently - preferences will be saved on next attempt
      }
    }
    savePreferences();
  }, [language, theme]);

  async function goNext() {
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      try {
        await onComplete();
      } catch (error) {
        console.error("Failed to complete setup:", error);
        // Alert user since we don't have toast here easily accessible without prop drilling
        // or we could use window.alert as a fallback for critical failure
        alert("Failed to complete setup: " + String(error));
      }
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--background)',
        overflow: 'hidden',
      }}
    >
      {/* Draggable title bar */}
      <div
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            getCurrentWindow().startDragging();
          }
        }}
        style={{
          height: '52px',
          flexShrink: 0,
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 16px',
          gap: '8px',
        }}
      >
        {/* Theme selector */}
        <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--secondary)', borderRadius: '8px', padding: '3px' }}>
          <ThemeButton
            active={theme === "light"}
            onClick={() => setTheme("light")}
            icon={<SunIcon />}
          />
          <ThemeButton
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            icon={<MoonIcon />}
          />
          <ThemeButton
            active={theme === "system"}
            onClick={() => setTheme("system")}
            icon={<MonitorIcon />}
          />
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--secondary)', borderRadius: '8px', padding: '3px' }}>
          <LangButton active={language === "en"} onClick={() => setLanguage("en")} label="EN" />
          <LangButton active={language === "zh"} onClick={() => setLanguage("zh")} label="中" />
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px 40px',
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px', flexShrink: 0 }}>
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                width: index <= currentIndex ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: index <= currentIndex ? 'var(--primary)' : 'var(--muted)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Step content container */}
        <div style={{ width: '100%', maxWidth: '560px', flexShrink: 0 }}>
          {currentStep === "welcome" && <WelcomeStep onNext={goNext} />}
          {currentStep === "tools" && (
            <ToolDetectionStep onNext={goNext} onBack={goBack} />
          )}
          {currentStep === "directory" && (
            <DirectorySetupStep onNext={goNext} onBack={goBack} />
          )}
          {currentStep === "import" && (
            <ImportSkillsStep onNext={goNext} onBack={goBack} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ paddingBottom: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, opacity: 0.6 }}>
          <a
            href="https://github.com/jiweiyeah/Skills-Manager"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Skills Manager
          </a>
        </p>
      </div>
    </div>
  );
}

// --- Helper components ---

function ThemeButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: active ? 'var(--background)' : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {icon}
    </button>
  );
}

function LangButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '6px',
        border: 'none',
        backgroundColor: active ? 'var(--background)' : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}
