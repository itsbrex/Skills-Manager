import { useState } from "react";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

interface AuthButtonProps {
  variant?: "sidebar" | "inline";
}

export function AuthButton({ variant = "sidebar" }: AuthButtonProps) {
  const { t } = useTranslation();
  const { authProfile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayName = authProfile?.username || t("auth.login");

  if (variant === "sidebar") {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            borderRadius: "8px",
            fontSize: "13px",
            color: "var(--muted-foreground)",
            background: "transparent",
            border: "none",
            textAlign: "left",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {authProfile?.avatar_url ? (
              <img
                src={authProfile.avatar_url}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </div>
          <span style={{ color: "var(--foreground)" }}>{displayName}</span>
        </button>

        <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  // Inline variant for Settings page
  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 16px",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--foreground)",
          backgroundColor: "var(--secondary)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--muted)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--secondary)";
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            backgroundColor: "var(--muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {authProfile?.avatar_url ? (
            <img
              src={authProfile.avatar_url}
              alt={displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          )}
        </div>
        <span>{authProfile ? displayName : t("auth.login")}</span>
      </button>

      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
