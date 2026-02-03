import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SyncReport, LinkReport, SyncStatus, LinkStatus } from "@/types";

// Tool name mappings
const toolNames: Record<string, string> = {
  "claude-code": "Claude Code",
  "codex": "Codex",
  "codebuddy": "CodeBuddy",
};

function getToolName(toolId: string): string {
  return toolNames[toolId] || toolId;
}

// Status badge configuration
function getStatusStyle(status: LinkStatus): { bg: string; color: string; label: string } {
  switch (status) {
    case "valid":
      return { bg: '#dcfce7', color: '#16a34a', label: '正常' };
    case "broken":
      return { bg: '#fef2f2', color: '#dc2626', label: '损坏' };
    case "wrongtarget":
      return { bg: '#fef2f2', color: '#dc2626', label: '目标错误' };
    case "notalink":
      return { bg: 'var(--secondary)', color: 'var(--muted-foreground)', label: '非链接' };
    case "missing":
      return { bg: 'var(--background)', color: 'var(--muted-foreground)', label: '未启用' };
    default:
      return { bg: 'var(--secondary)', color: 'var(--muted-foreground)', label: status };
  }
}

// Group statuses by skill_id
function groupBySkill(statuses: SyncStatus[]): Record<string, SyncStatus[]> {
  return statuses.reduce((acc, status) => {
    if (!acc[status.skill_id]) {
      acc[status.skill_id] = [];
    }
    acc[status.skill_id].push(status);
    return acc;
  }, {} as Record<string, SyncStatus[]>);
}

// Generate consistent colors based on skill name
function getSkillColor(name: string): { bg: string } {
  const colors = [
    { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
    { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
    { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function Sync() {
  const [report, setReport] = useState<SyncReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<LinkReport | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFixResult(null);
    try {
      const result = await invoke<SyncReport>("check_sync_status");
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFix = async () => {
    setFixing(true);
    setError(null);
    try {
      const result = await invoke<LinkReport>("fix_sync_issues");
      setFixResult(result);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFixing(false);
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

  const totalLinks = report?.statuses.length ?? 0;
  const validCount = report?.statuses.filter((s) => s.status === "valid").length ?? 0;
  const issuesCount = report?.issues_count ?? 0;
  const groupedStatuses = report ? groupBySkill(report.statuses) : {};
  const skillIds = Object.keys(groupedStatuses).sort();

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
          Sync Status
        </h1>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {issuesCount > 0 && (
            <button
              onClick={handleFix}
              disabled={fixing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: '#dc2626',
                border: 'none',
                borderRadius: '8px',
                cursor: fixing ? 'wait' : 'pointer',
                opacity: fixing ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => !fixing && (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => !fixing && (e.currentTarget.style.opacity = '1')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              {fixing ? "修复中..." : "一键修复"}
            </button>
          )}
          <button
            onClick={fetchData}
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
        </div>
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

          {/* Fix Result */}
          {fixResult && (
            <div style={{
              padding: '16px 20px',
              marginBottom: '24px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#16a34a' }}>
                修复完成
              </span>
              <span style={{ fontSize: '14px', color: '#16a34a' }}>
                成功: {fixResult.success.length}
              </span>
              <span style={{ fontSize: '14px', color: fixResult.failed.length > 0 ? '#dc2626' : 'var(--muted-foreground)' }}>
                失败: {fixResult.failed.length}
              </span>
            </div>
          )}

          {/* Overview Statistics */}
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              Overview
            </h2>
            <div style={{
              display: 'flex',
              gap: '16px',
            }}>
              <div style={{
                flex: 1,
                padding: '20px 24px',
                backgroundColor: 'var(--secondary)',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: 'var(--foreground)',
                  lineHeight: 1.2,
                }}>
                  {totalLinks}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--muted-foreground)',
                  marginTop: '4px',
                }}>
                  总链接数
                </div>
              </div>
              <div style={{
                flex: 1,
                padding: '20px 24px',
                backgroundColor: '#f0fdf4',
                borderRadius: '14px',
                border: '1px solid #bbf7d0',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#16a34a',
                  lineHeight: 1.2,
                }}>
                  {validCount}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#16a34a',
                  marginTop: '4px',
                }}>
                  正常
                </div>
              </div>
              <div style={{
                flex: 1,
                padding: '20px 24px',
                backgroundColor: issuesCount > 0 ? '#fef2f2' : 'var(--secondary)',
                borderRadius: '14px',
                border: issuesCount > 0 ? '1px solid #fecaca' : '1px solid var(--border)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: issuesCount > 0 ? '#dc2626' : 'var(--foreground)',
                  lineHeight: 1.2,
                }}>
                  {issuesCount}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: issuesCount > 0 ? '#dc2626' : 'var(--muted-foreground)',
                  marginTop: '4px',
                }}>
                  问题数
                </div>
              </div>
            </div>
          </section>

          {/* Per-skill status */}
          <section>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              Skills
            </h2>

            {skillIds.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--muted-foreground)',
                backgroundColor: 'var(--secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                暂无同步数据
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}>
                {skillIds.map((skillId) => {
                  const color = getSkillColor(skillId);
                  return (
                    <div
                      key={skillId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '18px 20px',
                        backgroundColor: 'var(--secondary)',
                        borderRadius: '14px',
                        border: '1px solid var(--border)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ring)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Top: Icon + Title */}
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: color.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                            <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
                          </svg>
                        </div>
                        <div style={{
                          flex: 1,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          display: 'flex',
                          alignItems: 'center',
                        }}>
                          {skillId}
                        </div>
                      </div>

                      {/* Bottom: Tool Status */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '14px',
                        borderTop: '1px solid var(--border)',
                      }}>
                        {groupedStatuses[skillId].map((status) => {
                          const style = getStatusStyle(status.status);
                          return (
                            <div
                              key={status.tool_id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                borderRadius: '8px',
                                backgroundColor: style.bg,
                                border: status.status === 'valid' ? '1px solid #bbf7d0' : '1px solid var(--border)',
                              }}
                            >
                              <span style={{
                                fontSize: '12px',
                                color: 'var(--muted-foreground)',
                              }}>
                                {getToolName(status.tool_id)}
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: style.color,
                              }}>
                                {style.label}
                              </span>
                            </div>
                          );
                        })}
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
