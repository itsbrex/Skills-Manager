import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/loading";
import { Toggle } from "@/components/ui/toggle";
import {
  CREATE_SKILL_MODAL_WIDTH,
  MODAL_LAYER_Z_INDEX,
  MODAL_OVERLAY_COLOR,
} from "@/constants/modal";
import { AppConfig, InstalledSkillPackage, Skill, Tool } from "@/types";
import { useTranslation, TranslationPath } from "@/i18n";
import {
  applyTagFilterAction,
  buildAllTagSummaries,
  getGroupMetadataKey,
  getGroupTags,
  getTagFilterSelectionSummary,
  getSkillTags,
  hasSelectableTagFilters,
  normalizeSkillTags,
  updateMetadataTags,
} from "./skills/skillTags";
import { orderToolIdsForSkill } from "./skills/orderToolIds";
import { getEnabledToolIds } from "./skills/getEnabledToolIds";
import {
  getSkillBulkToggleConfirmKey,
  getSkillBulkToggleMode,
  getSkillBulkToggleTargets,
} from "./skills/bulkToggleSkillTools";
import {
  buildUnifiedSkillItems,
  filterUnifiedSkillItems,
  getGroupBulkModeState,
  getGroupMemberSkills,
  getGroupToolLabel,
  getGroupToolVisualState,
  removeGroupSkillMetadataEntries,
  shouldShowGroupToolInEnabledOnly,
  type UnifiedSkillListItem,
  sortUnifiedSkillItems,
} from "./skills/buildUnifiedSkillItems";
import {
  saveSkillsListScrollOffset,
  takeSkillsListScrollOffset,
} from "./skills/skillsListScrollState";

function getToolDisplayName(toolId: string, tools: Tool[]): string {
  const tool = tools.find((t) => t.id === toolId);
  if (tool) return tool.name;
  return toolId;
}

