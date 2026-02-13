import { FormEvent, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/i18n";
import { submitFeedback } from "@/services/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContainer, useToast } from "@/components/ui/toast";

const GITHUB_ISSUES_URL =
  "https://github.com/jiweiyeah/Skills-Manager/issues/new/choose";
const CONTACT_EMAIL = "freeourdays@gmail.com";
const WECHAT_NOTE = "skills-manager";

export function Feedback() {
  const { t, language } = useTranslation();
  const { toasts, addToast, removeToast } = useToast();
  const [userInfo, setUserInfo] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpenGithubIssues = async () => {
    try {
      await openUrl(GITHUB_ISSUES_URL);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : t("feedback.issueOpenFailed"),
        "error",
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUserInfo = userInfo.trim();
    const trimmedContent = content.trim();

    if (!trimmedUserInfo) {
      addToast(t("feedback.form.userInfoRequired"), "error");
      return;
    }

    if (!trimmedContent) {
      addToast(t("feedback.form.contentRequired"), "error");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        user_info: trimmedUserInfo,
        content: trimmedContent,
        source: "desktop-feedback-page",
        language,
      });
      setContent("");
      addToast(t("feedback.form.submitSuccess"), "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : t("feedback.form.submitFailed"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--background)",
      }}
    >
      <PageHeader title={t("feedback.title")} />
      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: "32px",
        }}
      >
        <div style={{ maxWidth: "760px" }}>
          <p
            style={{
              margin: "0 0 20px 0",
              fontSize: "14px",
              lineHeight: 1.7,
              color: "var(--muted-foreground)",
            }}
          >
            {t("feedback.description")}
          </p>

          <SectionTitle>{t("feedback.issueTitle")}</SectionTitle>
          <FeedbackCard>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                padding: "18px 0",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                    marginBottom: "6px",
                  }}
                >
                  {t("feedback.issueGithubTitle")}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {t("feedback.issueGithubDesc")}
                </div>
              </div>
              <button
                onClick={handleOpenGithubIssues}
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--primary-foreground)",
                  backgroundColor: "var(--primary)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t("feedback.issueGithubAction")}
              </button>
            </div>

            <div
              style={{
                height: "1px",
                backgroundColor: "var(--border)",
              }}
            />

            <form onSubmit={handleSubmit} style={{ padding: "18px 0 22px 0" }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: "6px",
                }}
              >
                {t("feedback.issueDirectTitle")}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "var(--muted-foreground)",
                  marginBottom: "14px",
                }}
              >
                {t("feedback.issueDirectDesc")}
              </div>

              <label
                htmlFor="feedback-user-info"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  marginBottom: "6px",
                }}
              >
                {t("feedback.form.userInfoLabel")}
                <span style={{ color: "var(--color-error)", marginLeft: "4px" }}>*</span>
              </label>
              <input
                id="feedback-user-info"
                value={userInfo}
                onChange={(e) => setUserInfo(e.target.value)}
                placeholder={t("feedback.form.userInfoPlaceholder")}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  marginBottom: "12px",
                }}
              />

              <label
                htmlFor="feedback-content"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  marginBottom: "6px",
                }}
              >
                {t("feedback.form.contentLabel")}
                <span style={{ color: "var(--color-error)", marginLeft: "4px" }}>*</span>
              </label>
              <textarea
                id="feedback-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("feedback.form.contentPlaceholder")}
                rows={6}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  resize: "vertical",
                  minHeight: "132px",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "14px",
                }}
              >
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--primary-foreground)",
                    backgroundColor: "var(--foreground)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: submitting ? "wait" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting
                    ? t("feedback.form.submitting")
                    : t("feedback.form.submit")}
                </button>
              </div>
            </form>
          </FeedbackCard>

          <SectionTitle>{t("feedback.contactTitle")}</SectionTitle>
          <FeedbackCard>
            <div style={{ padding: "20px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{ color: "var(--muted-foreground)", minWidth: "52px" }}
                >
                  {t("feedback.contact.wechatLabel")}
                </span>
                <span style={{ color: "var(--foreground)", lineHeight: 1.6 }}>
                  {t("feedback.contact.wechatDesc").replace(
                    "{note}",
                    WECHAT_NOTE,
                  )}
                </span>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{ color: "var(--muted-foreground)", minWidth: "52px" }}
                >
                  {t("feedback.contact.emailLabel")}
                </span>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  style={{
                    color: "var(--primary)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = "underline";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = "none";
                  }}
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </FeedbackCard>
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "15px",
        fontWeight: 600,
        color: "var(--foreground)",
        margin: "0 0 12px 0",
      }}
    >
      {children}
    </h2>
  );
}

function FeedbackCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "var(--secondary)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        padding: "0 20px",
        marginBottom: "32px",
      }}
    >
      {children}
    </div>
  );
}
