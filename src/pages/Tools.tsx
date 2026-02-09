import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Tool } from "@/types";
import { useTranslation } from "@/i18n";
import { getToolIconUrl, GenericToolIcon } from "@/assets/tools";
import { FolderOpen } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContainer, useToast } from "@/components/ui/toast";

export function Tools() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const detectTools = useCallback(async (options?: { manual?: boolean }) => {
    setError(null);
    try {
      const result = await invoke<Tool[]>("detect_tools");
      setTools(result);
      if (options?.manual) {
        addToast(t("common.refreshSuccess"), "success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [addToast, t]);

  const toggleToolEnabled = useCallback(async (toolId: string, enabled: boolean) => {
    // Optimistic update
    setTools(prev => prev.map(t =>
      t.id === toolId ? { ...t, config: { ...t.config, enabled } } : t
    ));
    setError(null);

    try {
      await invoke("set_tool_enabled", { toolId, enabled });
    } catch (err) {
      // Rollback on error
      setTools(prev => prev.map(t =>
        t.id === toolId ? { ...t, config: { ...t.config, enabled: !enabled } } : t
      ));
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleEditConfigPath = useCallback(async (toolId: string) => {
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
        });
        await detectTools();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [detectTools, t]);

  const handleEditSkillsPath = useCallback(async (toolId: string) => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("tools.selectSkillsPath"),
    });

    if (selected && typeof selected === "string") {
      try {
        await invoke("update_tool_paths", {
          toolId,
          skillsPath: selected,
        });
        await detectTools();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [detectTools, t]);

  useEffect(() => {
    detectTools();
  }, [detectTools]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      <PageHeader
        title={t("tools.title")}
        actions={<RefreshButton onClick={() => detectTools({ manual: true })} />}
      />

      {/* Content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: '1200px' }}>
          {/* Error */}
          {error && (
            <div className="mb-6">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Section: Detected Tools */}
          <section>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              {t("tools.detected")}
            </h2>

            {tools.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--muted-foreground)',
                backgroundColor: 'var(--secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                <p style={{ margin: '0 0 8px 0' }}>{t("tools.noTools")}</p>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  {t("tools.noToolsDesc")}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '16px',
              }}>
                {tools.map((tool) => {
                  const iconUrl = getToolIconUrl(tool.id);
                  return (
                    <div
                      key={tool.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '18px 20px',
                        backgroundColor: 'var(--secondary)',
                        borderRadius: '14px',
                        border: '1px solid var(--border)',
                        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ring)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Top: Icon + Title + Status + Toggle */}
                      <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', alignItems: 'flex-start' }}>
                        {/* Icon */}
                        {iconUrl ? (
                          <img
                            src={iconUrl}
                            alt={tool.name}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <GenericToolIcon />
                        )}

                        {/* Title + Status */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}>
                            <span style={{
                              fontSize: '15px',
                              fontWeight: 600,
                              color: 'var(--foreground)',
                              lineHeight: 1.3,
                            }}>
                              {tool.name}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: tool.detected ? 'var(--color-success-bg)' : 'var(--secondary)',
                              color: tool.detected ? 'var(--color-success)' : 'var(--muted-foreground)',
                              border: tool.detected ? '1px solid var(--color-success-border)' : '1px solid var(--border)',
                            }}>
                              {tool.detected ? t("tools.detectedStatus") : t("tools.notDetected")}
                            </span>
                            {tool.cli_available && (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 500,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--background)',
                                color: 'var(--muted-foreground)',
                                border: '1px solid var(--border)',
                              }}>
                                CLI
                              </span>
                            )}
                          </div>
                          <p style={{
                            fontSize: '13px',
                            color: 'var(--muted-foreground)',
                            margin: 0,
                            lineHeight: 1.5,
                          }}>
                            ID: {tool.id}
                          </p>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ marginTop: '2px' }}
                        >
                          <Toggle
                            checked={tool.config.enabled}
                            onChange={(enabled) => toggleToolEnabled(tool.id, enabled)}
                          />
                        </div>
                      </div>

                      {/* Bottom: Config Info */}
                      <div style={{
                        paddingTop: '14px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--muted-foreground)',
                            flexShrink: 0,
                            width: '80px',
                          }}>
                            {t("tools.configPath")}
                          </span>
                          <code style={{
                            flex: 1,
                            fontSize: '11px',
                            color: 'var(--foreground)',
                            backgroundColor: 'var(--background)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            wordBreak: 'break-all',
                          }}>
                            {tool.config.config_path || t("tools.notSet")}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditConfigPath(tool.id);
                            }}
                            title={t("tools.editPath")}
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
                              flexShrink: 0,
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
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--muted-foreground)',
                            flexShrink: 0,
                            width: '80px',
                          }}>
                            {t("tools.skillsPath")}
                          </span>
                          <code style={{
                            flex: 1,
                            fontSize: '11px',
                            color: 'var(--foreground)',
                            backgroundColor: 'var(--background)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            wordBreak: 'break-all',
                          }}>
                            {tool.config.skills_path || t("tools.notSet")}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSkillsPath(tool.id);
                            }}
                            title={t("tools.editPath")}
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
                              flexShrink: 0,
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
