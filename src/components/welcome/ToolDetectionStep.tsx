import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { CheckCircle2, Circle, Loader2, RotateCw } from "lucide-react";

interface Tool {
  id: string;
  name: string;
  detected: boolean;
  cli_available: boolean;
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
      setTools(result);
    } catch (error) {
      console.error("Failed to detect tools:", error);
    } finally {
      setIsLoading(false);
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
            <div style={{ marginBottom: '16px' }}>
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    marginBottom: '8px',
                    borderRadius: '10px',
                    backgroundColor: tool.detected ? 'rgba(9, 105, 218, 0.08)' : 'var(--secondary)',
                    border: tool.detected ? '1px solid rgba(9, 105, 218, 0.2)' : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {tool.detected ? (
                      <CheckCircle2 style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
                    ) : (
                      <Circle style={{ width: '20px', height: '20px', color: 'var(--muted-foreground)', opacity: 0.4 }} />
                    )}
                    <span style={{ fontSize: '14px', fontWeight: tool.detected ? 500 : 400, color: tool.detected ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                      {tool.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: tool.detected ? 'var(--primary)' : 'var(--muted)',
                      color: tool.detected ? '#fff' : 'var(--muted-foreground)',
                    }}
                  >
                    {tool.detected ? t("welcome.detected") : t("welcome.notInstalled")}
                  </span>
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
