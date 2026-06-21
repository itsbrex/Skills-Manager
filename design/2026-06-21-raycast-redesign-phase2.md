# Raycast Redesign — Phase 2 (Shell + Primitives) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the left `Sidebar` with a 52px `TopBar` containing a scope-prefix search field (`/` to switch page, ⌘K opens palette), migrate the update-check + auth into the top bar, and elevate the `CommandPalette` to the full Raycast treatment (16px radius, GeistMono metadata labels, monochrome selection, kbd footer). All existing routes, page components, and `PageHeader` usage stay intact.

**Architecture:** `Layout.tsx` becomes `<TopBar> <main><Outlet/></main></TopBar>`. The `TopBar` renders: drag/traffic-light zone · brand · `ScopeSearchField` (current-page chip + `/` dropdown + ⌘K hint) · page-action slot (reserved for Phase 3 — pages still render their own `PageHeader` for now) · auth + update badge. `CommandPalette` is restyled in place. The `Sidebar`, `sidebarChrome.ts`, and its test are deleted. `PageHeader` deletion is **deferred to Phase 3** (all 5 pages still use it; removing it here would couple Phase 2 to the page rework and break shippability).

**Tech Stack:** React 19, react-router-dom v7, Tailwind v4, TypeScript, Tauri.

**Spec reference:** `design/2026-06-21-raycast-redesign-spec.md` §3 (Navigation & App Shell), §4.3 (Command Palette), §6 (Component Simplification).

**Prerequisite:** Phase 1 is merged to `main` (Raycast tokens, Inter+GeistMono bundled, hardcoded colors cleaned). Phase 2 builds on those tokens.

---

## Scope Boundaries (important)

**In scope (this plan):**
- New `TopBar.tsx`, `ScopeSearchField.tsx`.
- Rewrite `Layout.tsx` to use `TopBar` (drop `<Sidebar/>`).
- Elevate `CommandPalette.tsx` to Raycast spec.
- Delete `Sidebar.tsx`, `sidebarChrome.ts`, `sidebarChrome.test.ts`.
- New i18n keys for the scope dropdown and topbar labels.

**Explicitly deferred to Phase 3 (Pages):**
- Deleting `page-header.tsx` and moving page actions into the TopBar page-action slot. **PageHeader stays.** All 5 pages (Skills/Tools/Marketplace/Settings/Feedback) keep rendering their own header for now. This keeps Phase 2 independently shippable.
- Per-page card-grid redesigns, Settings sub-nav, Editor Monaco theme.
- Note: after Phase 2 there will be TWO header rows on each page — the TopBar (global) and the PageHeader (per-page). This is intentional and temporary; Phase 3 collapses them.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/components/TopBar.tsx` | The 52px global bar: drag zone, brand, scope search, auth, update badge | **Create** |
| `src/components/ScopeSearchField.tsx` | Search field with current-page chip + `/` dropdown switcher | **Create** |
| `src/components/layout/Layout.tsx` | App shell: `<TopBar/> <main><Outlet/></main>` + sync banner | Rewrite |
| `src/components/layout/Sidebar.tsx` | Old left nav (logic migrates to TopBar) | **Delete** |
| `src/components/layout/sidebarChrome.ts` | macOS chrome metrics (no longer needed — TopBar uses a fixed 52px drag zone) | **Delete** |
| `src/components/layout/sidebarChrome.test.ts` | Test for deleted module | **Delete** |
| `src/components/CommandPalette.tsx` | Elevated Raycast palette | Modify |
| `src/i18n/locales/en.ts` + `zh.ts` | New `topbar.*` and `scope.*` keys | Modify |

---

## Pre-flight

- [ ] **Step 0.1: Confirm clean tree and create feature branch**

Run: `git status --short`
Expected: empty (clean). If not empty, commit or stash before proceeding (do not start Phase 2 on a dirty tree).

```bash
git checkout main
git pull --ff-only 2>/dev/null || true
git checkout -b feat/raycast-redesign-phase2
```

- [ ] **Step 0.2: Verify Phase 1 is present**

Run: `grep -c "color-void-black\|--primary: #e6e6e6" src/index.css`
Expected: at least 1 match (confirms the Raycast dark tokens from Phase 1 are in `main`). If 0, stop — Phase 1 is not merged; do not proceed.

---

## Task 1: Add the i18n keys for the top bar and scope dropdown

All UI strings first — the components in later tasks reference these keys.

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/zh.ts`

