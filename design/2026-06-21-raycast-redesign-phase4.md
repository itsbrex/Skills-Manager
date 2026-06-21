# Raycast Redesign — Phase 4 (Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The final polish layer. Add the Raycast motion system (outQuint entrances, 200ms micro-interactions), a custom Monaco theme matching the Raycast palette, section atmosphere gradients on the Settings panel and Welcome hero, and consistent empty/focus states across all pages. After Phase 4 the redesign is complete end-to-end.

**Architecture:** No structural changes — the shell (Phase 2), tokens (Phase 1), and page bodies (Phase 3) are all in place. Phase 4 adds three self-contained layers: (1) CSS animation primitives in `index.css`, (2) a Monaco theme registered once at runtime, (3) gradient atmosphere backgrounds. Each layer is independent and independently shippable.

**Tech Stack:** React 19, Tailwind v4 (CSS only), `@monaco-editor/react`, TypeScript, Tauri.

**Spec reference:** `design/2026-06-21-raycast-redesign-spec.md` §5.6 (Editor Monaco theme), §5.7 (Welcome hero), §7 Phase 4 (Polish), Animation Philosophy (§ from DESIGN.md).

**Prerequisite:** Phases 1–3 merged. Verified: `--primary-tint`/`--surface-hover` tokens exist, Settings sub-nav in place, no GitHub-blue in `src/pages`, build passes.

---

## Scope Boundaries (important)

**In scope (this plan):**
- Raycast motion system: `outQuint` entrance keyframes + 200ms `ease` micro-interaction defaults in `index.css`.
- Apply entrance animations to: page content on route change, dropdowns (already partially via `animate-slide-down`), modals/dialogs, command palette.
- Custom Monaco theme ("raycast-dark" + "raycast-light") with token colors matching the void-black canvas.
- Atmosphere gradient backdrops: Settings right panel, Welcome hero step.
- Focus-visible state audit: ensure every interactive element has a visible focus ring using `var(--ring)`.
- Empty-state consistency: Skills/Marketplace/Tools empty states share one layout.

