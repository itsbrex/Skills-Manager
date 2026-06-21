import { FormEvent, useState } from "react";
import { ChevronDown } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/i18n";
import feishuGroupQrCode from "@/assets/group/feishuqun.png";
import wechatGroupQrCode from "@/assets/group/weixinqun.png";
import { submitFeedback } from "@/services/feedback";
import {
  FEEDBACK_CONTACT_TYPES,
  FEEDBACK_CONTACT_TYPE_LABEL_KEY_MAP,
  getFeedbackContactValuePlaceholderKey,
  validateFeedbackContact,
} from "@/services/feedbackContact";
import {
  FEEDBACK_GROUP_CONTACT_CHANNELS,
  type FeedbackGroupContactChannelId,
} from "@/services/feedbackDirectContacts";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContainer, useToast } from "@/components/ui/toast";
import type { FeedbackContactType } from "@/types";

const GITHUB_ISSUES_URL =
  "https://github.com/jiweiyeah/Skills-Manager/issues/new/choose";
const CONTACT_EMAIL = "freeourdays@gmail.com";
const WECHAT_NOTE = "skills-manager";
const GROUP_CONTACT_QR_CODE_MAP: Record<FeedbackGroupContactChannelId, string> = {
  wechatGroup: wechatGroupQrCode,
  feishuGroup: feishuGroupQrCode,
};

export function Feedback() {
  const { t, language } = useTranslation();
  const { toasts, addToast, removeToast } = useToast();
  const [contactType, setContactType] = useState<FeedbackContactType | "">("");
  const [contactValue, setContactValue] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contactTypeFocused, setContactTypeFocused] = useState(false);
  const [contactValueFocused, setContactValueFocused] = useState(false);

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

    const trimmedContent = content.trim();
    const contactValidation = validateFeedbackContact(contactType, contactValue);
    if (!contactValidation.ok) {
      addToast(t(contactValidation.errorKey), "error");
      return;
    }

    if (!trimmedContent) {
      addToast(t("feedback.form.contentRequired"), "error");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        contact_type: contactValidation.contactType,
        contact_value: contactValidation.contactValue,
        content: trimmedContent,
        source: "desktop-feedback-page",
        language,
      });
      setContactType("");
      setContactValue("");
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

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "8px",
                }}
              >
                <div style={{ flex: "0 0 180px", minWidth: "180px" }}>
                  <label
                    htmlFor="feedback-contact-type"
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      marginBottom: "6px",
                    }}
                  >
                    {t("feedback.form.contactTypeLabel")}
                    <span style={{ color: "var(--color-error)", marginLeft: "4px" }}>
                      *
                    </span>
                  </label>
                  <div
                    style={{
                      ...getContactFieldShellStyle({ focused: contactTypeFocused }),
                      minHeight: "44px",
                    }}
                  >
                    <select
                      id="feedback-contact-type"
                      value={contactType}
                      onChange={(e) => {
                        setContactType(e.target.value as FeedbackContactType | "");
                        setContactValue("");
                      }}
                      onFocus={() => setContactTypeFocused(true)}
                      onBlur={() => setContactTypeFocused(false)}
                      style={{
                        ...getContactFieldControlStyle({ hasIcon: true }),
                        cursor: "pointer",
                      }}
                    >
                      <option value="">
                        {t("feedback.form.contactTypePlaceholder")}
                      </option>
                      {FEEDBACK_CONTACT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(FEEDBACK_CONTACT_TYPE_LABEL_KEY_MAP[type])}
                        </option>
                      ))}
                    </select>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        right: "10px",
                        transform: "translateY(-50%)",
                        width: "24px",
                        height: "24px",
                        borderRadius: "999px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "var(--secondary)",
                        color: "var(--muted-foreground)",
                        pointerEvents: "none",
                      }}
                    >
                      <ChevronDown size={14} strokeWidth={2.1} />
                    </div>
                  </div>
                </div>

                <div style={{ flex: "1 1 280px", minWidth: "240px" }}>
                  <label
                    htmlFor="feedback-contact-value"
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      marginBottom: "6px",
                    }}
                  >
                    {t("feedback.form.contactValueLabel")}
                    <span style={{ color: "var(--color-error)", marginLeft: "4px" }}>
                      *
                    </span>
                  </label>
                  <div
                    style={{
                      ...getContactFieldShellStyle({
                        focused: contactValueFocused,
                        disabled: !contactType,
                      }),
                      minHeight: "44px",
                    }}
                  >
                    <input
                      id="feedback-contact-value"
                      type={contactType === "email" ? "email" : "text"}
                      inputMode={contactType === "email" ? "email" : "text"}
                      disabled={!contactType}
                      value={contactValue}
                      onFocus={() => setContactValueFocused(true)}
                      onBlur={() => setContactValueFocused(false)}
                      onChange={(e) => setContactValue(e.target.value)}
                      placeholder={t(
                        getFeedbackContactValuePlaceholderKey(contactType),
                      )}
                      style={{
                        ...getContactFieldControlStyle(),
                        cursor: contactType ? "text" : "not-allowed",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "12px",
                  lineHeight: 1.6,
                  color: "var(--muted-foreground)",
                  marginBottom: "12px",
                }}
              >
                {t("feedback.form.contactHelp")}
              </div>

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
                  borderRadius: "12px",
                  background:
                    "linear-gradient(180deg, var(--background) 0%, var(--secondary) 100%)",
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
              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "18px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.6,
                    color: "var(--muted-foreground)",
                    marginBottom: "12px",
                  }}
                >
                  {t("feedback.contact.groupHint")}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {FEEDBACK_GROUP_CONTACT_CHANNELS.map((channel) => (
                    <ContactQrCard
                      key={channel.id}
                      title={t(channel.labelKey)}
                      description={t(channel.descriptionKey)}
                      imageSrc={GROUP_CONTACT_QR_CODE_MAP[channel.id]}
                    />
                  ))}
                </div>
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

