import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tool } from "@/types";

// Generate consistent colors based on tool name
function getToolColor(name: string): { bg: string; icon: string } {
  const colors = [
    { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '#fff' },
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Tool[]>("detect_tools");
      setTools(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    detectTools();
  }, [detectTools]);

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
        {/* Left: Title */}
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--foreground)',
          margin: 0,
        }}>
          Tools
        </h1>

        {/* Right: Actions */}
        <button
          onClick={detectTools}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 400,
            color: 'var(--muted-foreground)',
            background: 'transparent',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>
          </svg>
          Refresh
        </button>
      </header>

      {/* Content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: '1200px' }}>
          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              marginBottom: '24px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#dc2626',
              fontSize: '14px',
            }}>
              {error}
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
              Detected
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
                <p style={{ margin: '0 0 8px 0' }}>未检测到任何工具</p>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  请确保已安装支持的 AI 编程工具（如 Claude Code、Codex 等）
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '16px',
              }}>
                {tools.map((tool) => {
                  const color = getToolColor(tool.name);
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
                      {/* Top: Icon + Title + Status */}
                      <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
                        {/* Icon */}
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: color.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.icon} strokeWidth="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                          </svg>
                        </div>

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
                              backgroundColor: tool.detected ? '#dcfce7' : 'var(--secondary)',
                              color: tool.detected ? '#16a34a' : 'var(--muted-foreground)',
                              border: tool.detected ? '1px solid #bbf7d0' : '1px solid var(--border)',
                            }}>
                              {tool.detected ? "已检测" : "未检测到"}
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
                      </div>

                      {/* Bottom: Config Info */}
                      <div style={{
                        paddingTop: '14px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--muted-foreground)',
                            flexShrink: 0,
                            width: '70px',
                          }}>
                            配置路径
                          </span>
                          <code style={{
                            fontSize: '11px',
                            color: 'var(--foreground)',
                            backgroundColor: 'var(--background)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            wordBreak: 'break-all',
                          }}>
                            {tool.config.config_path || "未设置"}
                          </code>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--muted-foreground)',
                            flexShrink: 0,
                            width: '70px',
                          }}>
                            Skills 路径
                          </span>
                          <code style={{
                            fontSize: '11px',
                            color: 'var(--foreground)',
                            backgroundColor: 'var(--background)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            wordBreak: 'break-all',
                          }}>
                            {tool.config.skills_path || "未设置"}
                          </code>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--muted-foreground)',
                            flexShrink: 0,
                            width: '70px',
                          }}>
                            启用状态
                          </span>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: tool.config.enabled ? '#16a34a' : 'var(--muted-foreground)',
                          }}>
                            {tool.config.enabled ? "已启用" : "未启用"}
                          </span>
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
    </div>
  );
}
