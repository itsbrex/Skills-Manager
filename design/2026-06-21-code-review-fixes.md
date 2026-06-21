# Skills Manager — Code Review Fixes (post Raycast redesign)

> **Status:** Implementation plan — 2026-06-21
> **Trigger:** Code review of `origin/main..HEAD` (39 commits, 48 files, +5645 / −1097)
> **Scope:** Correctness and maintainability fixes only — no visual redesign, no feature changes.
> **Baseline health:** `npx tsc --noEmit` passes; `npm test` (node:test) passes 3/3; no dangling references after the Sidebar removal.

---

## 0. How to read this doc

Six fixes, ordered **correctness → readability → cleanup**. Each is independent, < 15 diff lines, and meant to be a standalone commit. Verification commands are listed in §7.

Priority key:

- **P0** — correctness bug users can hit (dark-mode unreadable text, fragile architecture).
- **P1** — correctness/cleanup, smaller blast radius.
- **P2** — pure cleanup, optional.

---

## 1. Fix 1 (P0) — Rewrite `PageHeaderContext` external store with `useRef`

**File:** `src/components/PageHeaderContext.tsx:29-47`

### Problem

The actions-portal target is stored as a `let` binding + a `Set` of listeners, both declared *inside the component body* and kept "shared" by freezing the callbacks with `useCallback(fn, [])`:

```ts
let actionsTarget: HTMLElement | null = null;
const actionsListeners = new Set<(node: HTMLElement | null) => void>();

const registerActionsTarget = useCallback((node: HTMLElement | null) => {
  actionsTarget = node;
  actionsListeners.forEach((cb) => cb(node));
}, []);

const subscribeActionsTarget = useCallback((cb) => {
  actionsListeners.add(cb);
  cb(actionsTarget);
  return () => { actionsListeners.delete(cb); };
}, []);
```

The inline comment claims this is an "external subscription (not React state)". It is not — it's a frozen-closure trick that works only because of two fragile coincidences:

