import type { CSSProperties, MouseEvent } from "react";

interface TranslateIconButtonProps {
  hasTranslation: boolean;
  showingTranslation: boolean;
  translating: boolean;
  onClick: (event: MouseEvent) => void;
  translateLabel: string;
  showOriginalLabel: string;
  showTranslationLabel: string;
  translatingLabel: string;
  size?: number;
}

export function TranslateIconButton({
  hasTranslation,
  showingTranslation,
  translating,
  onClick,
  translateLabel,
  showOriginalLabel,
  showTranslationLabel,
  translatingLabel,
  size = 28,
}: TranslateIconButtonProps) {
  const tooltip = translating
    ? translatingLabel
    : hasTranslation
      ? showingTranslation
        ? showOriginalLabel
        : showTranslationLabel
      : translateLabel;

  const color = showingTranslation
    ? "var(--primary)"
    : hasTranslation
      ? "var(--primary)"
      : "var(--muted-foreground)";

  const opacity = translating ? 0.5 : 1;

  const buttonStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    padding: 0,
    border: "none",
    borderRadius: 8,
    background: showingTranslation ? "color-mix(in srgb, var(--primary) 14%, transparent)" : "transparent",
    color,
    cursor: translating ? "wait" : "pointer",
    opacity,
    transition: "background-color 0.15s ease, color 0.15s ease",
    flexShrink: 0,
  };

  return (
    <button
      type="button"
      aria-label={tooltip}
      title={tooltip}
      onClick={(e) => {
        e.stopPropagation();
        if (translating) return;
        onClick(e);
      }}
      disabled={translating}
      style={buttonStyle}
      onMouseEnter={(e) => {
        if (translating) return;
        if (!showingTranslation) {
          e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.06)";
        }
      }}
      onMouseLeave={(e) => {
        if (translating) return;
        e.currentTarget.style.backgroundColor = showingTranslation
          ? "color-mix(in srgb, var(--primary) 14%, transparent)"
          : "transparent";
      }}
    >
      {translating ? (
        <svg width={Math.floor(size * 0.5)} height={Math.floor(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 0.8s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg width={Math.floor(size * 0.5)} height={Math.floor(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 8 6 6" />
          <path d="m4 14 6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="m22 22-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
      )}
      {hasTranslation && !showingTranslation && !translating && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "var(--primary)",
            border: "1px solid var(--background)",
          }}
        />
      )}
    </button>
  );
}
