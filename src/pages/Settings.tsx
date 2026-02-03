import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { AppConfig } from "@/types";

// Tool name display mapping
const toolDisplayNames: Record<string, string> = {
  "claude-code": "Claude Code",
  "codex": "Codex",
  "codebuddy": "CodeBuddy",
};

function getToolDisplayName(toolId: string): string {
  return toolDisplayNames[toolId] || toolId;
}

// Generate consistent colors based on tool name
function getToolColor(name: string): { bg: string } {
  const colors = [
    { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configResult = await invoke<AppConfig>("get_config");
      setConfig(configResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择公共 Skills 目录",
      });
      if (selected && config) {
        setConfig({
          ...config,
          skills_dir: selected as string,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await invoke("save_config", { config });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted-foreground)',
      }}>
        <svg
          style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Loading...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          color: '#dc2626',
          fontSize: '14px',
        }}>
          {error}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: '24px 32px', color: 'var(--muted-foreground)' }}>
        无法加载配置
      </div>
    );
  }

  const toolIds = Object.keys(config.tools);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      {/* Top Bar with Title */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--background)',
        flexShrink: 0,
      }}>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--foreground)',
          margin: 0,
        }}>
          Settings
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saveSuccess && (
            <span style={{
              fontSize: '13px',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              已保存
            </span>
          )}
          {saveError && (
            <span style={{ fontSize: '13px', color: '#dc2626' }}>
              {saveError}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--primary-foreground)',
              backgroundColor: 'var(--foreground)',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => !saving && (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => !saving && (e.currentTarget.style.opacity = '1')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: '800px' }}>
          {/* Section: Skills Directory */}
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              Skills Directory
            </h2>
            <div style={{
              padding: '20px 24px',
              backgroundColor: 'var(--secondary)',
              borderRadius: '14px',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: '16px',
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    margin: '0 0 4px 0',
                  }}>
                    公共 Skills 目录
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: 'var(--muted-foreground)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}>
                    所有 Skills 的存储位置，各工具将通过符号链接引用此目录中的 Skills
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="text"
                  value={config.skills_dir}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '13px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handleSelectDirectory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--ring)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  选择目录
                </button>
              </div>
            </div>
          </section>

          {/* Section: Tool Configurations */}
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              Tool Configurations
            </h2>
            {toolIds.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--muted-foreground)',
                backgroundColor: 'var(--secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                暂无已配置的工具
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                {toolIds.map((toolId) => {
                  const toolConfig = config.tools[toolId];
                  const color = getToolColor(toolId);
                  return (
                    <div
                      key={toolId}
                      style={{
                        padding: '18px 20px',
                        backgroundColor: 'var(--secondary)',
                        borderRadius: '14px',
                        border: '1px solid var(--border)',
                        transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--ring)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ display: 'flex', gap: '14px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: color.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: 'var(--foreground)',
                            margin: '0 0 12px 0',
                          }}>
                            {getToolDisplayName(toolId)}
                          </h4>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '90px 1fr',
                            gap: '8px 12px',
                            fontSize: '13px',
                          }}>
                            <span style={{ color: 'var(--muted-foreground)' }}>Skills 路径</span>
                            <code style={{
                              fontSize: '11px',
                              color: 'var(--foreground)',
                              backgroundColor: 'var(--background)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              wordBreak: 'break-all',
                            }}>
                              {toolConfig.skills_path || "-"}
                            </code>
                            <span style={{ color: 'var(--muted-foreground)' }}>配置路径</span>
                            <code style={{
                              fontSize: '11px',
                              color: 'var(--foreground)',
                              backgroundColor: 'var(--background)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              wordBreak: 'break-all',
                            }}>
                              {toolConfig.config_path || "-"}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section: About */}
          <section>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              About
            </h2>
            <div style={{
              padding: '20px 24px',
              backgroundColor: 'var(--secondary)',
              borderRadius: '14px',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    margin: '0 0 4px 0',
                  }}>
                    Skills Manager
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: 'var(--muted-foreground)',
                    margin: '0 0 8px 0',
                  }}>
                    统一管理多 AI 工具的 Skills
                  </p>
                  <span style={{
                    fontSize: '12px',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--background)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                  }}>
                    v{config.version}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
