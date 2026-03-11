import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/loading";
import { RelationToggleDialog } from "@/components/skills/RelationToggleDialog";
import {
  CREATE_SKILL_MODAL_WIDTH,
  MODAL_LAYER_Z_INDEX,
  MODAL_OVERLAY_COLOR,
} from "@/constants/modal";
import { AppConfig, Skill, Tool } from "@/types";
import { useTranslation, TranslationPath } from "@/i18n";
import { orderToolIdsForSkill } from "./skills/orderToolIds";
import { summarizeEnabledTools } from "./skills/summarizeEnabledTools";
import { getEnabledToolIds } from "./skills/getEnabledToolIds";
import {
  getSkillBulkToggleConfirmKey,
  getSkillBulkToggleMode,
  getSkillBulkToggleTargets,
} from "./skills/bulkToggleSkillTools";

function getToolDisplayName(toolId: string, tools: Tool[]): string {
  const tool = tools.find(t => t.id === toolId);
  if (tool) return tool.name;
  return toolId;
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
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<string | null>(null);
  const [toolEditorSkillId, setToolEditorSkillId] = useState<string | null>(null);
  const [toolEditorQuery, setToolEditorQuery] = useState("");
  const [toolEditorEnabledOnly, setToolEditorEnabledOnly] = useState(false);
  const [bulkTogglingSkillId, setBulkTogglingSkillId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // Initial load - uses cached data via list_skills
  const loadData = useCallback(async () => {
    try {
      const [skillsResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("list_skills"),
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

  // Manual refresh - forces rescan via refresh_skills
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [skillsResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("refresh_skills"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setConfig(configResult);
      setTools(toolsResult);
      addToast(t("common.refreshSuccess"), "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, t]);

  // Reload data after toggle/delete operations
  const reloadData = useCallback(async () => {
    try {
      const [skillsResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("list_skills"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setConfig(configResult);
      setTools(toolsResult);
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setTogglingSkill(null);
    }
  };

  const handleBulkToggle = useCallback(async (skill: Skill, visibleToolIds: string[]) => {
    const bulkMode = getSkillBulkToggleMode(visibleToolIds, skill.enabled, tools);
    const targetToolIds = getSkillBulkToggleTargets(visibleToolIds, skill.enabled, tools, bulkMode);
    if (targetToolIds.length === 0) {
      return;
    }

    const enabled = bulkMode === "enable";
    const confirmed = await confirm(
      t(getSkillBulkToggleConfirmKey(bulkMode)).replace("{count}", String(targetToolIds.length)),
      {
        title: t("skills.bulkConfirmTitle"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }

    setBulkTogglingSkillId(skill.id);

    // Optimistic update for quicker visual feedback in the dialog.
    setSkills((prevSkills) =>
      prevSkills.map((item) => {
        if (item.id !== skill.id) {
          return item;
        }

        const nextEnabled = { ...item.enabled };
        targetToolIds.forEach((toolId) => {
          nextEnabled[toolId] = enabled;
        });

        return { ...item, enabled: nextEnabled };
      }),
    );

    try {
      const command = enabled ? "enable_skill" : "disable_skill";
      const results = await Promise.allSettled(
        targetToolIds.map((toolId) => invoke(command, { skillId: skill.id, toolId })),
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;
      const changedCount = targetToolIds.length - failedCount;

      if (changedCount > 0) {
        const successMessage = enabled ? t("skills.bulkEnableSuccess") : t("skills.bulkDisableSuccess");
        addToast(successMessage.replace("{count}", String(changedCount)), "success");
      }

      if (failedCount > 0) {
        const failedMessage = t("skills.bulkTogglePartialFailed").replace("{count}", String(failedCount));
        addToast(failedMessage, "error");
      }

      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
      await reloadData();
    } finally {
      setBulkTogglingSkillId(null);
    }
  }, [addToast, reloadData, t, tools]);

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
      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setDeletingSkill(null);
    }
  };

  const handleCreateSkill = async (skillName: string, skillDescription: string) => {
    setCreating(true);
    try {
      const newSkill = await invoke<Skill>("create_skill", {
        name: skillName,
        description: skillDescription || null,
      });
      addToast(t("skills.createSuccess").replace("{name}", skillName), "success");
      setShowCreateDialog(false);

      // Navigate to editor
      const editorId = config?.preferences?.default_editor || "builtin";
      if (editorId === "builtin") {
        navigate(`/editor?root=${encodeURIComponent(newSkill.path)}`);
      } else {
        await invoke("open_in_editor", { editorId, path: newSkill.path });
        await reloadData();
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setCreating(false);
    }
  };

  const filteredSkills = skills.filter((skill) => {
    const query = searchQuery.toLowerCase();
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.id.toLowerCase().includes(query)
    );
  });

  const toolIds = useMemo(
    () => getEnabledToolIds(tools),
    [tools]
  );

  const toolEditorSkill = useMemo(
    () => skills.find((skill) => skill.id === toolEditorSkillId) ?? null,
    [skills, toolEditorSkillId],
  );

  const toolEditorOrderedToolIds = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return orderToolIdsForSkill(toolIds, toolEditorSkill.enabled);
  }, [toolEditorSkill, toolIds]);

  const toolEditorFilteredToolIds = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    const normalizedQuery = toolEditorQuery.trim().toLowerCase();
    return toolEditorOrderedToolIds.filter((toolId) => {
      if (toolEditorEnabledOnly && !toolEditorSkill.enabled[toolId]) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const displayName = getToolDisplayName(toolId, tools).toLowerCase();
      return displayName.includes(normalizedQuery) || toolId.toLowerCase().includes(normalizedQuery);
    });
  }, [toolEditorEnabledOnly, toolEditorOrderedToolIds, toolEditorQuery, toolEditorSkill, tools]);

  const toolEditorEnabledCount = useMemo(() => {
    if (!toolEditorSkill) {
      return 0;
    }
    return toolEditorOrderedToolIds.filter((toolId) => Boolean(toolEditorSkill.enabled[toolId])).length;
  }, [toolEditorOrderedToolIds, toolEditorSkill]);

  const toolEditorBulkToggleMode = useMemo(() => {
    if (!toolEditorSkill) {
      return "enable";
    }

    return getSkillBulkToggleMode(toolEditorFilteredToolIds, toolEditorSkill.enabled, tools);
  }, [toolEditorFilteredToolIds, toolEditorSkill, tools]);

  const toolEditorBulkToggleTargets = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return getSkillBulkToggleTargets(
      toolEditorFilteredToolIds,
      toolEditorSkill.enabled,
      tools,
      toolEditorBulkToggleMode,
    );
  }, [toolEditorFilteredToolIds, toolEditorSkill, tools, toolEditorBulkToggleMode]);

  const toolEditorIsBulkToggling = toolEditorSkill ? bulkTogglingSkillId === toolEditorSkill.id : false;
  const toolEditorHasPendingSingleToggle = toolEditorSkill
    ? Boolean(togglingSkill?.startsWith(`${toolEditorSkill.id}:`))
    : false;
  const toolEditorBulkToggleDisabled =
    toolEditorIsBulkToggling || toolEditorHasPendingSingleToggle || toolEditorBulkToggleTargets.length === 0;
  const toolEditorBulkToggleLabel = toolEditorIsBulkToggling
    ? t("skills.bulkUpdating")
    : toolEditorBulkToggleMode === "enable"
      ? t("skills.bulkEnable")
      : t("skills.bulkDisable");

  const toolEditorItems = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return toolEditorFilteredToolIds.map((toolId) => {
      const isEnabled = toolEditorSkill.enabled[toolId] ?? false;
      const toggleKey = `${toolEditorSkill.id}:${toolId}`;
      const isToggling = togglingSkill === toggleKey;
      const tool = tools.find((item) => item.id === toolId);
      const isDetected = tool?.detected ?? false;
      const isToolEnabled = tool?.config.enabled ?? false;
      const isDisabled = toolEditorIsBulkToggling || isToggling || !isDetected || !isToolEnabled;

      return {
        id: toolId,
        label: getToolDisplayName(toolId, tools),
        enabled: isEnabled,
        disabled: isDisabled,
        tooltip: !isDetected ? t("skills.toolNotDetected") : undefined,
        dimmed: !isDetected,
      };
    });
  }, [toolEditorFilteredToolIds, toolEditorIsBulkToggling, toolEditorSkill, togglingSkill, tools, t]);

  const openToolEditor = useCallback((skillId: string) => {
    setToolEditorSkillId(skillId);
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
  }, []);

  const closeToolEditor = useCallback(() => {
    setToolEditorSkillId(null);
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
  }, []);

  // Show loading state while initial data is being fetched
  if (initialLoading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--background)',
      }}>
        <PageHeader title={t("skills.title")} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          <PageLoader />
        </main>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: '24px 32px', color: 'var(--muted-foreground)' }}>
        <PageLoader message={t("loading.skills")} />
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
      <PageHeader
        title={t("skills.title")}
        actions={
          <>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />

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
              onClick={() => setShowCreateDialog(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              {t("skills.newSkill")}
            </button>
          </>
        }
      />

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
                  const orderedToolIds = orderToolIdsForSkill(toolIds, skill.enabled);
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
                            e.currentTarget.style.color = 'var(--color-error)';
                            e.currentTarget.style.backgroundColor = 'var(--color-error-bg)';
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

                      {/* Bottom: Tool Summary */}
                      <div style={{
                        paddingTop: '14px',
                        borderTop: '1px solid var(--border)',
                      }}>
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
                            const toolSummary = summarizeEnabledTools(orderedToolIds, skill.enabled, 2);

                            if (toolSummary.state === "none") {
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

                            if (toolSummary.state === "all") {
                              return (
                                <>
                                  <span style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: 'var(--color-success)',
                                    backgroundColor: 'var(--color-success-bg)',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--color-success-border)',
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
                                  {toolSummary.visibleEnabledToolIds.map(toolId => (
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
                                {toolSummary.remainingCount > 0 && (
                                  <span style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: 'var(--muted-foreground)',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}>
                                    +{toolSummary.remainingCount}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openToolEditor(skill.id);
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

      {toolEditorSkill && (
        <RelationToggleDialog
          title={t("skills.configureToolsTitle")}
          description={t("skills.configureToolsDesc")
            .replace("{skill}", toolEditorSkill.name)
            .replace("{enabled}", String(toolEditorEnabledCount))
            .replace("{total}", String(toolEditorOrderedToolIds.length))}
          query={toolEditorQuery}
          enabledOnly={toolEditorEnabledOnly}
          searchPlaceholder={t("skills.searchToolsPlaceholder")}
          enabledOnlyLabel={t("skills.enabledOnly")}
          bulkToggleLabel={toolEditorBulkToggleLabel}
          bulkToggleDisabled={toolEditorBulkToggleDisabled}
          bulkToggleTitle={toolEditorBulkToggleTargets.length === 0 ? t("skills.bulkNoTarget") : undefined}
          items={toolEditorItems}
          emptyLabel={t("skills.noToolsInFilter")}
          doneLabel={t("common.done")}
          onQueryChange={setToolEditorQuery}
          onEnabledOnlyChange={setToolEditorEnabledOnly}
          onToggle={(toolId, enabled) => handleToggle(toolEditorSkill.id, toolEditorSkill.name, toolId, enabled)}
          onBulkToggle={() => handleBulkToggle(toolEditorSkill, toolEditorFilteredToolIds)}
          onClose={closeToolEditor}
        />
      )}

      {showCreateDialog && (
        <CreateSkillDialog
          creating={creating}
          existingIds={skills.map(s => s.id)}
          onCancel={() => setShowCreateDialog(false)}
          onCreate={handleCreateSkill}
          t={t}
        />
      )}
    </div>
  );
}

function CreateSkillDialog({
  creating,
  existingIds,
  onCancel,
  onCreate,
  t,
}: {
  creating: boolean;
  existingIds: string[];
  onCancel: () => void;
  onCreate: (name: string, description: string) => void;
  t: (key: TranslationPath) => string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const toId = (n: string): string =>
    n.trim().toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9_-]/g, "");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("skills.nameRequired"));
      return;
    }
    const id = toId(trimmed);
    if (existingIds.includes(id)) {
      setError(t("skills.nameConflict").replace("{name}", trimmed));
      return;
    }
    onCreate(trimmed, description.trim());
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: MODAL_OVERLAY_COLOR,
        zIndex: MODAL_LAYER_Z_INDEX,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: CREATE_SKILL_MODAL_WIDTH,
          backgroundColor: "var(--background)",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px 0" }}>
          {t("skills.createSkill")}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--muted-foreground)", margin: "0 0 20px 0" }}>
          {t("skills.createSkillDesc")}
        </p>

        {/* Name */}
        <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--foreground)", marginBottom: "6px" }}>
          {t("skills.skillName")}
        </label>
        <input
          autoFocus
          type="text"
          placeholder={t("skills.skillNamePlaceholder")}
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !creating) handleSubmit(); }}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "13px",
            border: error ? "1px solid var(--color-error)" : "1px solid var(--border)",
            borderRadius: "8px",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: error ? "4px" : "16px",
          }}
        />
        {error && (
          <p style={{ fontSize: "12px", color: "var(--color-error)", margin: "0 0 12px 0" }}>{error}</p>
        )}

        {/* Description */}
        <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--foreground)", marginBottom: "6px" }}>
          {t("skills.skillDescription")}
        </label>
        <textarea
          placeholder={t("skills.skillDescPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey && !creating) handleSubmit(); }}
          rows={3}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "13px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "24px",
            resize: "vertical",
            maxHeight: "120px",
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onCancel}
            disabled={creating}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--primary-foreground)",
              backgroundColor: "var(--foreground)",
              border: "none",
              borderRadius: "8px",
              cursor: creating ? "wait" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? t("skills.creating") : t("skills.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
