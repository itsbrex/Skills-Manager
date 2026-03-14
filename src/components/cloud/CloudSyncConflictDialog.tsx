import { useMemo } from "react";
import { useTranslation } from "@/i18n";
import { useCloudSync } from "@/hooks/useCloudSyncAgent";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";

function formatTimestamp(seconds: number) {
  const date = new Date(seconds * 1000);
  return date.toLocaleString();
}

function buildSummary(payload: {
  skills: { id: string }[];
  tool_states: Record<string, { enabled_skills: string[] }>;
  custom_tools: { id: string }[];
  updated_at: number;
}) {
  const toolCount = Object.keys(payload.tool_states).length;
  const enabledSkillsCount = Object.values(payload.tool_states).reduce(
    (sum, tool) => sum + tool.enabled_skills.length,
    0,
  );
  return {
    skillsCount: payload.skills.length,
    toolCount,
    enabledSkillsCount,
    customToolsCount: payload.custom_tools.length,
    updatedAt: payload.updated_at,
  };
}

export function CloudSyncConflictDialog() {
  const { t } = useTranslation();
  const { conflict, resolveWithLocal, resolveWithRemote, syncing, error } = useCloudSync();

  const summaries = useMemo(() => {
    if (!conflict) {
      return null;
    }
    return {
      local: buildSummary(conflict.localPayload),
      remote: buildSummary(conflict.payload),
    };
  }, [conflict]);

  if (!conflict || !summaries) {
    return null;
  }

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
    >
      <div
        style={{
          width: "min(720px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 72px)",
          backgroundColor: "var(--background)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 22px 60px rgba(0,0,0,0.28)",
          padding: "22px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
            {t("cloudSync.conflictTitle")}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            {t("cloudSync.conflictDesc")}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          {[{ label: t("cloudSync.localSummary"), data: summaries.local }, { label: t("cloudSync.remoteSummary"), data: summaries.remote }].map(
            (item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--secondary)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>{item.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
                  <span>{t("cloudSync.summarySkills").replace("{count}", String(item.data.skillsCount))}</span>
                  <span>{t("cloudSync.summaryTools").replace("{count}", String(item.data.toolCount))}</span>
                  <span>{t("cloudSync.summaryEnabledSkills").replace("{count}", String(item.data.enabledSkillsCount))}</span>
                  <span>{t("cloudSync.summaryCustomTools").replace("{count}", String(item.data.customToolsCount))}</span>
                  <span>{t("cloudSync.updatedAt").replace("{time}", formatTimestamp(item.data.updatedAt))}</span>
                </div>
              </div>
            ),
          )}
        </div>

        <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
          {t("cloudSync.applyRemoteHint")}
        </div>

        {error && (
          <div style={{ fontSize: "12px", color: "var(--color-error)" }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            onClick={resolveWithLocal}
            disabled={syncing}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--secondary)",
              color: "var(--foreground)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: syncing ? "wait" : "pointer",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? t("cloudSync.resolving") : t("cloudSync.useLocal")}
          </button>
          <button
            onClick={resolveWithRemote}
            disabled={syncing}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--color-primary)",
              backgroundColor: "var(--color-primary)",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: syncing ? "wait" : "pointer",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? t("cloudSync.resolving") : t("cloudSync.useRemote")}
          </button>
        </div>
      </div>
    </div>
  );
}