- [ ] **Step 1.1: Add `topbar` and `scope` blocks to en.ts**

In `src/i18n/locales/en.ts`, find the existing `nav: { ... }` block (around line 29). Immediately AFTER the closing `}` of the `nav` block, insert two new blocks:

```ts
  topbar: {
    brand: "Skills",
    search: "Search skills, tools, actions…",
    searchHint: "⌘K",
  },
  scope: {
    switchTo: "Switch to",
    typeToFilter: "type to filter",
    navigate: "↑↓ navigate",
    select: "↵ select",
  },
```

- [ ] **Step 1.2: Add the same blocks to zh.ts**

In `src/i18n/locales/zh.ts`, in the same location (after the `nav` block), insert:

```ts
  topbar: {
    brand: "Skills",
    search: "搜索技能、工具、操作…",
    searchHint: "⌘K",
  },
  scope: {
    switchTo: "切换到",
    typeToFilter: "输入以筛选",
    navigate: "↑↓ 导航",
    select: "↵ 选择",
  },
```

- [ ] **Step 1.3: Verify build**

Run: `npm run build`
Expected: build completes with no errors. (The `as const` at the end of each locale file means the new keys are type-checked — if the two locales diverge, `tsc` fails here.)

- [ ] **Step 1.4: Commit**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/zh.ts
git commit -m "feat(i18n): add topbar and scope keys for Phase 2"
```

---

## Task 2: Create the ScopeSearchField component

The centerpiece interaction: a search field with the current page as a left chip, `/` to open a page-switcher dropdown, and a ⌘K hint.

**Files:**
- Create: `src/components/ScopeSearchField.tsx`

- [ ] **Step 2.1: Create the component**

Create `src/components/ScopeSearchField.tsx` with this exact content:

```tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "@/i18n";

interface ScopeSearchFieldProps {
  onOpenPalette: () => void;
}

