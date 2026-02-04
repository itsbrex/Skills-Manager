import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./Sidebar";
import { SyncReport, LinkReport } from "@/types";
import { useTranslation } from "@/i18n";

export function Layout() {
  const { t } = useTranslation();
  const [syncIssues, setSyncIssues] = useState<number>(0);
  const [showBanner, setShowBanner] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    checkSync();
  }, []);

  async function checkSync() {
    try {
      const report = await invoke<SyncReport>("check_sync_status");
      if (report.issues_count > 0) {
        setSyncIssues(report.issues_count);
        setShowBanner(true);
      }
    } catch (err) {
      console.error("Failed to check sync status:", err);
    }
  }

  async function handleFix() {
    setFixing(true);
    try {
      const result = await invoke<LinkReport>("fix_sync_issues");
      setFixResult({ success: result.success.length, failed: result.failed.length });
      if (result.failed.length === 0) {
        setTimeout(() => setShowBanner(false), 2000);
      }
    } catch (err) {
      console.error("Failed to fix sync issues:", err);
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background relative">
        {showBanner && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "12px 24px",
              backgroundColor: fixResult ? "#f0fdf4" : "#fefce8",
              borderBottom: fixResult ? "1px solid #bbf7d0" : "1px solid #fef08a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 100,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {fixResult ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                  <span style={{ fontSize: "14px", color: "#16a34a" }}>
                    {fixResult.failed > 0
                      ? t("sync.fixCompleteFailed").replace("{success}", String(fixResult.success)).replace("{failed}", String(fixResult.failed))
                      : t("sync.fixComplete").replace("{success}", String(fixResult.success))}
                  </span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span style={{ fontSize: "14px", color: "#a16207" }}>
                    {t("sync.issuesDetected").replace("{count}", String(syncIssues))}
                  </span>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {!fixResult && (
                <button
                  onClick={handleFix}
                  disabled={fixing}
                  style={{
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#fff",
                    backgroundColor: "#ca8a04",
                    border: "none",
                    borderRadius: "6px",
                    cursor: fixing ? "wait" : "pointer",
                    opacity: fixing ? 0.7 : 1,
                  }}
                >
                  {fixing ? t("sync.fixing") : t("sync.fixButton")}
                </button>
              )}
              <button
                onClick={() => setShowBanner(false)}
                style={{
                  padding: "6px 8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: fixResult ? "#16a34a" : "#a16207",
                  opacity: 0.6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