function getSkillColor(name: string): { bg: string; icon: string } {
  const colors = [
    { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", icon: "#fff" },
    { bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", icon: "#fff" },
    { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", icon: "#fff" },
    { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", icon: "#fff" },
    { bg: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", icon: "#fff" },
    { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", icon: "#fff" },
    { bg: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", icon: "#fff" },
    { bg: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)", icon: "#fff" },
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

function buildTagFilterMenuItemStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 500,
    color: active ? "var(--primary)" : "var(--foreground)",
    backgroundColor: active ? "rgba(9, 105, 218, 0.08)" : "var(--background)",
    border: active ? "1px solid rgba(9, 105, 218, 0.28)" : "1px solid var(--border)",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
  };
}

type SkillEditorTab = "tools" | "tags";

type SkillCardActionMenuProps = {
  deleting: boolean;
  editLabel: string;
  deleteLabel: string;
  moreActionsLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};

function renderPreviewChips(chips: string[], overflowCount: number) {
  if (chips.length === 0 && overflowCount === 0) {
    return null;
  }

  return (
    <>
      {chips.map((chip) => (
        <span
          key={chip}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            fontWeight: 500,
            color: "rgba(17, 24, 39, 0.68)",
            backgroundColor: "rgba(9, 105, 218, 0.04)",
            border: "1px solid rgba(9, 105, 218, 0.14)",
            borderRadius: "999px",
            padding: "3px 8px",
            lineHeight: 1.2,
          }}
        >
          {chip}
        </span>
      ))}
      {overflowCount > 0 && (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--muted-foreground)",
            padding: "3px 0",
          }}
        >
          +{overflowCount}
        </span>
      )}
    </>
  );
}

function getUnifiedItemMetaLabel(item: UnifiedSkillListItem, t: (key: TranslationPath) => string) {
  if (item.kind === "group") {
    return t("skills.groupMembersCount").replace("{count}", String(item.memberCount ?? 0));
  }

  const summary = item.toolSummary;
  if (!summary || summary.state === "none") {
    return t("skills.noToolsEnabled");
  }

  if (summary.state === "all") {
    return t("skills.allEnabled");
  }

  return `${t("skills.enableFor")} ${summary.enabledCount}/${summary.totalCount}`;
}

function SkillCardActionMenu({
  deleting,
  editLabel,
  deleteLabel,
  moreActionsLabel,
  onEdit,
  onDelete,
}: SkillCardActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label={moreActionsLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((current) => !current);
        }}
        disabled={deleting}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "30px",
          height: "30px",
          padding: 0,
          borderRadius: "8px",
          border: "none",
          backgroundColor: "transparent",
          color: "var(--muted-foreground)",
          cursor: deleting ? "wait" : "pointer",
          opacity: deleting ? 0.6 : 1,
          transition: "color 0.15s ease, background-color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--foreground)";
          e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--muted-foreground)";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={moreActionsLabel}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "default",
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              minWidth: "132px",
              padding: "4px",
              backgroundColor: "rgba(255, 255, 255, 0.96)",
              border: "1px solid rgba(15, 23, 42, 0.06)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
              backdropFilter: "blur(10px)",
              zIndex: MODAL_LAYER_Z_INDEX,
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground)",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                textAlign: "left",
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {editLabel}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              disabled={deleting}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#dc2626",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: deleting ? "wait" : "pointer",
                textAlign: "left",
                opacity: deleting ? 0.6 : 1,
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.08)";
                e.currentTarget.style.color = "#b91c1c";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#dc2626";
              }}
            >
              {deleteLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Skills() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillPackages, setSkillPackages] = useState<InstalledSkillPackage[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<string | null>(null);
  const [toolEditorSkillId, setToolEditorSkillId] = useState<string | null>(null);
  const [toolEditorQuery, setToolEditorQuery] = useState("");
  const [toolEditorEnabledOnly, setToolEditorEnabledOnly] = useState(false);
  const [bulkTogglingSkillId, setBulkTogglingSkillId] = useState<string | null>(null);
  const [groupEditorPackageId, setGroupEditorPackageId] = useState<string | null>(null);
  const [groupEditorQuery, setGroupEditorQuery] = useState("");
  const [groupEditorEnabledOnly, setGroupEditorEnabledOnly] = useState(false);
  const [togglingGroupToolKey, setTogglingGroupToolKey] = useState<string | null>(null);
  const [bulkTogglingGroupId, setBulkTogglingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showTagFilterMenu, setShowTagFilterMenu] = useState(false);
  const [skillEditorTab, setSkillEditorTab] = useState<SkillEditorTab>("tools");
  const [tagDraft, setTagDraft] = useState("");
  const [savingTagsSkillId, setSavingTagsSkillId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const skillMetadata = config?.skill_metadata;
  const listContainerRef = useRef<HTMLElement | null>(null);
  const hasRestoredScrollRef = useRef(false);

  const handleOpenUnifiedItem = useCallback(async (item: UnifiedSkillListItem) => {
    if (!item.openPath) {
      return;
    }

    try {
      const editorId = config?.preferences?.default_editor || "builtin";

      if (editorId === "builtin") {
        const currentScrollOffset = listContainerRef.current?.scrollTop ?? 0;
        saveSkillsListScrollOffset(currentScrollOffset);
        navigate(`/editor?root=${encodeURIComponent(item.openPath)}`);
      } else {
        await invoke("open_in_editor", { editorId, path: item.openPath });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [config, navigate, addToast]);

  const loadData = useCallback(async () => {
    try {
      const [skillsResult, skillPackagesResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("list_skills"),
        invoke<InstalledSkillPackage[]>("list_skill_packages"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setSkillPackages(skillPackagesResult);
      setConfig(configResult);
      setTools(toolsResult);
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setInitialLoading(false);
    }
  }, [addToast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [skillsResult, skillPackagesResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("refresh_skills"),
        invoke<InstalledSkillPackage[]>("list_skill_packages"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setSkillPackages(skillPackagesResult);
      setConfig(configResult);
      setTools(toolsResult);
      addToast(t("common.refreshSuccess"), "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, t]);

  const reloadData = useCallback(async () => {
    try {
      const [skillsResult, skillPackagesResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("list_skills"),
        invoke<InstalledSkillPackage[]>("list_skill_packages"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setSkillPackages(skillPackagesResult);
      setConfig(configResult);
      setTools(toolsResult);
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const persistMetadataTags = useCallback(async (metadataKey: string, nextTags: string[]) => {
    if (!config) {
      return;
    }

    const previousConfig = config;
    const nextSkillMetadata = updateMetadataTags(metadataKey, nextTags, config.skill_metadata);
    const nextConfig: AppConfig = {
      ...config,
      skill_metadata: nextSkillMetadata,
    };

    setConfig(nextConfig);
    setSavingTagsSkillId(metadataKey);

    try {
      await invoke("save_config", { config: nextConfig });
    } catch (err) {
      setConfig(previousConfig);
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSavingTagsSkillId(null);
    }
  }, [addToast, config]);

  const persistSkillTags = useCallback(async (skillId: string, nextTags: string[]) => {
    await persistMetadataTags(skillId, nextTags);
  }, [persistMetadataTags]);

  const toggleTagFilter = useCallback((tag: string) => {
    const next = applyTagFilterAction(
      { selectedTags, untaggedOnly },
      { type: "toggle-tag", tag },
    );
    setSelectedTags(next.selectedTags);
    setUntaggedOnly(next.untaggedOnly);
    setShowTagFilterMenu(false);
  }, [selectedTags, untaggedOnly]);

  const handleToggleUntaggedOnly = useCallback(() => {
    const next = applyTagFilterAction(
      { selectedTags, untaggedOnly },
      { type: "toggle-untagged" },
    );
    setSelectedTags(next.selectedTags);
    setUntaggedOnly(next.untaggedOnly);
    setShowTagFilterMenu(false);
  }, [selectedTags, untaggedOnly]);

  const handleResetTagFilters = useCallback(() => {
    const next = applyTagFilterAction(
      { selectedTags, untaggedOnly },
      { type: "reset" },
    );
    setSelectedTags(next.selectedTags);
    setUntaggedOnly(next.untaggedOnly);
    setShowTagFilterMenu(false);
  }, [selectedTags, untaggedOnly]);

  const handleAddTag = useCallback(async (skillId: string) => {
    const nextTag = normalizeSkillTags([tagDraft])[0];
    if (!nextTag) {
      return;
    }

    const currentTags = getSkillTags(skillId, skillMetadata);
    if (currentTags.includes(nextTag)) {
      setTagDraft("");
      return;
    }

    await persistSkillTags(skillId, [...currentTags, nextTag]);
    setTagDraft("");
  }, [persistSkillTags, skillMetadata, tagDraft]);

  const handleRemoveTag = useCallback(async (skillId: string, tag: string) => {
    const nextTags = getSkillTags(skillId, skillMetadata).filter((item) => item !== tag);
    await persistSkillTags(skillId, nextTags);
  }, [persistSkillTags, skillMetadata]);

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

  const openSkillEditor = useCallback((skillId: string, tab: SkillEditorTab = "tools") => {
    setToolEditorSkillId(skillId);
    setGroupEditorPackageId(null);
    setSkillEditorTab(tab);
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
    setGroupEditorQuery("");
    setGroupEditorEnabledOnly(false);
    setTagDraft("");
    setShowTagFilterMenu(false);
  }, []);

  const openGroupEditor = useCallback((packageId: string) => {
    setGroupEditorPackageId(packageId);
    setToolEditorSkillId(null);
    setSkillEditorTab("tools");
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
    setGroupEditorQuery("");
    setGroupEditorEnabledOnly(false);
    setTagDraft("");
    setShowTagFilterMenu(false);
  }, []);

  const closeSkillEditor = useCallback(() => {
    setToolEditorSkillId(null);
    setGroupEditorPackageId(null);
    setSkillEditorTab("tools");
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
    setGroupEditorQuery("");
    setGroupEditorEnabledOnly(false);
    setTagDraft("");
  }, []);

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

  const handleDelete = async (skill: Skill) => {
    const confirmed = await confirm(t("skills.deleteConfirm").replace("{name}", skill.name), {
      title: t("skills.delete"),
      kind: "warning",
    });
    if (!confirmed) return;

    setDeletingSkill(skill.id);
    try {
      await invoke("delete_skill", { skillId: skill.id });
      if (toolEditorSkillId === skill.id) {
        closeSkillEditor();
      }
      if (config?.skill_metadata?.[skill.id]) {
        const nextConfig: AppConfig = {
          ...config,
          skill_metadata: Object.fromEntries(
            Object.entries(config.skill_metadata).filter(([itemSkillId]) => itemSkillId !== skill.id),
          ),
        };
        try {
          await invoke("save_config", { config: nextConfig });
          setConfig(nextConfig);
        } catch (cleanupError) {
          addToast(cleanupError instanceof Error ? cleanupError.message : String(cleanupError), "error");
        }
      }
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

  const allTagSummaries = useMemo(
    () => buildAllTagSummaries(skillMetadata),
    [skillMetadata],
  );

  const untaggedSkillsCount = useMemo(
    () => skills.filter((skill) => getSkillTags(skill.id, skillMetadata).length === 0).length,
    [skillMetadata, skills],
  );

  const showTagFilterControl = useMemo(
    () => hasSelectableTagFilters(allTagSummaries),
    [allTagSummaries],
  );

  const tagFilterSelection = useMemo(
    () => getTagFilterSelectionSummary(selectedTags, untaggedOnly),
    [selectedTags, untaggedOnly],
  );

  const tagFilterButtonLabel = useMemo(() => {
    switch (tagFilterSelection.kind) {
      case "untagged":
        return t("skills.untagged");
      case "single":
        return `#${tagFilterSelection.tag}`;
      case "multiple":
        return t("skills.selectedTagsCountCompact").replace("{count}", String(tagFilterSelection.count));
      default:
        return t("skills.tagFilterButton");
    }
  }, [tagFilterSelection, t]);

  const hasActiveSkillFilters = Boolean(searchQuery.trim()) || selectedTags.length > 0 || untaggedOnly;

  const unifiedItems = useMemo(() => buildUnifiedSkillItems({
    skills,
    skillPackages,
    tools,
    skillMetadata,
    groupBadgeLabel: t("skills.groupBadge"),
  }), [skillMetadata, skillPackages, skills, t, tools]);

  const filteredUnifiedItems = useMemo(() => filterUnifiedSkillItems(unifiedItems, {
    searchQuery,
    selectedTags,
    untaggedOnly,
  }), [searchQuery, selectedTags, unifiedItems, untaggedOnly]);

  const sortedUnifiedItems = useMemo(
    () => sortUnifiedSkillItems(filteredUnifiedItems, searchQuery),
    [filteredUnifiedItems, searchQuery],
  );

  const toolIds = useMemo(
    () => getEnabledToolIds(tools),
    [tools],
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

  const toolEditorTags = useMemo(
    () => (toolEditorSkill ? getSkillTags(toolEditorSkill.id, skillMetadata) : []),
    [skillMetadata, toolEditorSkill],
  );

  const toolEditorTagSuggestions = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return allTagSummaries
      .map((item) => item.tag)
      .filter((tag) => !toolEditorTags.includes(tag))
      .slice(0, 8);
  }, [allTagSummaries, toolEditorSkill, toolEditorTags]);

  const groupEditorItem = useMemo(
    () => unifiedItems.find((item) => item.kind === "group" && item.id === groupEditorPackageId) ?? null,
    [groupEditorPackageId, unifiedItems],
  );

  const groupEditorMetadataKey = useMemo(
    () => (groupEditorItem ? getGroupMetadataKey(groupEditorItem.id) : null),
    [groupEditorItem],
  );

  const groupEditorTags = useMemo(
    () => (groupEditorItem ? getGroupTags(groupEditorItem.id, skillMetadata) : []),
    [groupEditorItem, skillMetadata],
  );

  const groupEditorTagSuggestions = useMemo(() => {
    if (!groupEditorItem) {
      return [];
    }

    return allTagSummaries
      .map((item) => item.tag)
      .filter((tag) => !groupEditorTags.includes(tag))
      .slice(0, 8);
  }, [allTagSummaries, groupEditorItem, groupEditorTags]);

  const groupEditorOrderedToolIds = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    return orderToolIdsForSkill(
      toolIds,
      getGroupBulkModeState(groupEditorItem.groupToolStateById),
    );
  }, [groupEditorItem, toolIds]);

  const groupEditorFilteredToolIds = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    const normalizedQuery = groupEditorQuery.trim().toLowerCase();
    return groupEditorOrderedToolIds.filter((toolId) => {
      const toolState = groupEditorItem.groupToolStateById?.[toolId];
      if (!toolState) {
        return false;
      }

      if (groupEditorEnabledOnly && !shouldShowGroupToolInEnabledOnly(toolState)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const displayName = getToolDisplayName(toolId, tools).toLowerCase();
      return displayName.includes(normalizedQuery) || toolId.toLowerCase().includes(normalizedQuery);
    });
  }, [groupEditorEnabledOnly, groupEditorItem, groupEditorOrderedToolIds, groupEditorQuery, tools]);

  const groupEditorEnabledCount = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return 0;
    }

    return Object.values(groupEditorItem.groupToolStateById).filter((state) => state.fullyEnabled).length;
  }, [groupEditorItem]);

  const groupEditorBulkToggleMode = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return "enable";
    }

    return getSkillBulkToggleMode(
      groupEditorFilteredToolIds,
      getGroupBulkModeState(groupEditorItem.groupToolStateById),
      tools,
    );
  }, [groupEditorFilteredToolIds, groupEditorItem, tools]);

  const groupEditorBulkToggleTargets = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    return getSkillBulkToggleTargets(
      groupEditorFilteredToolIds,
      getGroupBulkModeState(groupEditorItem.groupToolStateById),
      tools,
      groupEditorBulkToggleMode,
    );
  }, [groupEditorBulkToggleMode, groupEditorFilteredToolIds, groupEditorItem, tools]);

  const groupEditorIsBulkToggling = groupEditorItem ? bulkTogglingGroupId === groupEditorItem.id : false;
  const groupEditorHasPendingSingleToggle = groupEditorItem
    ? Boolean(togglingGroupToolKey?.startsWith(`${groupEditorItem.id}:`))
    : false;
  const groupEditorBulkToggleDisabled =
    groupEditorIsBulkToggling || groupEditorHasPendingSingleToggle || groupEditorBulkToggleTargets.length === 0;
  const groupEditorBulkToggleLabel = groupEditorIsBulkToggling
    ? t("skills.bulkUpdating")
    : groupEditorBulkToggleMode === "enable"
      ? t("skills.bulkEnable")
      : t("skills.bulkDisable");

  const groupEditorItems = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    return groupEditorFilteredToolIds.map((toolId) => {
      const state = groupEditorItem.groupToolStateById?.[toolId];
      const toggleKey = `${groupEditorItem.id}:${toolId}`;
      const isToggling = togglingGroupToolKey === toggleKey;
      const tool = tools.find((item) => item.id === toolId);
      const isDetected = tool?.detected ?? false;
      const isToolEnabled = tool?.config.enabled ?? false;
      const isDisabled = groupEditorIsBulkToggling || isToggling || !isDetected || !isToolEnabled;
      return {
        id: toolId,
        label: state ? getGroupToolLabel(getToolDisplayName(toolId, tools), state) : getToolDisplayName(toolId, tools),
        enabled: state ? getGroupToolVisualState(state) : false,
        disabled: isDisabled,
        tooltip: !isDetected ? t("skills.toolNotDetected") : undefined,
        dimmed: !isDetected,
      };
    });
  }, [groupEditorFilteredToolIds, groupEditorIsBulkToggling, groupEditorItem, togglingGroupToolKey, tools, t]);

  const handleGroupToggle = useCallback(async (groupItem: UnifiedSkillListItem, toolId: string, enabled: boolean) => {
    const skillPackage = groupItem.skillPackage;
    if (!skillPackage) {
      return;
    }

    const memberSkills = getGroupMemberSkills(skillPackage, skills);
    const targetSkillIds = memberSkills
      .filter((skill) => enabled ? !skill.enabled[toolId] : Boolean(skill.enabled[toolId]))
      .map((skill) => skill.id);
    const affectedMemberCount = targetSkillIds.length;

    if (targetSkillIds.length === 0) {
      return;
    }

    const toggleKey = `${groupItem.id}:${toolId}`;
    setTogglingGroupToolKey(toggleKey);
    try {
      const command = enabled ? "enable_skill" : "disable_skill";
      const results = await Promise.allSettled(
        targetSkillIds.map((skillId) => invoke(command, { skillId, toolId })),
      );
      const failedCount = results.filter((result) => result.status === "rejected").length;
      const changedCount = targetSkillIds.length - failedCount;

      if (changedCount > 0) {
        const message = enabled ? t("skills.groupToolEnableSuccess") : t("skills.groupToolDisableSuccess");
        addToast(message.replace("{count}", String(affectedMemberCount)).replace("{tool}", getToolDisplayName(toolId, tools)), "success");
      }

      if (failedCount > 0) {
        addToast(t("skills.bulkTogglePartialFailed").replace("{count}", String(failedCount)), "error");
      }

      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
      await reloadData();
    } finally {
      setTogglingGroupToolKey(null);
    }
  }, [addToast, reloadData, skills, t, tools]);

  const handleGroupBulkToggle = useCallback(async (groupItem: UnifiedSkillListItem, visibleToolIds: string[]) => {
    const skillPackage = groupItem.skillPackage;
    const groupToolStateById = groupItem.groupToolStateById;
    if (!skillPackage || !groupToolStateById) {
      return;
    }

    const groupBulkModeState = getGroupBulkModeState(groupToolStateById);
    const bulkMode = getSkillBulkToggleMode(
      visibleToolIds,
      groupBulkModeState,
      tools,
    );
    const targetToolIds = getSkillBulkToggleTargets(
      visibleToolIds,
      groupBulkModeState,
      tools,
      bulkMode,
    );
    if (targetToolIds.length === 0) {
      return;
    }

    const confirmed = await confirm(
      bulkMode === "enable"
        ? t("skills.groupBulkConfirmEnable")
          .replace("{tools}", String(targetToolIds.length))
          .replace("{members}", String(skillPackage.installed_members.length))
        : t("skills.groupBulkConfirmDisable")
          .replace("{tools}", String(targetToolIds.length))
          .replace("{members}", String(skillPackage.installed_members.length)),
      {
        title: t("skills.bulkConfirmTitle"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }

    const memberSkills = getGroupMemberSkills(skillPackage, skills);
    const operations = targetToolIds.flatMap((toolId) => {
      return memberSkills
        .filter((skill) => bulkMode === "enable" ? !skill.enabled[toolId] : Boolean(skill.enabled[toolId]))
        .map((skill) => ({ skillId: skill.id, toolId }));
    });

    if (operations.length === 0) {
      return;
    }

    setBulkTogglingGroupId(groupItem.id);
    try {
      const command = bulkMode === "enable" ? "enable_skill" : "disable_skill";
      const results = await Promise.allSettled(
        operations.map(({ skillId, toolId }) => invoke(command, { skillId, toolId })),
      );
      const failedCount = results.filter((result) => result.status === "rejected").length;
      const changedCount = operations.length - failedCount;

      if (changedCount > 0) {
        const successMessage = bulkMode === "enable" ? t("skills.groupBulkEnableSuccess") : t("skills.groupBulkDisableSuccess");
        addToast(successMessage.replace("{count}", String(operations.length)), "success");
      }

      if (failedCount > 0) {
        addToast(t("skills.bulkTogglePartialFailed").replace("{count}", String(failedCount)), "error");
      }

      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
      await reloadData();
    } finally {
      setBulkTogglingGroupId(null);
    }
  }, [addToast, reloadData, skills, t, tools]);

  const handleDeleteGroup = useCallback(async (groupItem: UnifiedSkillListItem) => {
    const skillPackage = groupItem.skillPackage;
    if (!skillPackage) {
      return;
    }

    const confirmed = await confirm(
      t("skills.groupDeleteConfirm")
        .replace("{name}", groupItem.title)
        .replace("{count}", String(skillPackage.installed_members.length)),
      {
        title: t("skills.delete"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }

    setDeletingGroupId(groupItem.id);
    try {
      await invoke("remove_skill_package", { packageId: skillPackage.package_id });
      if (groupEditorPackageId === groupItem.id) {
        closeSkillEditor();
      }
      if (config?.skill_metadata) {
        const nextConfig: AppConfig = {
          ...config,
          skill_metadata: removeGroupSkillMetadataEntries(
            config.skill_metadata,
            skillPackage.installed_members,
            skillPackage.package_id,
          ),
        };
        try {
          await invoke("save_config", { config: nextConfig });
          setConfig(nextConfig);
        } catch (cleanupError) {
          addToast(cleanupError instanceof Error ? cleanupError.message : String(cleanupError), "error");
        }
      }
      addToast(t("skills.groupDeleteSuccess").replace("{name}", groupItem.title), "success");
      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setDeletingGroupId(null);
    }
  }, [addToast, closeSkillEditor, config, groupEditorPackageId, reloadData, t]);

  useEffect(() => {
    if (initialLoading || hasRestoredScrollRef.current) {
      return;
    }

    const container = listContainerRef.current;
    if (!container) {
      return;
    }

    const savedScrollOffset = takeSkillsListScrollOffset();
    if (savedScrollOffset === null) {
      hasRestoredScrollRef.current = true;
      return;
    }

    container.scrollTop = savedScrollOffset;
    hasRestoredScrollRef.current = true;
  }, [initialLoading, sortedUnifiedItems.length]);

  if (initialLoading) {
    return (
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--background)",
      }}>
        <PageHeader title={t("skills.title")} />
        <main style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
          <PageLoader />
        </main>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--muted-foreground)" }}>
        <PageLoader message={t("loading.skills")} />
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      backgroundColor: "var(--background)",
    }}>
      <PageHeader
        title={t("skills.title")}
        actions={
          <>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />

            {showTagFilterControl && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowTagFilterMenu((current) => !current)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: selectedTags.length > 0 || untaggedOnly ? "var(--primary)" : "var(--foreground)",
                    backgroundColor: "var(--background)",
                    border: selectedTags.length > 0 || untaggedOnly ? "1px solid rgba(9, 105, 218, 0.4)" : "1px solid var(--border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    minWidth: "124px",
                    justifyContent: "space-between",
                    boxShadow: selectedTags.length > 0 || untaggedOnly ? "0 0 0 3px rgba(9, 105, 218, 0.08)" : "none",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M6 12h12M10 18h4" />
                    </svg>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tagFilterButtonLabel}
                    </span>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={showTagFilterMenu ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
                  </svg>
                </button>

                {showTagFilterMenu && (
                  <>
                    <div
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: MODAL_LAYER_Z_INDEX - 1,
                      }}
                      onClick={() => setShowTagFilterMenu(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: "260px",
                        maxHeight: "360px",
                        overflow: "auto",
                        padding: "10px",
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.16)",
                        zIndex: MODAL_LAYER_Z_INDEX,
                      }}
                    >
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "10px",
                      }}>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)" }}>
                            {t("skills.tagFilterButton")}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>
                            {t("skills.tagFilterHintCompact")}
                          </div>
                        </div>
                        {(selectedTags.length > 0 || untaggedOnly) && (
                          <button
                            type="button"
                            onClick={handleResetTagFilters}
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--muted-foreground)",
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 6px",
                            }}
                          >
                            {t("common.reset")}
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={handleResetTagFilters}
                          style={buildTagFilterMenuItemStyle(tagFilterSelection.kind === "all")}
                        >
                          <span>{t("skills.allTags")}</span>
                          <span style={{ opacity: 0.72 }}>{skills.length}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleUntaggedOnly}
                          style={buildTagFilterMenuItemStyle(untaggedOnly)}
                        >
                          <span>{t("skills.untagged")}</span>
                          <span style={{ opacity: 0.72 }}>{untaggedSkillsCount}</span>
                        </button>

                        {allTagSummaries.map(({ tag, count }) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTagFilter(tag)}
                            style={buildTagFilterMenuItemStyle(selectedTags.includes(tag))}
                          >
                            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>#{tag}</span>
                            <span style={{ opacity: 0.72, flexShrink: 0 }}>{count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ position: "relative" }}>
              <svg
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted-foreground)",
                  pointerEvents: "none",
                }}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder={t("skills.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "200px",
                  padding: "8px 12px 8px 36px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--ring)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(9, 105, 218, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--primary-foreground)",
                backgroundColor: "var(--foreground)",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              onClick={() => setShowCreateDialog(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("skills.newSkill")}
            </button>
          </>
        }
      />

      <main
        ref={listContainerRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 32px",
        }}
      >
        <div style={{ maxWidth: "1200px" }}>
          {sortedUnifiedItems.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "48px 24px",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--secondary)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}>
              {hasActiveSkillFilters ? t("skills.noMatch") : t("skills.noSkills")}
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}>
              {sortedUnifiedItems.map((item) => {
                const color = getSkillColor(item.title);
                const canOpen = Boolean(item.openPath);
                const description = item.kind === "group"
                  ? item.skillPackage?.package_id ?? getUnifiedItemMetaLabel(item, t)
                  : item.description || t("skills.noDescription");
                const previewChips = item.previewChips.map((chip) => `#${chip}`);

                return (
                  <div
                    key={item.key}
                    onClick={canOpen ? () => void handleOpenUnifiedItem(item) : undefined}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "18px 20px",
                      backgroundColor: "var(--secondary)",
                      borderRadius: "14px",
                      border: "1px solid var(--border)",
                      transition: canOpen ? "border-color 0.2s, box-shadow 0.2s, transform 0.2s" : undefined,
                      cursor: canOpen ? "pointer" : "default",
                    }}
                    onMouseEnter={(e) => {
                      if (!canOpen) {
                        return;
                      }
                      e.currentTarget.style.borderColor = "var(--ring)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      if (!canOpen) {
                        return;
                      }
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ display: "flex", gap: "14px", marginBottom: "16px", alignItems: "flex-start" }}>
                      <div style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: color.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      }}>
                        {item.kind === "group" ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color.icon} strokeWidth="2">
                            <rect x="3" y="4" width="7" height="7" rx="1.5" />
                            <rect x="14" y="4" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" />
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.icon} strokeWidth="2">
                            <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
                          </svg>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <div style={{
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "var(--foreground)",
                            lineHeight: 1.3,
                            minWidth: 0,
                          }}>
                            {item.title}
                          </div>
                          {item.badgeLabel && (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              height: "22px",
                              padding: "0 8px",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--muted-foreground)",
                              backgroundColor: "var(--background)",
                              border: "1px solid var(--border)",
                              borderRadius: "999px",
                            }}>
                              {item.badgeLabel}
                            </span>
                          )}
                        </div>
                        <p style={{
                          fontSize: "13px",
                          color: "var(--muted-foreground)",
                          margin: 0,
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>
                          {description}
                        </p>
                      </div>

                      {item.kind === "skill" && item.skill && (
                        <SkillCardActionMenu
                          deleting={deletingSkill === item.skill.id}
                          editLabel={t("common.edit")}
                          deleteLabel={t("skills.delete")}
                          moreActionsLabel={t("skills.moreActions")}
                          onEdit={() => openSkillEditor(item.skill!.id, "tools")}
                          onDelete={() => void handleDelete(item.skill!)}
                        />
                      )}
                      {item.kind === "group" && item.skillPackage && (
                        <SkillCardActionMenu
                          deleting={deletingGroupId === item.id}
                          editLabel={t("common.edit")}
                          deleteLabel={t("skills.delete")}
                          moreActionsLabel={t("skills.moreActions")}
                          onEdit={() => openGroupEditor(item.id)}
                          onDelete={() => void handleDeleteGroup(item)}
                        />
                      )}
                    </div>

                    {renderPreviewChips(previewChips, item.previewOverflowCount) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px", minHeight: "24px" }}>
                        {renderPreviewChips(previewChips, item.previewOverflowCount)}
                      </div>
                    )}

                    <div style={{
                      paddingTop: "12px",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}>
                      <div style={{
                        fontSize: "12px",
                        color: "var(--muted-foreground)",
                        lineHeight: 1.5,
                      }}>
                        {getUnifiedItemMetaLabel(item, t)}
                      </div>
                      {item.kind === "skill" && item.toolSummary?.state === "partial" && item.toolSummary.visibleEnabledToolIds.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {item.toolSummary.visibleEnabledToolIds.map((toolId) => (
                            <span
                              key={toolId}
                              style={{
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "var(--primary)",
                                backgroundColor: "rgba(9, 105, 218, 0.12)",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid rgba(9, 105, 218, 0.35)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getToolDisplayName(toolId, tools)}
                            </span>
                          ))}
                          {item.toolSummary.remainingCount > 0 && (
                            <span style={{
                              fontSize: "12px",
                              fontWeight: 500,
                              color: "var(--muted-foreground)",
                              whiteSpace: "nowrap",
                            }}>
                              +{item.toolSummary.remainingCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {toolEditorSkill && (
        <SkillManageDialog
          skillName={toolEditorSkill.name}
          skillDescription={toolEditorSkill.description || t("skills.noDescription")}
          activeTab={skillEditorTab}
          onTabChange={setSkillEditorTab}
          onClose={closeSkillEditor}
          doneLabel={t("common.done")}
          toolsTitle={t("skills.configureToolsTitle")}
          toolsDescription={t("skills.configureToolsDesc")
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
          onQueryChange={setToolEditorQuery}
          onEnabledOnlyChange={setToolEditorEnabledOnly}
          onToggle={(toolId, enabled) => handleToggle(toolEditorSkill.id, toolEditorSkill.name, toolId, enabled)}
          onBulkToggle={() => handleBulkToggle(toolEditorSkill, toolEditorFilteredToolIds)}
          tags={toolEditorTags}
          tagDraft={tagDraft}
          onTagDraftChange={setTagDraft}
          onAddTag={() => void handleAddTag(toolEditorSkill.id)}
          onRemoveTag={(tag) => void handleRemoveTag(toolEditorSkill.id, tag)}
          tagSuggestions={toolEditorTagSuggestions}
          onSelectTagSuggestion={(tag) => void persistSkillTags(toolEditorSkill.id, [...toolEditorTags, tag])}
          savingTags={savingTagsSkillId === toolEditorSkill.id}
          t={t}
        />
      )}

      {groupEditorItem && groupEditorItem.skillPackage && (
        <SkillManageDialog
          skillName={groupEditorItem.title}
          skillDescription={groupEditorItem.skillPackage.package_id}
          activeTab={skillEditorTab}
          onTabChange={setSkillEditorTab}
          onClose={closeSkillEditor}
          doneLabel={t("common.done")}
          toolsTitle={t("skills.groupConfigureToolsTitle")}
          toolsDescription={t("skills.groupConfigureToolsDesc")
            .replace("{group}", groupEditorItem.title)
            .replace("{enabled}", String(groupEditorEnabledCount))
            .replace("{total}", String(groupEditorOrderedToolIds.length))}
          query={groupEditorQuery}
          enabledOnly={groupEditorEnabledOnly}
          searchPlaceholder={t("skills.searchToolsPlaceholder")}
          enabledOnlyLabel={t("skills.enabledOnly")}
          bulkToggleLabel={groupEditorBulkToggleLabel}
          bulkToggleDisabled={groupEditorBulkToggleDisabled}
          bulkToggleTitle={groupEditorBulkToggleTargets.length === 0 ? t("skills.bulkNoTarget") : undefined}
          items={groupEditorItems}
          emptyLabel={t("skills.noToolsInFilter")}
          onQueryChange={setGroupEditorQuery}
          onEnabledOnlyChange={setGroupEditorEnabledOnly}
          onToggle={(toolId, enabled) => void handleGroupToggle(groupEditorItem, toolId, enabled)}
          onBulkToggle={() => void handleGroupBulkToggle(groupEditorItem, groupEditorFilteredToolIds)}
          tags={groupEditorTags}
          tagDraft={tagDraft}
          onTagDraftChange={setTagDraft}
          onAddTag={() => {
            if (!groupEditorMetadataKey) {
              return;
            }
            const nextTag = normalizeSkillTags([tagDraft])[0];
            if (!nextTag) {
              return;
            }
            if (groupEditorTags.includes(nextTag)) {
              setTagDraft("");
              return;
            }
            void persistMetadataTags(groupEditorMetadataKey, [...groupEditorTags, nextTag]);
            setTagDraft("");
          }}
          onRemoveTag={(tag) => {
            if (!groupEditorMetadataKey) {
              return;
            }
            void persistMetadataTags(
              groupEditorMetadataKey,
              groupEditorTags.filter((item) => item !== tag),
            );
          }}
          tagSuggestions={groupEditorTagSuggestions}
          onSelectTagSuggestion={(tag) => {
            if (!groupEditorMetadataKey) {
              return;
            }
            void persistMetadataTags(groupEditorMetadataKey, [...groupEditorTags, tag]);
          }}
          savingTags={savingTagsSkillId === groupEditorMetadataKey}
          t={t}
        />
      )}

      {showCreateDialog && (
        <CreateSkillDialog
          creating={creating}
          existingIds={skills.map((skill) => skill.id)}
          onCancel={() => setShowCreateDialog(false)}
          onCreate={handleCreateSkill}
          t={t}
        />
      )}
    </div>
  );
}

function SkillManageDialog({
  skillName,
  skillDescription,
  activeTab,
  availableTabs = ["tools", "tags"],
  onTabChange,
  onClose,
  doneLabel,
  toolsTitle,
  toolsDescription,
  query,
  enabledOnly,
  searchPlaceholder,
  enabledOnlyLabel,
  bulkToggleLabel,
  bulkToggleDisabled,
  bulkToggleTitle,
  items,
  emptyLabel,
  onQueryChange,
  onEnabledOnlyChange,
  onToggle,
  onBulkToggle,
  tags,
  tagDraft,
  onTagDraftChange,
  onAddTag,
  onRemoveTag,
  tagSuggestions,
  onSelectTagSuggestion,
  savingTags,
  t,
}: {
  skillName: string;
  skillDescription: string;
  activeTab: SkillEditorTab;
  availableTabs?: SkillEditorTab[];
  onTabChange: (tab: SkillEditorTab) => void;
  onClose: () => void;
  doneLabel: string;
  toolsTitle: string;
  toolsDescription: string;
  query: string;
  enabledOnly: boolean;
  searchPlaceholder: string;
  enabledOnlyLabel: string;
  bulkToggleLabel: string;
  bulkToggleDisabled: boolean;
  bulkToggleTitle?: string;
  items: Array<{
    id: string;
    label: string;
    enabled: boolean;
    disabled: boolean;
    tooltip?: string;
    dimmed?: boolean;
  }>;
  emptyLabel: string;
  onQueryChange: (query: string) => void;
  onEnabledOnlyChange: (enabledOnly: boolean) => void;
  onToggle: (itemId: string, enabled: boolean) => void;
  onBulkToggle: () => void;
  tags: string[];
  tagDraft: string;
  onTagDraftChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  tagSuggestions: string[];
  onSelectTagSuggestion: (tag: string) => void;
  savingTags: boolean;
  t: (key: TranslationPath) => string;
}) {
  const canAddTag = normalizeSkillTags([tagDraft]).length > 0;

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
      onClick={onClose}
    >
      <div
        style={{
          width: "min(680px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 72px)",
          backgroundColor: "var(--background)",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 56px rgba(0,0,0,0.22)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
              {skillName}
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              {skillDescription}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--secondary)",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px",
            backgroundColor: "var(--secondary)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            width: "fit-content",
          }}
        >
          {availableTabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                style={{
                  padding: "7px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: active ? "var(--primary-foreground)" : "var(--foreground)",
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                {tab === "tools" ? t("skills.manageToolsTab") : t("skills.manageTagsTab")}
              </button>
            );
          })}
        </div>

        {activeTab === "tools" ? (
          <>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--foreground)" }}>{toolsTitle}</strong>
              <div>{toolsDescription}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 280px", minWidth: "200px" }}>
                <svg
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted-foreground)",
                    pointerEvents: "none",
                  }}
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  style={{
                    width: "100%",
                    padding: "8px 10px 8px 32px",
                    fontSize: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    backgroundColor: "var(--secondary)",
                    color: "var(--foreground)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--muted-foreground)",
                  userSelect: "none",
                }}
              >
                <Toggle
                  checked={enabledOnly}
                  onChange={(checked) => onEnabledOnlyChange(checked)}
                />
                {enabledOnlyLabel}
              </label>

              <button
                type="button"
                onClick={onBulkToggle}
                disabled={bulkToggleDisabled}
                title={bulkToggleTitle}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 10px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  backgroundColor: "var(--secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  cursor: bulkToggleDisabled ? "not-allowed" : "pointer",
                  opacity: bulkToggleDisabled ? 0.6 : 1,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
                </svg>
                {bulkToggleLabel}
              </button>
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "10px",
                backgroundColor: "var(--secondary)",
                overflow: "hidden",
              }}
            >
              <div style={{ maxHeight: "360px", overflow: "auto", padding: "6px" }}>
                {items.length === 0 ? (
                  <div
                    style={{
                      padding: "30px 14px",
                      textAlign: "center",
                      fontSize: "12px",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {emptyLabel}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          minHeight: "48px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          backgroundColor: item.enabled ? "rgba(9, 105, 218, 0.08)" : "var(--background)",
                          opacity: item.dimmed ? 0.6 : 1,
                        }}
                        title={item.tooltip}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "var(--foreground)",
                            lineHeight: 1.35,
                            minWidth: 0,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.label}
                        </div>
                        <Toggle
                          checked={item.enabled}
                          disabled={item.disabled}
                          onChange={(checked) => onToggle(item.id, checked)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              backgroundColor: "var(--secondary)",
              padding: "14px",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              {t("skills.tagEditorHint")}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", minHeight: "30px" }}>
              {tags.length === 0 ? (
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {t("skills.noTags")}
                </span>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "rgba(17, 24, 39, 0.72)",
                      backgroundColor: "rgba(9, 105, 218, 0.04)",
                      border: "1px solid rgba(9, 105, 218, 0.14)",
                      borderRadius: "999px",
                      padding: "3px 5px 3px 8px",
                    }}
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
                      disabled={savingTags}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "18px",
                        height: "18px",
                        padding: 0,
                        color: "var(--muted-foreground)",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "999px",
                        cursor: savingTags ? "wait" : "pointer",
                      }}
                      title={t("skills.removeTag")}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={tagDraft}
                placeholder={t("skills.tagInputPlaceholder")}
                onChange={(e) => onTagDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && !savingTags) {
                    e.preventDefault();
                    onAddTag();
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "8px 10px",
                  fontSize: "12px",
                  color: "var(--foreground)",
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={onAddTag}
                disabled={savingTags || !canAddTag}
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--primary-foreground)",
                  backgroundColor: "var(--foreground)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: savingTags || !canAddTag ? "not-allowed" : "pointer",
                  opacity: savingTags || !canAddTag ? 0.5 : 1,
                }}
              >
                {t("skills.addTag")}
              </button>
            </div>

            {tagSuggestions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted-foreground)" }}>
                  {t("skills.commonTags")}
                </span>
                {tagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onSelectTagSuggestion(tag)}
                    disabled={savingTags}
                    style={{
                      padding: "5px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "999px",
                      cursor: savingTags ? "wait" : "pointer",
                    }}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--primary-foreground)",
              backgroundColor: "var(--foreground)",
              border: "none",
              borderRadius: "8px",
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            {doneLabel}
          </button>
        </div>
      </div>
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