interface PageEntry {
  path: string;
  labelKey: string;
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
          borderRadius: "var(--radius-md)",
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
          onChange={(e) => setQuery(e.target.value)}
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
```

Key behaviors:
- The chip (`✦ <PageName> ▾`) reflects `location.pathname` via `useLocation`.
- Clicking the chip OR typing `/` opens the dropdown.
- Plain typing (no `/`) is a non-functional placeholder in Phase 2 — it only filters the scope dropdown. Full content search is the ⌘K palette's job. This matches the spec §3.3 State A/B.
- ⌘K chip opens the full `CommandPalette` via `onOpenPalette`.
- Selection is monochrome (`var(--sidebar-accent)` fill) per the locked rule.
- The page list reuses the existing `nav.*` translation keys — no new per-page labels needed.

- [ ] **Step 2.2: Verify build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/components/ScopeSearchField.tsx
git commit -m "feat(shell): add ScopeSearchField with page-scope chip and / switcher"
```

---

## Task 3: Create the TopBar component

Migrates the Sidebar's update-check + auth into the top bar, plus the drag zone and brand.

**Files:**
- Create: `src/components/TopBar.tsx`

- [ ] **Step 3.1: Create the component**

Create `src/components/TopBar.tsx` with this exact content:

```tsx
import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/i18n";
import { checkUpdate } from "@/services/updater";
import { AuthButton } from "@/components/auth/AuthButton";
import { ScopeSearchField } from "@/components/ScopeSearchField";
import { UpdateInfo } from "@/types";

interface TopBarProps {
  onOpenPalette: () => void;
}

export function TopBar({ onOpenPalette }: TopBarProps) {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkUpdate()
      .then((info) => {
        if (info.has_update) setUpdateInfo(info);
      })
      .catch((err) => console.warn("Failed to check for updates:", err));
  }, []);

  async function handleUpdateClick() {
    if (updateInfo?.download_url) {
      await openUrl(updateInfo.download_url);
    }
  }

  return (
    <header
      style={{
        height: 52,
        minHeight: 52,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* Drag zone / traffic-light space — native window dragging */}
      <div
        onMouseDown={() => getCurrentWindow().startDragging()}
        data-tauri-drag-region
        style={{
          width: 72,
          height: "100%",
          flexShrink: 0,
          cursor: "grab",
          // @ts-ignore - WebKit specific property for native window dragging
          WebkitAppRegion: "drag",
        } as React.CSSProperties}
      />

      {/* Brand: ember ✦ + wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ color: "var(--ember)", fontSize: 14 }}>✦</span>
        <span
          style={{
            color: "var(--foreground)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {t("topbar.brand")}
        </span>
        {updateInfo?.has_update && (
          <button
            type="button"
            onClick={handleUpdateClick}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            title={`${t("settings.updateAvailable")}: ${updateInfo.latest_version}`}
            style={{
              marginLeft: 4,
              fontSize: 10,
              padding: "2px 8px",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              lineHeight: 1.4,
              flexShrink: 0,
              transition: "opacity 0.2s",
            }}
          >
            {t("marketplace.update")}
          </button>
        )}
      </div>

      {/* Center scope search */}
      <ScopeSearchField onOpenPalette={onOpenPalette} />

      {/* Right: auth */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        <AuthButton variant="sidebar" />
      </div>
    </header>
  );
}
```

Notes:
- The update-check logic is lifted verbatim from `Sidebar.tsx` (lines 55–71 of the old file).
- The drag zone uses `getCurrentWindow().startDragging()` + `WebkitAppRegion: "drag"`, matching the old Sidebar behavior (the old Layout also had a separate transparent drag div — that is removed in Task 4; this TopBar drag zone replaces it).
- `AuthButton variant="sidebar"` is reused as-is (Phase 1 already re-pointed its hover to `var(--sidebar-accent)`). In a dense top bar it may want a compact variant later, but that's a Phase 3 polish concern — keep the existing variant for now.

- [ ] **Step 3.2: Verify build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat(shell): add TopBar with brand, scope search, auth, update badge"
```

---

## Task 4: Rewrite Layout to use TopBar, delete Sidebar

Wire the new shell together and remove the old sidebar.

**Files:**
- Rewrite: `src/components/layout/Layout.tsx`
- Delete: `src/components/layout/Sidebar.tsx`
- Delete: `src/components/layout/sidebarChrome.ts`
- Delete: `src/components/layout/sidebarChrome.test.ts`
- Modify: `src/App.tsx` (pass `onOpenPalette` through to Layout)

- [ ] **Step 4.1: Rewrite Layout.tsx**

Replace the full contents of `src/components/layout/Layout.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { TopBar } from "@/components/TopBar";
import { SyncReport, LinkReport } from "@/types";
import { useTranslation } from "@/i18n";

interface LayoutProps {
  onOpenPalette: () => void;
}

export function Layout({ onOpenPalette }: LayoutProps) {
  const { t } = useTranslation();
  const [remainingIssues, setRemainingIssues] = useState<number>(0);
  const [autoFixedCount, setAutoFixedCount] = useState<number>(0);
  const [showBanner, setShowBanner] = useState(false);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    void autoCheckAndFix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function autoCheckAndFix() {
    try {
      const report = await invoke<SyncReport>("check_sync_status");
      if (report.issues_count === 0) {
        return;
      }
      const result = await invoke<LinkReport>("fix_sync_issues");
      const failed = result.failed.length;
      if (failed === 0) {
        return;
      }
      setAutoFixedCount(result.success.length);
      setRemainingIssues(failed);
      setShowBanner(true);
    } catch (err) {
      console.error("Failed to auto-fix sync issues:", err);
    }
  }

  async function handleRetry() {
    setFixing(true);
    try {
      const result = await invoke<LinkReport>("fix_sync_issues");
      const success = result.success.length;
      const failed = result.failed.length;
      if (failed === 0) {
        setShowBanner(false);
      } else {
        setAutoFixedCount((prev) => prev + success);
        setRemainingIssues(failed);
      }
    } catch (err) {
      console.error("Failed to fix sync issues:", err);
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className="flex flex-col h-screen relative">
      <TopBar onOpenPalette={onOpenPalette} />
      <main className="flex-1 overflow-auto bg-background relative">
        {showBanner && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "12px 24px",
              backgroundColor: "var(--color-warning-bg)",
              borderBottom: "1px solid var(--color-warning-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 100,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontSize: "14px", color: "var(--color-warning)" }}>
                {autoFixedCount > 0
                  ? t("sync.autoFixPartial")
                      .replace("{success}", String(autoFixedCount))
                      .replace("{failed}", String(remainingIssues))
                  : t("sync.issuesDetected").replace("{count}", String(remainingIssues))}
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleRetry}
                disabled={fixing}
                style={{
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#fff",
                  backgroundColor: "var(--color-warning)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: fixing ? "wait" : "pointer",
                  opacity: fixing ? 0.7 : 1,
                }}
              >
                {fixing ? t("sync.fixing") : t("sync.retryFix")}
              </button>
              <button
                onClick={() => setShowBanner(false)}
                style={{
                  padding: "6px 8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-warning)",
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
```

Changes from the old Layout:
- Root is now `flex flex-col` (vertical: TopBar on top, main below) instead of `flex` (horizontal: Sidebar + main).
- `<Sidebar />` → `<TopBar onOpenPalette={onOpenPalette} />`.
- The separate transparent 52px drag-region div is **removed** — the TopBar's own drag zone (72px) now handles window dragging. This is deliberate: the old transparent div was a workaround for the sidebar layout; with a real top bar, the bar itself is the drag surface.
- `Layout` now takes an `onOpenPalette` prop (so the ScopeSearchField's ⌘K chip can open the palette).
- The sync banner JSX is preserved verbatim (Phase 1 already tokenized it).

- [ ] **Step 4.2: Pass onOpenPalette to Layout in App.tsx**

In `src/App.tsx`, the route currently is:
```tsx
<Route path="/" element={<Layout />}>
```
Change it to:
```tsx
<Route path="/" element={<Layout onOpenPalette={() => setPaletteOpen(true)} />}>
```
`paletteOpen` and `setPaletteOpen` already exist in App (line 55). No new state needed.

- [ ] **Step 4.3: Delete the Sidebar and its chrome files**

Run:
```bash
git rm src/components/layout/Sidebar.tsx
git rm src/components/layout/sidebarChrome.ts
git rm src/components/layout/sidebarChrome.test.ts
```

Before deleting, confirm nothing else imports them:
```bash
grep -rn "layout/Sidebar\|sidebarChrome" src/ || echo "no other references — safe"
```
Expected: `no other references — safe`. If any reference appears, stop and investigate (do not delete while imported).

- [ ] **Step 4.4: Verify build**

Run: `npm run build`
Expected: build completes with no errors. (If `tsc` reports a missing `Sidebar` import anywhere, that file was missed in the grep — add it to the deletion or fix the import.)

- [ ] **Step 4.5: Commit**

```bash
git add -A
git commit -m "feat(shell): rewrite Layout to use TopBar, remove Sidebar

Layout is now TopBar + main (vertical flex). The Sidebar,
sidebarChrome metrics, and their test are deleted — the TopBar
owns the drag zone, brand, scope search, auth, and update badge.
App.tsx passes onOpenPalette through to Layout."
```

---

## Task 5: Elevate the CommandPalette to the Raycast spec

Restyle the palette in place: 16px radius, GeistMono metadata labels on results, monochrome selection, kbd footer. The search/navigation logic is unchanged — this is a visual lift only.

**Files:**
- Modify: `src/components/CommandPalette.tsx`

- [ ] **Step 5.1: Update the modal container radius and shadow**

In `src/components/CommandPalette.tsx`, find the palette container `<div>` (around line 303) with:
```tsx
          borderRadius: "14px",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.32)",
```
Replace those three lines with:
```tsx
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-xl)",
```
(`--radius-xl` is 16px and `--shadow-xl` is the Raycast layered shadow from Phase 1.)

- [ ] **Step 5.2: Upgrade the ESC kbd to GeistMono and Raycast tokens**

Find the `<kbd>` for ESC (around line 347). Replace its `style` object:
```tsx
            style={{
              fontSize: "11px",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "2px 8px",
              fontFamily: "ui-monospace, monospace",
            }}
```
with:
```tsx
            style={{
              fontSize: "10px",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "1px 6px",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
```

- [ ] **Step 5.3: Add a metadata label to each result row**

Each `CommandItem` needs a right-side GeistMono label. First, add a `meta` field to the interface. Find (line 8):
```tsx
interface CommandItem {
  id: string;
  label: string;
  description?: string;
  section: string;
  icon?: "skill" | "market" | "settings" | "nav";
  action: () => void;
}
```
Add a `meta` field:
```tsx
interface CommandItem {
  id: string;
  label: string;
  description?: string;
  meta?: string;
  section: string;
  icon?: "skill" | "market" | "settings" | "nav";
  action: () => void;
}
```

Then in the `items` `useMemo` (around line 165), add `meta` to each item kind:
- Navigation items: `meta: "NAV"` — add to each of the 5 nav item objects after the `icon` field.
- Settings items: `meta: "SETTING"` — add to each of the 6 settings item objects.
- Local skills: `meta: "SKILL"` — in the `.map` that builds local-skill items, add `meta: "SKILL"`.
- Marketplace skills: `meta: "SKILL"` — same, in the marketplace `.map`.

Example for one nav item:
```tsx
{ id: "nav-skills", label: t("commandPalette.navSkills"), meta: "NAV", section: t("commandPalette.sectionNavigation"), icon: "nav", action: goToSkills },
```

- [ ] **Step 5.4: Render the meta label in the result row**

In the result-row button (around line 402), the inner content currently ends with the description span inside a column flex. After that column `</span>`, but still inside the button, add the meta label. Find this block:

```tsx
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "var(--foreground)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.label}
                        </span>
                        {item.description && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--muted-foreground)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.description}
                          </span>
                        )}
                      </span>
                    </button>
```

Replace the closing `</span></button>` portion — insert the meta label between the column `</span>` and `</button>`:

```tsx
                      </span>
                      {item.meta && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontFamily: "var(--font-mono)",
                            letterSpacing: "0.02em",
                            color: "var(--muted-foreground)",
                            background: "var(--secondary)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            padding: "1px 5px",
                            flexShrink: 0,
                          }}
                        >
                          {item.meta}
                        </span>
                      )}
                    </button>
