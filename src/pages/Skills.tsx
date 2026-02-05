import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Switch } from "@/components/ui/switch";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { Skill, Tool, AppConfig } from "@/types";
import { useTranslation } from "@/i18n";

const toolAbbreviations: Record<string, string> = {
  "codex": "Codex",
};

function getToolDisplayName(toolId: string, tools: Tool[]): string {
  const tool = tools.find(t => t.id === toolId);
  if (tool) return tool.name;
  return toolAbbreviations[toolId] || toolId;
}

// Generate consistent colors based on skill name
function getSkillColor(name: string): { bg: string; icon: string } {
  const colors = [
    { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', icon: '#fff' },
    { bg: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', icon: '#fff' },
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function Skills() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<string | null>(null);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // Handle opening a skill in editor
  const handleOpenSkill = useCallback(async (skill: Skill) => {
    try {
      const editorId = config?.preferences?.default_editor || "builtin";

      if (editorId === "builtin") {
        // Open in built-in editor
        navigate(`/editor?root=${encodeURIComponent(skill.path)}`);
      } else {
        // Open in external editor
        await invoke("open_in_editor", { editorId, path: skill.path });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [config, navigate, addToast]);

  const fetchData = useCallback(async () => {
    try {
      const [skillsResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("refresh_skills"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setConfig(configResult);
      setTools(toolsResult);
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setInitialLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (skillId: string, skillName: string, toolId: string, enabled: boolean) => {
    const toggleKey = `${skillId}:${toolId}`;
    setTogglingSkill(toggleKey);
    try {
      if (enabled) {
        await invoke("enable_skill", { skillId, toolId });
        addToast(t("skills.enableSuccess").replace("{skill}", skillName).replace("{tool}", getToolDisplayName(toolId, tools)), "success");
      } else {
        await invoke("disable_skill", { skillId, toolId });
        addToast(t("skills.disableSuccess").replace("{skill}", skillName).replace("{tool}", getToolDisplayName(toolId, tools)), "success");
      }
      await fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setTogglingSkill(null);
    }
  };

  const handleDelete = async (skill: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm(t("skills.deleteConfirm").replace("{name}", skill.name), {
      title: t("skills.delete"),
      kind: "warning",
    });
    if (!confirmed) return;

    setDeletingSkill(skill.id);
    try {
      await invoke("delete_skill", { skillId: skill.id });
      addToast(t("skills.deleteSuccess").replace("{name}", skill.name), "success");
      await fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setDeletingSkill(null);
    }
  };

  const filteredSkills = skills.filter((skill) => {
    const query = searchQuery.toLowerCase();
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.id.toLowerCase().includes(query)
    );
  });

  const toolIds = config ? Object.keys(config.tools).sort() : [];

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
          {t("skills.title")}
        </h1>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            {t("common.refresh")}
          </button>

          <div style={{ position: 'relative' }}>
            <svg
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted-foreground)',
                pointerEvents: 'none',
              }}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              placeholder={t("skills.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '200px',
                padding: '8px 12px 8px 36px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ring)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9, 105, 218, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
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
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {t("skills.newSkill")}
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
          {/* Section: Installed */}
          <section>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              {t("skills.installed")} ({filteredSkills.length})
            </h2>

            {filteredSkills.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--muted-foreground)',
                backgroundColor: 'var(--secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                {searchQuery ? t("skills.noMatch") : t("skills.noSkills")}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}>
                {filteredSkills.map((skill) => {
                  const color = getSkillColor(skill.name);
                  return (
                    <div
                      key={skill.id}
                      onClick={() => handleOpenSkill(skill)}
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
                      {/* Top: Icon + Title + Description + Delete */}
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
                            <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
                          </svg>
                        </div>

                        {/* Title + Description */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: 'var(--foreground)',
                            marginBottom: '4px',
                            lineHeight: 1.3,
                          }}>
                            {skill.name}
                          </div>
                          <p style={{
                            fontSize: '13px',
                            color: 'var(--muted-foreground)',
                            margin: 0,
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {skill.description || t("skills.noDescription")}
                          </p>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDelete(skill, e)}
                          disabled={deletingSkill === skill.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: deletingSkill === skill.id ? 'wait' : 'pointer',
                            color: 'var(--muted-foreground)',
                            opacity: deletingSkill === skill.id ? 0.5 : 1,
                            transition: 'color 0.15s, background-color 0.15s',
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#dc2626';
                            e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--muted-foreground)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title={t("skills.delete")}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>

                      {/* Bottom: Tool Toggles */}
                      <div style={{
                        paddingTop: '14px',
                        borderTop: '1px solid var(--border)',
                      }}>
                        {editingSkill === skill.id ? (
                          /* Edit Mode: Show all toggles */
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              color: 'var(--muted-foreground)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              marginRight: '4px',
                            }}>
                              {t("skills.enableFor")}
                            </span>
                            {toolIds.map((toolId) => {
                              const isEnabled = skill.enabled[toolId] ?? false;
                              const toggleKey = `${skill.id}:${toolId}`;
                              const isToggling = togglingSkill === toggleKey;

                              return (
                                <label
                                  key={toolId}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: isToggling ? 'wait' : 'pointer',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    backgroundColor: isEnabled ? 'rgba(9, 105, 218, 0.12)' : 'var(--background)',
                                    border: isEnabled ? '1px solid rgba(9, 105, 218, 0.35)' : '1px solid var(--border)',
                                    transition: 'all 0.15s',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Switch
                                    checked={isEnabled}
                                    disabled={isToggling}
                                    onCheckedChange={(checked) =>
                                      handleToggle(skill.id, skill.name, toolId, checked)
                                    }
                                  />
                                  <span style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: isEnabled ? 'var(--primary)' : 'var(--muted-foreground)',
                                  }}>
                                    {getToolDisplayName(toolId, tools)}
                                  </span>
                                </label>
                              );
                            })}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSkill(null);
                              }}
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'var(--primary)',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '5px 8px',
                                marginLeft: 'auto',
                              }}
                            >
                              {t("common.done")}
                            </button>
                          </div>
                        ) : (
                          /* View Mode: Show compact badges */
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              color: 'var(--muted-foreground)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              flexShrink: 0,
                            }}>
                              {t("skills.enableFor")}
                            </span>
                            {(() => {
                              const enabledTools = toolIds.filter(id => skill.enabled[id]);
                              const enabledCount = enabledTools.length;
                              const totalCount = toolIds.length;

                              if (enabledCount === 0) {
                                return (
                                  <span style={{
                                    fontSize: '12px',
                                    color: 'var(--muted-foreground)',
                                    fontStyle: 'italic',
                                    flex: 1,
                                  }}>
                                    {t("skills.noToolsEnabled")}
                                  </span>
                                );
                              }

                              if (enabledCount === totalCount) {
                                return (
                                  <>
                                    <span style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      color: '#16a34a',
                                      backgroundColor: '#dcfce7',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid #bbf7d0',
                                    }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                      {t("skills.allEnabled")}
                                    </span>
                                    <div style={{ flex: 1 }} />
                                  </>
                                );
                              }

                              const maxShow = 2;
                              const showTools = enabledTools.slice(0, maxShow);
                              const remaining = enabledCount - maxShow;

                              return (
                                <>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                  }}>
                                    {showTools.map(toolId => (
                                      <span
                                        key={toolId}
                                        style={{
                                          fontSize: '12px',
                                          fontWeight: 500,
                                          color: 'var(--primary)',
                                          backgroundColor: 'rgba(9, 105, 218, 0.12)',
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          border: '1px solid rgba(9, 105, 218, 0.35)',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {getToolDisplayName(toolId, tools)}
                                      </span>
                                    ))}
                                  </div>
                                  {remaining > 0 && (
                                    <span style={{
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      color: 'var(--muted-foreground)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}>
                                      +{remaining}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSkill(skill.id);
                              }}
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'var(--muted-foreground)',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '5px 8px',
                                flexShrink: 0,
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                            >
                              {t("common.edit")}
                            </button>
                          </div>
                        )}
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
