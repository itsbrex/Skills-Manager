import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { WelcomeStep } from "@/components/welcome/WelcomeStep";
import { ToolDetectionStep } from "@/components/welcome/ToolDetectionStep";
import { DirectorySetupStep } from "@/components/welcome/DirectorySetupStep";
import { ImportSkillsStep } from "@/components/welcome/ImportSkillsStep";
import { useTranslation, Language } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";
import { AppConfig } from "@/types";

type WizardStep = "welcome" | "tools" | "directory" | "import";
type Theme = "light" | "dark" | "system";

interface WelcomeProps {
  onComplete: () => void;
}

export function Welcome({ onComplete }: WelcomeProps) {
  const { t, language, setLanguage } = useTranslation();
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
            ...config.preferences,
            language,
            theme,
          },
        };
        await invoke("save_config", { config: updatedConfig });
      } catch (error) {
        console.error("Failed to save preferences:", error);
      }
    }
    savePreferences();
  }, [language, theme]);

  function goNext() {
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      onComplete();
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
        onMouseDown={() => getCurrentWindow().startDragging()}
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
          Skills Manager
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

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}