**Explicitly out of scope:**
- Full Tailwind migration of page bodies (would re-touch every inline style — not polish, it's a rewrite).
- Card component extraction (SkillCard/ToolCard) — deferred indefinitely; the inline cards work.
- Performance optimization (chunk splitting, lazy loading) — unrelated to the redesign.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/index.css` | Motion keyframes + utility classes + focus-visible base | Modify |
| `src/components/editor/raycastMonacoTheme.ts` | Monaco theme definition + registration | **Create** |
| `src/pages/Editor.tsx` | Register theme before mount; use "raycast-dark"/"raycast-light" | Modify |
| `src/pages/Settings.tsx` | Atmosphere gradient on right panel | Modify |
| `src/components/welcome/WelcomeStep.tsx` | Atmosphere gradient on hero | Modify |
| `src/pages/Skills.tsx` | Apply entrance animation + empty-state consistency | Modify |
| `src/pages/Marketplace.tsx` | Apply entrance animation + empty-state consistency | Modify |
| `src/pages/Tools.tsx` | Apply entrance animation + empty-state consistency | Modify |
| `src/components/CommandPalette.tsx` | Apply entrance animation on open | Modify |

---

## Pre-flight

- [ ] **Step 0.1: Confirm clean tree and create feature branch**

Run: `git status --short`
Expected: empty. Phase 3 changes must be committed first (they're currently uncommitted in the working tree — commit them before starting Phase 4):

```bash
git add -A
git commit -m "feat(theme): Phase 3 — page token sweep + Settings sub-nav

(applied per design/2026-06-21-raycast-redesign-phase3.md)"
git checkout -b feat/raycast-redesign-phase4
```

If the user has already committed Phase 3, the `git add -A && commit` will be a no-op; proceed to the branch creation.

- [ ] **Step 0.2: Verify Phases 1–3 are present**

Run: `grep -c "primary-tint" src/index.css && grep -c "activeSection" src/pages/Settings.tsx && grep -c "ScopeSearchField" src/components/TopBar.tsx`
Expected: all ≥ 1. If any is 0, prerequisites missing — stop.

---

## Task 1: Motion system in `index.css`

Add the Raycast animation primitives. Per DESIGN.md Animation Philosophy: 200ms `ease` for micro-interactions, `cubic-bezier(0.23, 1, 0.32, 1)` (outQuint) for entrances, nothing > 700ms.

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1.1: Add the keyframes + utility classes**

In `src/index.css`, after the existing `@keyframes spin { ... }` block (around line 265), insert:

```css
/* ===== Raycast motion system =====
   Entrances use outQuint (cubic-bezier(0.23, 1, 0.32, 1)): fast attack, long settle.
   Micro-interactions (color/opacity/shadow) default to 200ms ease.
   Nothing exceeds 700ms. */

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Page content entrance — applied to each page's main content wrapper. */
.animate-page-enter {
  animation: fadeInUp 280ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

/* Dropdown / popover entrance. */
.animate-popover {
  animation: scaleIn 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

/* Modal / dialog entrance. */
.animate-modal {
  animation: fadeInUp 240ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
```

- [ ] **Step 1.2: Add a focus-visible base rule**

In the `@layer base { ... }` block, after the existing `body { ... }` rule, add:

```css
  /* Visible focus ring for keyboard navigation. Uses --ring token so it
     adapts to both themes. Only applies to keyboard focus, not mouse clicks. */
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    border-radius: var(--radius);
  }
```

- [ ] **Step 1.3: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 1.4: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): Raycast motion system + focus-visible base

Adds fadeInUp/fadeIn/scaleIn keyframes with outQuint easing
(cubic-bezier(0.23,1,0.32,1)), .animate-page-enter/.popover/.modal
utility classes, and a :focus-visible ring using var(--ring)."
```

---

## Task 2: Custom Monaco theme

Replace the built-in `vs-dark`/`light` with Raycast-flavored themes matching the void-black canvas.

**Files:**
- Create: `src/components/editor/raycastMonacoTheme.ts`
- Modify: `src/pages/Editor.tsx`

- [ ] **Step 2.1: Create the theme definition module**

Create `src/components/editor/raycastMonacoTheme.ts`:

```ts
import type { editor } from "monaco-editor";

export const RAYCAST_MONACO_THEME_DARK = "raycast-dark";
export const RAYCAST_MONACO_THEME_LIGHT = "raycast-light";

const darkThemeData: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "e6edf3" },
    { token: "comment", foreground: "6a6b6c", fontStyle: "italic" },
    { token: "keyword", foreground: "ff6363" },
    { token: "string", foreground: "59d499" },
    { token: "number", foreground: "56c2ff" },
    { token: "type", foreground: "56c2ff" },
    { token: "function", foreground: "e6e6e6" },
    { token: "variable", foreground: "e6edf3" },
    { token: "tag", foreground: "ff6363" },
    { token: "attribute.name", foreground: "56c2ff" },
  ],
  colors: {
    "editor.background": "#040506",
    "editor.foreground": "#e6edf3",
    "editorLineNumber.foreground": "#454647",
    "editorLineNumber.activeForeground": "#9c9c9d",
    "editor.selectionBackground": "#1b1c1e",
    "editor.lineHighlightBackground": "#07080a",
    "editorCursor.foreground": "#e6e6e6",
    "editorWhitespace.foreground": "#1b1c1e",
    "editorIndentGuide.background": "#111214",
    "editorIndentGuide.activeBackground": "#363739",
    "editorGutter.background": "#040506",
    "editorBracketMatch.background": "#1b1c1e",
    "editorBracketMatch.border": "#363739",
    "scrollbarSlider.background": "#36373980",
    "scrollbarSlider.hoverBackground": "#45464780",
    "editorWidget.background": "#07080a",
    "editorWidget.border": "#363739",
    "input.background": "#111214",
    "input.border": "#363739",
    "dropdown.background": "#07080a",
    "dropdown.border": "#363739",
  },
};

const lightThemeData: editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "", foreground: "1a1a1a" },
    { token: "comment", foreground: "6a6b6c", fontStyle: "italic" },
    { token: "keyword", foreground: "d32f2f" },
    { token: "string", foreground: "16a34a" },
    { token: "number", foreground: "2563eb" },
    { token: "type", foreground: "2563eb" },
    { token: "function", foreground: "1a1a1a" },
    { token: "variable", foreground: "1a1a1a" },
    { token: "tag", foreground: "d32f2f" },
    { token: "attribute.name", foreground: "2563eb" },
  ],
  colors: {
    "editor.background": "#fbfbfa",
    "editor.foreground": "#1a1a1a",
    "editorLineNumber.foreground": "#6a6b6c",
    "editorLineNumber.activeForeground": "#1a1a1a",
    "editor.selectionBackground": "#e4e4e0",
    "editor.lineHighlightBackground": "#f4f4f2",
    "editorCursor.foreground": "#1a1a1a",
    "editorWhitespace.foreground": "#e4e4e0",
    "editorIndentGuide.background": "#e4e4e0",
    "editorIndentGuide.activeBackground": "#d1d9e0",
    "editorGutter.background": "#fbfbfa",
    "editorBracketMatch.background": "#e4e4e0",
    "editorBracketMatch.border": "#d1d9e0",
    "scrollbarSlider.background": "#c4c4c080",
    "scrollbarSlider.hoverBackground": "#a8a8a480",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#e4e4e0",
    "input.background": "#ffffff",
    "input.border": "#e4e4e0",
    "dropdown.background": "#ffffff",
    "dropdown.border": "#e4e4e0",
  },
};

let registered = false;

/** Register both Raycast Monaco themes once. Call from Monaco's beforeMount. */
export function defineRaycastMonacoThemes(monaco: typeof import("monaco-editor")) {
  if (registered) return;
  monaco.editor.defineTheme(RAYCAST_MONACO_THEME_DARK, darkThemeData);
  monaco.editor.defineTheme(RAYCAST_MONACO_THEME_LIGHT, lightThemeData);
  registered = true;
}
```

- [ ] **Step 2.2: Wire the theme into Editor.tsx**

In `src/pages/Editor.tsx`:

1. Add the import at the top (with the other editor imports near line 4-5):
```ts
import {
  defineRaycastMonacoThemes,
  RAYCAST_MONACO_THEME_DARK,
  RAYCAST_MONACO_THEME_LIGHT,
} from "@/components/editor/raycastMonacoTheme";
```

2. Add a `beforeMount` handler to the `<MonacoEditor>` (currently around line 799-827). Insert `beforeMount` as a new prop alongside `onMount`:
```tsx
                beforeMount={(monaco) => {
                  defineRaycastMonacoThemes(monaco);
                }}
                onMount={(editor) => { editorRef.current = editor; }}
```

3. Change the `theme` prop (line 826) from:
```tsx
                theme={theme === "dark" ? "vs-dark" : "light"}
```
to:
```tsx
                theme={theme === "dark" ? RAYCAST_MONACO_THEME_DARK : RAYCAST_MONACO_THEME_LIGHT}
```

- [ ] **Step 2.3: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 2.4: Commit**

```bash
git add src/components/editor/raycastMonacoTheme.ts src/pages/Editor.tsx
git commit -m "feat(editor): custom Raycast Monaco theme

Defines raycast-dark (void-black canvas, ember keywords, mint strings,
sky numbers) and raycast-light variants, registered once on beforeMount.
Replaces the built-in vs-dark/vs themes."
```

---

## Task 3: Atmosphere gradients

Apply the radial-gradient backdrops from DESIGN.md to the Settings right panel and the Welcome hero — the two places the spec calls for "section atmosphere."

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/components/welcome/WelcomeStep.tsx`

- [ ] **Step 3.1: Add atmosphere to the Settings right panel**

In `src/pages/Settings.tsx`, find the right-panel wrapper (the `<div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>` from Phase 3's sub-nav restructure). Add a subtle nebula gradient as a background layer.

Read the file to find the exact current line, then add `background` and `position: 'relative'` to that div, plus a pseudo-atmosphere via an absolutely-positioned child:

```tsx
<div style={{ flex: 1, overflow: 'auto', padding: '32px', position: 'relative' }}>
  <div style={{
    position: 'absolute',
    top: 0, left: 0, right: 0, height: '280px',
    background: 'var(--gradient-nebula)',
    pointerEvents: 'none',
    zIndex: 0,
  }} />
  <div style={{ maxWidth: '680px', position: 'relative', zIndex: 1 }}>
    {/* ...existing section conditionals... */}
  </div>
</div>
```

The gradient is already low-opacity (0.12 in light, 0.7→0.25 in dark) so it reads as distant light, not a colored band.

- [ ] **Step 3.2: Add atmosphere to the Welcome hero**

Read `src/components/welcome/WelcomeStep.tsx` to find the root container. Add the violet-haze gradient as a background layer behind the hero content. Apply the same pattern: an absolutely-positioned gradient div with `pointerEvents: 'none'`, content wrapped in a `position: 'relative', zIndex: 1` div.

Use `var(--gradient-violet)` for the hero (the spec alternates blue/violet per section; violet for the hero launch feel).

- [ ] **Step 3.3: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 3.4: Commit**

```bash
git add src/pages/Settings.tsx src/components/welcome/WelcomeStep.tsx
git commit -m "feat(theme): atmosphere gradients on Settings panel + Welcome hero

Settings right panel gets a subtle nebula-blue radial at the top;
Welcome hero gets a violet-haze radial. Both use the gradient tokens
from Phase 1 (low-opacity, reads as distant light not a color band)."
```

---

## Task 4: Apply entrance animations to pages + palette

Wire the `.animate-page-enter` class onto each page's content wrapper, and `.animate-modal`/`.animate-popover` where appropriate.

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `src/pages/Marketplace.tsx`
- Modify: `src/pages/Tools.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Feedback.tsx`
- Modify: `src/components/CommandPalette.tsx`

- [ ] **Step 4.1: Add the page-enter class to each page's main content wrapper**

For each page, find the `<main>` content wrapper (the inner `<div style={{ maxWidth: '...' }}>` inside `<main>`) and add `className="animate-page-enter"`.

Because route changes remount the page component, the animation re-triggers on each navigation — giving the "snap-in" entrance. Add `key={location.pathname}` is NOT needed since each page is a distinct component that mounts/unmounts on navigation.

Files + approximate locations (read each first):
- Skills.tsx: the `<div style={{ maxWidth: '1200px' }}>` inside `<main>` (~line 2522)
- Marketplace.tsx: the `<div style={{ maxWidth: '1200px' }}>` inside `<main>` (~line 1117)
- Tools.tsx: the `<div style={{ maxWidth: '1200px' }}>` inside `<main>` (~line 1208)
- Settings.tsx: the inner content div in the right panel
- Feedback.tsx: the `<div style={{ maxWidth: '760px' }}>` inside `<main>` (~line 109)

Example edit for Skills:
```tsx
// before:
<div style={{ maxWidth: '1200px' }}>
// after:
<div className="animate-page-enter" style={{ maxWidth: '1200px' }}>
```

- [ ] **Step 4.2: Add modal entrance to the CommandPalette**

In `src/components/CommandPalette.tsx`, find the palette container `<div>` (the one with `borderRadius: "var(--radius)"` and `boxShadow: "var(--shadow-xl)"`, ~line 303). Add `className="animate-modal"`.

- [ ] **Step 4.3: Verify build + visual**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/pages/Skills.tsx src/pages/Marketplace.tsx src/pages/Tools.tsx src/pages/Settings.tsx src/pages/Feedback.tsx src/components/CommandPalette.tsx
git commit -m "feat(theme): entrance animations on pages + command palette

Each page's content wrapper gets .animate-page-enter (outQuint
fadeInUp, 280ms) so navigation feels responsive. Command palette
gets .animate-modal on open."
```

---

## Task 5: Empty-state consistency

The three list pages (Skills/Marketplace/Tools) each have their own empty-state markup. Unify them to one layout so they feel cohesive.

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `src/pages/Marketplace.tsx`
- Modify: `src/pages/Tools.tsx`

- [ ] **Step 5.1: Define the shared empty-state pattern**

Each empty state should be a centered column: an icon (ember ✦ or contextual), a title, a description, and an optional action button. Use this style block consistently:

```tsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '64px 24px',
  textAlign: 'center',
  gap: 12,
}}>
  <div style={{ fontSize: 32, color: 'var(--ember)', opacity: 0.5 }}>✦</div>
  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>{title}</div>
  <div style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 360 }}>{description}</div>
</div>
```

- [ ] **Step 5.2: Skills empty state**

Find the Skills empty state (search for `t("skills.empty")` or the no-results/no-skills branch). Wrap/replace it with the shared pattern above, using the existing i18n strings for title/description.

- [ ] **Step 5.3: Marketplace empty state**

Find the Marketplace empty state (~line 1226-1239 per exploration). Replace with the shared pattern using `t("marketplace.noSkills")` / `t("marketplace.noMatch")`.

- [ ] **Step 5.4: Tools empty state**

Find the Tools empty states (there are two: detected-tools empty ~line 1229, custom-tools empty ~line 1273). Apply the shared pattern to both.

- [ ] **Step 5.5: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 5.6: Commit**

```bash
git add src/pages/Skills.tsx src/pages/Marketplace.tsx src/pages/Tools.tsx
git commit -m "style(theme): unified empty-state layout across list pages

Skills/Marketplace/Tools empty states share one centered layout:
ember ✦ icon, title, description. Uses existing i18n strings."
```

---

## Task 6: Phase 4 acceptance verification

- [ ] **Step 6.1: Build passes**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 6.2: Tests pass**

Run: `npm test`
Expected: 3 fontFamily tests pass.

- [ ] **Step 6.3: Manual visual smoke test in Tauri window**

Run: `npm run tauri dev`

Verify in BOTH themes:
1. **Motion**: navigating between pages produces a subtle fade-up entrance (280ms). The command palette animates in on open. Nothing feels laggy or slow.
2. **Monaco theme**: open the Editor (`/editor`). The code background is the Raycast void-black (dark) / warm paper (light); keywords are ember-red, strings mint, numbers sky-blue. NOT the default vs-dark blue.
3. **Atmosphere**: the Settings right panel has a subtle blue radial glow at the top. The Welcome hero (reset onboarding or view the step) has a violet radial glow.
4. **Focus states**: tab through the top bar, a page, a dialog — every focused element shows a visible ring.
5. **Empty states**: with no skills / no tools / no marketplace results, the empty states share the centered ✦ layout.
6. No regression in any feature.

If any fail, stop and fix.

- [ ] **Step 6.4: Commit any verification fixes**

```bash
git add -A
git commit -m "fix(theme): phase 4 verification fixes"
```

---

## Phase 4 Completion — Redesign Complete

After Task 6 passes, all four phases are done:
- **Phase 1**: Raycast tokens, Inter+GeistMono, hardcoded-color cleanup.
- **Phase 2**: TopBar + scope search, sidebar removed, elevated command palette.
- **Phase 3**: Page token sweep, Settings sub-nav, card grid unification.
- **Phase 4**: Motion, Monaco theme, atmosphere gradients, focus/empty states.

The app is fully redesigned end-to-end in the Raycast aesthetic, both themes, no regressions. Use `superpowers:finishing-a-development-branch` to merge Phase 4 and close out the redesign.
