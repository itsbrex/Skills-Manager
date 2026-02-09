import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "@/i18n";
import { CheckCircle2, Circle, Loader2, RotateCw, FolderOpen } from "lucide-react";

interface Tool {
  id: string;
  name: string;
  detected: boolean;
  cli_available: boolean;
  source?: "builtin" | "custom";
}

interface ToolDetectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ToolDetectionStep({ onNext, onBack }: ToolDetectionStepProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    detectTools();
  }, []);

  async function detectTools() {
    setIsLoading(true);
    try {
      const result = await invoke<Tool[]>("detect_tools");
      setTools(result.filter((tool) => tool.source !== "custom"));
    } catch (error) {
      console.error("Failed to detect tools:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCustomizePath(toolId: string) {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("tools.selectConfigPath"),
    });

    if (selected && typeof selected === "string") {
      try {
        await invoke("update_tool_paths", {
          toolId,
          configPath: selected,
          skillsPath: `${selected}/skills`,
        });
        await detectTools();
      } catch (error) {
        console.error("Failed to update tool paths:", error);
      }
    }
  }

  const detectedCount = tools.filter((t) => t.detected).length;

  return (
    <div>
      {/* Header - no icon, just text */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px 0' }}>
          {t("welcome.detectTools")}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', margin: 0 }}>
          {t("welcome.detectToolsDesc")}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginBottom: '24px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Loader2 style={{ width: '32px', height: '32px', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', marginTop: '12px' }}>{t("welcome.detecting")}</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: tool.detected ? 'rgba(9, 105, 218, 0.08)' : 'var(--secondary)',
                    border: tool.detected ? '1px solid rgba(9, 105, 218, 0.2)' : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {tool.detected ? (
                      <CheckCircle2 style={{ width: '18px', height: '18px', color: 'var(--primary)', flexShrink: 0 }} />
                    ) : (
                      <Circle style={{ width: '18px', height: '18px', color: 'var(--muted-foreground)', opacity: 0.4, flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: tool.detected ? 500 : 400,
                      color: tool.detected ? 'var(--foreground)' : 'var(--muted-foreground)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {tool.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => handleCustomizePath(tool.id)}
                      title={t("welcome.customizePath")}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--muted)';
                        e.currentTarget.style.color = 'var(--foreground)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--muted-foreground)';
                      }}
                    >
                      <FolderOpen style={{ width: '14px', height: '14px' }} />
                    </button>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: tool.detected ? 'var(--primary)' : 'var(--muted)',
                        color: tool.detected ? '#fff' : 'var(--muted-foreground)',
                        flexShrink: 0,
                      }}
                    >
                      {tool.detected ? t("welcome.detected") : t("welcome.notInstalled")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0 }}>
                {detectedCount > 0
                  ? t("welcome.detectedCount").replace("{count}", String(detectedCount))
                  : t("welcome.noToolsDetected")}
              </p>
              <button
                onClick={detectTools}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RotateCw style={{ width: '12px', height: '12px' }} />
                {t("welcome.redetect")}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            height: '44px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--foreground)',
            backgroundColor: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          {t("welcome.previous")}
        </button>
        <button
          onClick={onNext}
          disabled={isLoading}
          style={{
            flex: 1,
            height: '44px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--primary-foreground)',
            backgroundColor: 'var(--primary)',
            border: 'none',
            borderRadius: '10px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          {t("welcome.next")}
        </button>
      </div>
    </div>
  );
}
