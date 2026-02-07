import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { Package, CheckCircle2, Loader2, Check } from "lucide-react";

interface Skill {
  id: string;
  name: string;
  description: string;
  path: string;
}

interface ImportSkillsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ImportSkillsStep({ onNext, onBack }: ImportSkillsStepProps) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  useEffect(() => {
    scanSkills();
  }, []);

  async function scanSkills() {
    setIsScanning(true);
    try {
      const result = await invoke<Skill[]>("scan_existing_skills");
      // Filter out hidden directories (starting with .)
      const filteredSkills = result.filter((s) => !s.name.startsWith('.'));
      setSkills(filteredSkills);
      setSelectedSkills(new Set(filteredSkills.map((s) => s.path)));
    } catch (error) {
      console.error("Failed to scan skills:", error);
    } finally {
      setIsScanning(false);
    }
  }

  function toggleSkill(path: string) {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedSkills(newSelected);
  }

  async function handleImport(): Promise<boolean> {
    if (selectedSkills.size === 0) {
      return true;
    }

    setIsImporting(true);
    try {
      await invoke("import_skills_to_hub", {
        skillPaths: Array.from(selectedSkills),
      });
      setImportComplete(true);
      return true;
    } catch (error) {
      console.error("Failed to import skills:", error);
      alert("Failed to import skills: " + String(error));
      return false;
    } finally {
      setIsImporting(false);
    }
  }

  async function handleNext() {
    if (!importComplete && selectedSkills.size > 0) {
      const success = await handleImport();
      if (!success) {
        return;
      }
    }
    onNext();
  }

  return (
    <div>
      {/* Header - no icon, just text */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px 0' }}>
          {t("welcome.importSkills")}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', margin: 0 }}>
          {t("welcome.importSkillsDesc")}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginBottom: '24px' }}>
        {isScanning ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Loader2 style={{ width: '32px', height: '32px', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', marginTop: '12px' }}>{t("welcome.scanning")}</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : skills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: 'var(--secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Package style={{ width: '28px', height: '28px', color: 'var(--muted-foreground)', opacity: 0.5 }} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--foreground)', marginBottom: '4px' }}>{t("welcome.noSkillsFound")}</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>{t("welcome.canAddLater")}</p>
          </div>
        ) : importComplete ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 style={{ width: '28px', height: '28px', color: '#fff' }} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--foreground)', marginBottom: '4px' }}>{t("welcome.importComplete")}</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
              {t("welcome.importedCount").replace("{count}", String(selectedSkills.size))}
            </p>
          </div>
        ) : (
          <>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
              {skills.map((skill) => {
                const isSelected = selectedSkills.has(skill.path);
                return (
                  <button
                    key={skill.path}
                    onClick={() => toggleSkill(skill.path)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      marginBottom: '8px',
                      borderRadius: '10px',
                      border: isSelected ? '1px solid rgba(9, 105, 218, 0.3)' : '1px solid transparent',
                      backgroundColor: isSelected ? 'rgba(9, 105, 218, 0.08)' : 'var(--secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: isSelected ? 'none' : '2px solid var(--border)',
                        backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check style={{ width: '12px', height: '12px', color: '#fff' }} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: isSelected ? 500 : 400, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {skill.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {skill.path}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'center' }}>
              {t("welcome.selectedCount").replace("{selected}", String(selectedSkills.size)).replace("{total}", String(skills.length))}
            </p>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          disabled={isImporting}
          style={{
            flex: 1,
            height: '44px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--foreground)',
            backgroundColor: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            cursor: isImporting ? 'not-allowed' : 'pointer',
            opacity: isImporting ? 0.5 : 1,
          }}
        >
          {t("welcome.previous")}
        </button>
        <button
          onClick={handleNext}
          disabled={isScanning || isImporting}
          style={{
            flex: 1,
            height: '44px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--primary-foreground)',
            backgroundColor: 'var(--primary)',
            border: 'none',
            borderRadius: '10px',
            cursor: isScanning || isImporting ? 'not-allowed' : 'pointer',
            opacity: isScanning || isImporting ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isImporting ? (
            <>
              <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              {t("welcome.importing")}
            </>
          ) : skills.length === 0 || importComplete ? (
            t("welcome.completeSetup")
          ) : (
            t("welcome.importAndComplete")
          )}
        </button>
      </div>
    </div>
  );
}