function getContactFieldShellStyle(options: {
  focused: boolean;
  disabled?: boolean;
}): React.CSSProperties {
  const { focused, disabled = false } = options;

  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    borderRadius: "12px",
    border: focused ? "1px solid var(--ring)" : "1px solid var(--border)",
    background: disabled
      ? "var(--secondary)"
      : "linear-gradient(180deg, var(--background) 0%, var(--secondary) 100%)",
    boxShadow: focused
      ? "0 0 0 3px var(--primary-tint-border), var(--shadow-lg)"
      : "inset 0 1px 0 rgba(255,255,255,0.55), var(--shadow-sm)",
    transition: "border-color 160ms ease, box-shadow 160ms ease",
    opacity: disabled ? 0.74 : 1,
  };
}

function getContactFieldControlStyle(options?: {
  hasIcon?: boolean;
}): React.CSSProperties {
  return {
    width: "100%",
    padding: options?.hasIcon ? "11px 42px 11px 12px" : "11px 12px",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--foreground)",
    background: "transparent",
    border: "none",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  };
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

interface ContactQrCardProps {
  title: string;
  description: string;
  imageSrc: string;
}

function ContactQrCard({
  title,
  description,
  imageSrc,
}: ContactQrCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        padding: "16px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background:
          "linear-gradient(180deg, var(--background) 0%, var(--secondary) 100%)",
      }}
    >
      <img
        src={imageSrc}
        alt={title}
        style={{
          width: "100%",
          maxWidth: "160px",
          aspectRatio: "1 / 1",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          backgroundColor: "var(--primary-foreground)",
          objectFit: "contain",
        }}
      />
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--foreground)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "12px",
          lineHeight: 1.5,
          textAlign: "center",
          color: "var(--muted-foreground)",
        }}
      >
        {description}
      </div>
    </div>
  );
}