1. `<React.StrictMode>` is on (`src/main.tsx:11`). StrictMode double-mounts the Provider; on the first unmount, nothing clears the residual entries in the first-render `Set`. Currently harmless by luck, not by design.
2. If anyone changes the `[]` deps, wraps the Provider in `memo`, or extracts the callbacks, sharing silently breaks. The symptom (TopBar's actions slot receives no portal target → page actions vanish) is extremely hard to trace back to this.

This module is the load-bearing wall of the whole TopBar + actions-portal scheme.

### Change

Replace the `let` + `Set` with refs. The consumer hooks (`useRegisterPageHeader`, `useActionsTarget`, `usePageSearch`) stay unchanged — they only depend on the two callbacks' signatures.

```ts
const actionsTargetRef = useRef<HTMLElement | null>(null);
const listenersRef = useRef(new Set<(node: HTMLElement | null) => void>());

const registerActionsTarget = useCallback((node: HTMLElement | null) => {
  actionsTargetRef.current = node;
  listenersRef.current.forEach((cb) => cb(node));
}, []);

const subscribeActionsTarget = useCallback(
  (cb: (node: HTMLElement | null) => void) => {
    listenersRef.current.add(cb);
    cb(actionsTargetRef.current); // replay current value on subscribe
    return () => {
      listenersRef.current.delete(cb);
    };
  },
  [],
);
```

Delete lines 29–30 (`let actionsTarget`, `const actionsListeners = new Set(...)`).

### Verify

- `npx tsc --noEmit`
- Manual: switch between Skills / Marketplace / Settings (the three pages with header actions) and confirm the TopBar actions slot renders each page's buttons correctly.

---

## 2. Fix 2 (P0) — Define dark-mode base values for semantic colors

**File:** `src/index.css:182-193` (the `.dark` semantic block)

### Problem

The `.dark` block overrides `--color-{error,success,warning,info}-bg` and `-border`, but **not** the base tokens themselves. They inherit the light-mode values:

| Token | Light (`:root` line 112–116) | Inherits into dark | Issue on `--background #040506` |
|---|---|---|---|
| `--color-warning` | `#ca8a04` | `#ca8a04` | Dark gold on near-black; marginal contrast, blends with `--color-warning-bg #3a2f06` |
| `--color-success` | `#16a34a` | `#16a34a` | Used as text/icon in 12+ places (Skills, Tools, Settings, Marketplace, BatchManage) — too dim |
| `--color-error` | `#d32f2f` | `#d32f2f` | Used as error text — low luminance on black |
| `--color-info` | `#2563eb` | `#2563eb` | Too dark on black |

Verified usage of these four base tokens: `Layout.tsx`, `Editor.tsx`, `Feedback.tsx`, `Marketplace.tsx`, `Settings.tsx`, `Skills.tsx`, `Tools.tsx`, `SkillDetailModal.tsx`, `TelemetryConsentDialog.tsx`, `ImportSkillsStep.tsx`, `BatchManageToolsDialog.tsx`.

### Change

Append four lines to the `.dark` semantic block (after `--color-warning-border`, keep the `*-bg`/`*-border` overrides untouched):

```css
/* Semantic base colors — lift luminance for dark backgrounds */
--color-error: #f87171;
--color-success: #4ade80;
--color-warning: #eab308;
--color-info: #60a5fa;
```

Each pair keeps a coherent lightness ladder: base < border < bg (for fill chips), which matches how the existing `*-bg`/`*-border` dark values were authored.

### Verify

- Manual: toggle dark mode. Check the sync banner (`Layout.tsx`), installed/uninstall badges (`Marketplace.tsx`), LLM saved-state text (`Settings.tsx:329`), tool-detected indicator (`Tools.tsx:837`).

---

## 3. Fix 3 (P1) — GithubInstallDialog: dark-mode white-on-light bug

**File:** `src/pages/Marketplace.tsx:1916-1918`

### Problem

```ts
border: "1px solid var(--color-primary)",
backgroundColor: "var(--color-primary)",
color: "white",
```

`--color-primary` aliases `--primary`, which in dark mode is `#e6e6e6` (near-white). Literal `color: "white"` on a near-white background is effectively invisible.

### Change

Use the calibrated semantic pair so both themes resolve correctly:

```ts
border: "1px solid var(--primary)",
backgroundColor: "var(--primary)",
color: "var(--primary-foreground)",
```

In dark mode this resolves to `#e6e6e6` bg + `#2f3031` text (dark-on-light, correct); in light mode `#1a1a1a` bg + `#fff` text (unchanged visual).

**Do not touch** the nearby `UninstallConfirmDialog` (`Marketplace.tsx:1726-1727`) — its `--color-error` bg + `white` is correct after Fix 2 raises the dark `--color-error` luminance.

### Verify

- Manual: open the GitHub-install dialog in dark mode; the submit button text must be readable.

---

## 4. Fix 4 (P1) — Remove redundant TopBar drag-region implementations

**File:** `src/components/TopBar.tsx:57-68`

### Problem

The drag zone carries three overlapping mechanisms:

```tsx
<div
  onMouseDown={() => getCurrentWindow().startDragging()}   // (a) manual
  data-tauri-drag-region                                    // (b) declarative
  style={{
    // ...
    // @ts-ignore - WebKit specific property for native window dragging
    WebkitAppRegion: "drag",                                // (c) dead
  } as React.CSSProperties}
/>
```

Tauri's WebView2/WKWebView does not honor `-webkit-app-region`; (c) is dead code, and the `@ts-ignore` masks a real type gap. (a) and (b) are both live and redundant.

### Change

Drop (c) entirely; keep (a) + (b) (belt-and-suspenders is fine, both are live):

```tsx
<div
  onMouseDown={() => getCurrentWindow().startDragging()}
  data-tauri-drag-region
  style={{ width: 72, height: "100%", flexShrink: 0, cursor: "grab" }}
/>
```

Removes the `@ts-ignore` and the `as React.CSSProperties` cast.

### Verify

- Manual (macOS): press and hold the empty area left of the brand mark and drag the window. Movement should work.

---

## 5. Fix 5 (P2) — Delete dead gradient tokens

**File:** `src/index.css` — lines 136–138 (`:root`), 210–212 (`.dark`)

### Problem (verified)

`--gradient-nebula` and `--gradient-violet` are defined in both `:root` and `.dark` but referenced **nowhere** under `src/` (grep across `.tsx`/`.css`/`.ts`). The only matches are index.css itself defining them, plus historical mentions in `design/*.md` logs. Commit `8011e38` ("remove atmosphere gradient blobs") removed the consumers; the token definitions were left behind.

### Change

Remove from `:root`:

```
/* Atmosphere gradients (hero / settings only) */
--gradient-nebula: radial-gradient(...);
--gradient-violet: radial-gradient(...);
```

Remove the equivalent two lines (and the matching comment) from `.dark`.

### Verify

- `npx tsc --noEmit` (no type impact expected).

---

## 6. Fix 6 (P2, optional) — Archive phase execution logs

**Not a code defect.** Raised during review as a maintainability note.

`design/2026-06-21-raycast-redesign-phase{1..4}.md` (~3900 lines combined) are execution logs from the redesign. They are valuable as decision records but heavy as long-lived repo artifacts.

**Recommendation:** out of scope for this fixes doc. If pursued, do it as a separate PR: keep `design/2026-06-21-raycast-redesign-spec.md` + `DESIGN.md`, move `phase1..4.md` to a `docs/archive/` folder or project wiki. **Do not bundle with Fixes 1–5.**

---

## 7. Execution order and verification

Each fix = one commit (independent, individually revertible).

| Order | Fix | Priority | Why this order |
|---|---|---|---|
| 1 | **Fix 2 + Fix 3** together | P0 | User-visible dark-mode bugs; smallest diffs; clears the visible defect surface first. |
| 2 | **Fix 1** | P0 | Only item with logic risk; isolate its commit for easy rollback. |
| 3 | **Fix 4 + Fix 5** together | P1/P2 | Pure cleanup; no behavioral risk. |
| 4 | (optional) **Fix 6** | P2 | Separate PR. |

### Per-commit gates

- `npx tsc --noEmit` — must pass after every fix.
- `npm test` — must stay green (currently 3/3). Only Fix 1 could plausibly affect runtime; run this after Fix 1.

### Final regression (after all of 1–5)

1. `npx tsc --noEmit`
2. `npm test` — expect 3/3 pass.
3. Manual smoke (both light and dark themes):
   - Switch Skills → Marketplace → Settings; confirm TopBar actions render per page.
   - Trigger the sync warning banner; confirm readable in dark mode.
   - Open the GitHub-install dialog; confirm submit button readable in dark mode.
   - Drag the window by the area left of the brand mark.
