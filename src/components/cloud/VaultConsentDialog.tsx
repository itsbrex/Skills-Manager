import { useTranslation } from "@/i18n";
import { useCloudSync } from "@/hooks/useCloudSyncAgent";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";

export function VaultConsentDialog() {
  const { t } = useTranslation();
  const {
    vaultConsentDialogOpen,
    acceptVaultConsent,
    denyVaultConsent,
    cancelVaultConsent,
    syncing,
    error,
  } = useCloudSync();

  if (!vaultConsentDialogOpen) {
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
          width: "min(520px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 72px)",
          backgroundColor: "var(--background)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 22px 60px rgba(0,0,0,0.28)",
          padding: "22px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
            {t("cloudSync.vaultConsentTitle")}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            {t("cloudSync.vaultConsentDesc")}
          </p>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--secondary)",
            fontSize: "12px",
            color: "var(--muted-foreground)",
            lineHeight: 1.6,
          }}
        >
          {t("cloudSync.vaultConsentHint")}
        </div>

        {error && (
          <div style={{ fontSize: "12px", color: "var(--color-error)" }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            onClick={cancelVaultConsent}
            disabled={syncing}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: syncing ? "wait" : "pointer",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {t("cloudSync.vaultConsentCancel")}
          </button>
          <button
            onClick={denyVaultConsent}
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
            {t("cloudSync.vaultConsentDeny")}
          </button>
          <button
            onClick={acceptVaultConsent}
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
            {t("cloudSync.vaultConsentAccept")}
          </button>
        </div>
      </div>
    </div>
  );
}
