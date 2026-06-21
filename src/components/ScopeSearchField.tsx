import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation, TranslationPath } from "@/i18n";

interface ScopeSearchFieldProps {
  onOpenPalette: () => void;
}

interface PageEntry {
  path: string;
  labelKey: TranslationPath;
}

const PAGES: PageEntry[] = [
  { path: "/", labelKey: "nav.skills" },
  { path: "/tools", labelKey: "nav.tools" },
  { path: "/marketplace", labelKey: "nav.marketplace" },
  { path: "/settings", labelKey: "nav.settings" },
  { path: "/feedback", labelKey: "nav.feedback" },
];

export function ScopeSearchField({ onOpenPalette }: ScopeSearchFieldProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Determine the current page from the pathname
  const currentPath = PAGES.find((p) => p.path === location.pathname)?.path ?? "/";
  const currentPage = PAGES.find((p) => p.path === currentPath)!;

  const filteredPages = PAGES.filter((p) =>
    t(p.labelKey).toLowerCase().includes(query.replace(/^\//, "").toLowerCase()),
  );

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  function selectPage(path: string) {
    navigate(path);
    setSwitcherOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (switcherOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSwitcherOpen(false);
        setQuery("");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % Math.max(filteredPages.length, 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filteredPages.length) % Math.max(filteredPages.length, 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const target = filteredPages[activeIdx];
        if (target) selectPage(target.path);
        return;
      }
    }
    // "/" opens the switcher
    if (e.key === "/" && !switcherOpen) {
      e.preventDefault();
      setSwitcherOpen(true);
    }
  }

  return (
    <div
      ref={dropdownRef}
      style={{ position: "relative", flex: 1, maxWidth: 520, margin: "0 auto" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 12px",
          background: "var(--secondary)",
          border: `1px solid ${switcherOpen ? "var(--ring)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          transition: "border-color 0.15s",
        }}
      >
        {switcherOpen ? (
          <span style={{ color: "var(--muted-foreground)", fontSize: 13 }}>/</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSwitcherOpen(true);
              inputRef.current?.focus();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "var(--muted)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "2px 8px",
              cursor: "pointer",
              flexShrink: 0,
            }}
            title={t("scope.switchTo")}
          >
            <span style={{ color: "var(--ember)", fontSize: 11 }}>✦</span>
            <span style={{ color: "var(--foreground)", fontSize: 12, fontWeight: 500 }}>
              {t(currentPage.labelKey)}
            </span>
            <span style={{ color: "var(--muted-foreground)", fontSize: 10 }}>▾</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            // When the switcher is open, the leading "/" is shown decoratively;
            // strip "/" from typed input so it isn't doubled in the field.
            const next = switcherOpen ? e.target.value.replace(/\//g, "") : e.target.value;
            setQuery(next);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!switcherOpen && query.startsWith("/")) setSwitcherOpen(true);
          }}
          placeholder={switcherOpen ? t("scope.typeToFilter") : t("topbar.search")}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--foreground)",
          }}
        />
        <button
          type="button"
          onClick={onOpenPalette}
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "1px 5px",
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {t("topbar.searchHint")}
        </button>
      </div>

      {switcherOpen && (
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 0,
            right: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 200,
            padding: 4,
          }}
          className="animate-slide-down"
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--muted-foreground)",
              padding: "6px 10px 4px",
            }}
          >
            {t("scope.switchTo")}
          </div>
          {filteredPages.map((page, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={page.path}
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => selectPage(page.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: isActive ? "var(--sidebar-accent)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ color: "var(--ember)", fontSize: 11 }}>✦</span>
                <span
                  style={{
                    fontSize: 12,
                    color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {t(page.labelKey)}
                </span>
              </button>
            );
          })}
          {filteredPages.length === 0 && (
            <div style={{ padding: "10px", fontSize: 12, color: "var(--muted-foreground)" }}>
              {t("commandPalette.noResults")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