```

- [ ] **Step 5.5: Restyle the section header to Raycast spec**

Find the section-header div (around line 385):
```tsx
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                    padding: "8px 10px 4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
```
Replace the style with the Raycast two-register tracking:
```tsx
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                    padding: "8px 10px 4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
```

- [ ] **Step 5.6: Update the footer kbd style to GeistMono tokens**

Find the `kbdStyle` const (around line 486):
```tsx
const kbdStyle: React.CSSProperties = {
  fontSize: "10px",
  backgroundColor: "var(--secondary)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  padding: "1px 5px",
  fontFamily: "ui-monospace, monospace",
  color: "var(--foreground)",
};
```
Replace with:
```tsx
const kbdStyle: React.CSSProperties = {
  fontSize: "10px",
  backgroundColor: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "1px 5px",
  fontFamily: "var(--font-mono)",
  color: "var(--foreground)",
};
```

- [ ] **Step 5.7: Add ↵ select and esc dismiss to the footer legend**

The footer (around line 461) currently shows only `↑↓ navigate`. Extend it to show the full Raycast legend. Find:
```tsx
          <div style={{ display: "flex", gap: "10px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <kbd style={kbdStyle}>↑</kbd>
              <kbd style={kbdStyle}>↓</kbd>
              {t("commandPalette.navigate")}
            </span>
          </div>
```
Replace with:
```tsx
          <div style={{ display: "flex", gap: "14px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <kbd style={kbdStyle}>↑</kbd>
              <kbd style={kbdStyle}>↓</kbd>
              {t("commandPalette.navigate")}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <kbd style={kbdStyle}>↵</kbd>
              {t("scope.select")}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <kbd style={kbdStyle}>esc</kbd>
            </span>
          </div>
```

- [ ] **Step 5.8: Verify build**

Run: `npm run build`
Expected: build completes with no errors. The `meta` field is optional on the interface, so items without it still typecheck; but every item kind was given a meta in Step 5.3, so all rows render the label.

- [ ] **Step 5.9: Commit**

```bash
git add src/components/CommandPalette.tsx
git commit -m "feat(palette): elevate CommandPalette to Raycast spec

16px radius, --shadow-xl, GeistMono metadata labels on each result,
monochrome selection, and a full ↑↓ ↵ esc footer legend."
```

---

## Task 6: Phase 2 acceptance verification

- [ ] **Step 6.1: Build passes**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 6.2: Unit tests still pass**

Run: `npm test`
Expected: 3 fontFamily tests pass (unchanged from Phase 1; no new tests in Phase 2 — the shell is UI, not pure logic).

- [ ] **Step 6.3: No stale references to deleted modules**

Run:
```bash
grep -rn "layout/Sidebar\|sidebarChrome\|<Sidebar" src/ || echo "clean"
```
Expected: `clean`.

- [ ] **Step 6.4: Manual visual smoke test in Tauri window**

Run: `npm run tauri dev`

This is a Tauri app — the web view errors without the Tauri runtime, so verification MUST happen in the native window (do NOT use `npm run dev` in a browser).

Verify in BOTH light and dark themes:
1. The left sidebar is **gone**. A 52px top bar spans the full width at the top.
2. The top bar shows (left → right): drag zone · `✦ Skills` brand · centered search field with a `✦ Skills ▾` chip · auth button.
3. **Window dragging** still works — click-and-drag on the top bar's left area moves the window (macOS traffic lights sit in this zone).
4. Click the `✦ Skills ▾` chip → a dropdown lists all 5 pages; click one to navigate. The chip updates to reflect the new page.
5. Type `/` in the field → same dropdown opens. Type a page name to filter; ↑↓ to move; ↵ to select.
6. The ⌘K chip opens the full command palette: 16px rounded corners, each result has a right-side GeistMono label (NAV / SETTING / SKILL), footer shows `↑↓ navigate · ↵ select · esc`.
7. Selected palette row uses a plain monochrome fill (no colored accent).
8. The sync banner (if triggered) still renders with warning tokens.
9. All 5 pages still render their own `PageHeader` below the top bar (expected — two header rows during Phase 2; collapsed in Phase 3).
10. No functionality regressed: navigate to every page, open the palette, search, toggle a switch, check the auth button.

If any fail, stop and fix before declaring Phase 2 done.

- [ ] **Step 6.5: Commit any verification fixes**

If 6.1–6.4 surfaced fixes:
```bash
git add -A
git commit -m "fix(shell): phase 2 verification fixes"
```

---

## Phase 2 Completion

After Task 6 passes:
- Sidebar is gone; the TopBar + ScopeSearchField are the primary navigation.
- `/` switches pages; ⌘K opens the elevated palette.
- Update-check and auth migrated into the top bar (no functionality lost).
- The app remains fully functional with the Raycast aesthetic.
- `PageHeader` is retained (Phase 3 removes it and collapses the two header rows).

**Next:** Write the Phase 3 plan (Pages — per-page card grids, Settings sub-nav, Editor Monaco theme, PageHeader removal). Do not start Phase 3 until Phase 2 is merged and visually verified in the Tauri window.
