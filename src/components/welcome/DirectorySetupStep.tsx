import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "@/i18n";
import { Folder } from "lucide-react";

interface AppConfig {
  version: string;
  skills_dir: string;
  tools: Record<string, unknown>;
}

interface DirectorySetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function DirectorySetupStep({ onNext, onBack }: DirectorySetupStepProps) {
  const { t } = useTranslation();
  const [skillsDir, setSkillsDir] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await invoke<AppConfig>("get_config");
      setSkillsDir(config.skills_dir);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  async function selectDirectory() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("welcome.skillsDirectory"),
      });
      if (selected && typeof selected === "string") {
        setSkillsDir(selected);
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
    }
  }

  async function handleNext() {
    setIsSaving(true);
    try {
      const config = await invoke<AppConfig>("get_config");
      await invoke("save_config", { config: { ...config, skills_dir: skillsDir } });
      onNext();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      {/* Header - no icon, just text */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px 0' }}>
          {t("welcome.setDirectory")}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', margin: 0 }}>
          {t("welcome.setDirectoryDesc")}
        </p>
      </div>

      {/* Directory selector */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={selectDirectory}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            borderRadius: '10px',
            border: '2px dashed var(--border)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.15s, background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.backgroundColor = 'rgba(9, 105, 218, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Folder style={{ width: '20px', height: '20px', color: 'var(--muted-foreground)' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {skillsDir ? (
              <>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {skillsDir.split('/').pop()}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {skillsDir}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>{t("welcome.clickToSelect")}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', opacity: 0.6 }}>{t("welcome.orUseDefault")}</div>
              </>
            )}
          </div>
        </button>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '8px', textAlign: 'center' }}>
          {t("welcome.defaultPath")}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          disabled={isSaving}
          style={{
            flex: 1,
            height: '44px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--foreground)',
            backgroundColor: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.5 : 1,
          }}
        >
          {t("welcome.previous")}
        </button>
        <button
          onClick={handleNext}
          disabled={!skillsDir || isSaving}
          style={{
            flex: 1,
            height: '44px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--primary-foreground)',
            backgroundColor: 'var(--primary)',
            border: 'none',
            borderRadius: '10px',
            cursor: !skillsDir || isSaving ? 'not-allowed' : 'pointer',
            opacity: !skillsDir || isSaving ? 0.5 : 1,
          }}
        >
          {isSaving ? t("common.saving") : t("welcome.next")}
        </button>
      </div>
    </div>
  );
}
