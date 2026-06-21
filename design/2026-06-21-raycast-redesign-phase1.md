# Raycast Redesign — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the GitHub-Primer token system with the Raycast design tokens (both themes), bundle Inter + GeistMono, make the scrollbar theme-aware, eliminate every hardcoded hex in the UI primitives, and add a "Raycast (Inter)" font preset — all without any structural reorganization. After Phase 1, the app renders the full Raycast palette in its existing layout.

**Architecture:** A pure token-foundation pass. `src/index.css` becomes clean Tailwind v4 with a complete `:root` (light) + `.dark` (dark) Raycast token set mapped onto the existing shadcn token names, so all existing utilities (`bg-background`, `text-muted-foreground`, etc.) resolve to Raycast values with zero component changes. Fonts are bundled via `@fontsource`. Hardcoded-color components (`toast.tsx`, `toggle.tsx`, `Layout.tsx` sync banner) are re-pointed at tokens. No components move, no routes change.

**Tech Stack:** React 19, Tailwind CSS v4 (`@theme`), TypeScript, Tauri, `node:test` for pure-function unit tests.

**Spec reference:** `design/2026-06-21-raycast-redesign-spec.md` §2 (Token Foundation & CSS Architecture).

**Phases 2–4** (Shell, Pages, Polish) are out of scope for this plan and will each get their own plan after Phase 1 ships.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `package.json` | Add `@fontsource` Inter + GeistMono deps; add `test` script | Modify |
| `src/main.tsx` | Import the bundled font CSS so the fonts register | Modify |
| `src/index.css` | The single source of truth: Raycast tokens (both themes), Tailwind v4 `@theme`, theme-aware scrollbar, font tokens | Rewrite |
| `src/App.css` | Legacy unused template CSS | Delete |
| `src/lib/fontFamily.ts` | Add `"raycast"` preset as the new default; keep system/rounded/serif | Modify |
| `src/lib/fontFamily.test.ts` | Cover the new `raycast` preset | Modify |
| `src/hooks/useTheme.tsx` | Default `fontFamily` state to `"raycast"` | Modify |
| `src/App.tsx` | Default `fontFamily` state to `"raycast"` | Modify |
| `src/pages/Settings.tsx` | Add "Raycast (Inter)" as first font-preset option | Modify |
| `src/i18n/locales/en.ts` + `zh.ts` | Add `settings.fontFamilyRaycast` label | Modify |
| `src/components/ui/toggle.tsx` | Re-point hardcoded `#3b82f6/#4b5563/#d1d5db` at tokens | Modify |
| `src/components/ui/toast.tsx` | Re-point hardcoded bg/border/text colors at semantic tokens | Modify |
| `src/components/layout/Layout.tsx` | Re-point sync-banner hardcoded yellows at warning tokens | Modify |
| `src/components/layout/Sidebar.tsx` | Re-point `rgba(0,0,0,0.04)` hover at `--sidebar-accent` | Modify |
| `src/components/auth/AuthButton.tsx` | Re-point hover `rgba(0,0,0,0.04)` at `--sidebar-accent` | Modify |

---

## Pre-flight: Snapshot the uncommitted working tree

The repo currently has uncommitted edits from a prior session (modified `Settings.tsx`, `FileTree.tsx`, etc.). These must be committed before Phase 1 starts so the plan's edits land on a clean, reviewable diff.

- [ ] **Step 0.1: Review and commit existing uncommitted changes**

Run: `git status --short`
Review the list. These are pre-existing edits unrelated to this plan. Commit them so Phase 1 produces a clean diff:

```bash
git add -A
git commit -m "chore: commit pre-redesign working state"
```

If any of those changes are experimental and should NOT be kept, instead run `git stash` (do not commit). Confirm with the user before stashing.

- [ ] **Step 0.2: Verify clean tree**

Run: `git status --short`
Expected: empty output (clean working tree). Do not proceed until the tree is clean.

---

## Task 1: Bundle Inter + GeistMono fonts

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`

- [ ] **Step 1.1: Install the fontsource packages**

Run:
```bash
npm install @fontsource-variable/inter @fontsource/geist-mono
```

`@fontsource-variable/inter` provides the variable Inter (weights 100–900 in one file, so 400/500/600 resolve). `@fontsource/geist-mono` provides GeistMono weights 300/400/500. Both ship woff2.

Expected: `added N packages` and new entries in `package.json` `dependencies`.

- [ ] **Step 1.2: Register the fonts in the entry point**

Modify `src/main.tsx` — add these imports immediately above the existing `import './index.css'` line:

```ts
import '@fontsource-variable/inter';
import '@fontsource/geist-mono/300.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
```

The order matters: font CSS loads before `index.css` so `index.css` can reference the families by name.

- [ ] **Step 1.3: Verify the build resolves the font packages**

Run: `npm run build`
Expected: build completes with no errors. (Type errors unrelated to fonts may exist; only fail here if the build breaks due to the new imports.)

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "feat(theme): bundle Inter + GeistMono via fontsource"
```

---

## Task 2: Rewrite the token foundation in `src/index.css`

This is the keystone task — it replaces the entire GitHub-Primer palette with Raycast tokens for both themes. The structure maps Raycast colors onto the existing shadcn token names so utilities keep resolving.

**Files:**
- Rewrite: `src/index.css`

- [ ] **Step 2.1: Replace the full contents of `src/index.css`**

Overwrite the entire file with:

```css
@import "tw-animate-css";

@plugin "tailwindcss-animate";

@import "@fontsource-variable/inter/index.css";
@import "@fontsource/geist-mono/300.css";
@import "@fontsource/geist-mono/400.css";
@import "@fontsource/geist-mono/500.css";

@custom-variant dark (&:is(.dark *));

@import "tailwindcss";

@theme inline {
  /* Radius scale (Raycast: 6 / 8 / 11 / 16) */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 11px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-3xl: 24px;
  --radius-4xl: 28px;

  /* Color tokens → raw variables defined in :root / .dark */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* Font families */
  --font-sans: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans", Helvetica, Arial, sans-serif;
  --font-mono: 'GeistMono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

:root {
  /* Light theme — warm paper neutrals (Raycast light variant) */
  --radius: 11px;

  --background: #fbfbfa;
  --foreground: #1a1a1a;
  --card: #ffffff;
  --card-foreground: #1a1a1a;
  --popover: #ffffff;
  --popover-foreground: #1a1a1a;
  --primary: #1a1a1a;
  --primary-foreground: #ffffff;
  --secondary: #f4f4f2;
  --secondary-foreground: #1a1a1a;
  --muted: #f4f4f2;
  --muted-foreground: #6a6b6c;
  --accent: #f4f4f2;
  --accent-foreground: #1a1a1a;
  --destructive: #d32f2f;
  --border: #e4e4e0;
  --input: #e4e4e0;
  --ring: #363739;
  --chart-1: #ff6363;
  --chart-2: #59d499;
  --chart-3: #56c2ff;
  --chart-4: #a371f7;
  --chart-5: #d29922;
  --sidebar: #f4f4f2;
  --sidebar-foreground: #1a1a1a;
  --sidebar-primary: #1a1a1a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: rgba(0, 0, 0, 0.05);
  --sidebar-accent-foreground: #1a1a1a;
  --sidebar-border: #e4e4e0;
  --sidebar-ring: #363739;

  /* Raycast brand + signal colors */
  --ember: #ff6363;
  --ember-dark: #452324;
  --mint: #59d499;
  --sky: #56c2ff;
  --ash: #e6e6e6;

  /* Semantic colors */
  --color-error: #d32f2f;
  --color-error-bg: #fef2f2;
  --color-error-border: #fecaca;

  --color-success: #16a34a;
  --color-success-bg: #dcfce7;
  --color-success-border: #bbf7d0;

  --color-warning: #ca8a04;
  --color-warning-bg: #fefce8;
  --color-warning-border: #fef08a;

  --color-info: #2563eb;
  --color-info-bg: #eff6ff;
  --color-info-border: #bfdbfe;

  /* Shadows — monochrome only (no color tints) */
  --shadow-subtle: rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, rgba(0, 0, 0, 0.06) 0px 1px 0px 0px inset;
  --shadow-sm: rgba(0, 0, 0, 0.08) 0px 2px 4px 0px;
  --shadow-lg: rgba(0, 0, 0, 0.1) 0px 4px 16px 0px;
  --shadow-xl: rgba(0, 0, 0, 0.12) 0px 8px 40px 8px, rgba(0, 0, 0, 0.08) 0px 0px 0px 0.5px;
  --shadow-ring: rgba(0, 0, 0, 0.15) 0px 0px 0px 1px;
  --shadow-highlight: rgba(0, 0, 0, 0.04) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.35) 0px 0px 0px 1px, rgba(0, 0, 0, 0.06) 0px -1px 0px 0px inset;

  /* Atmosphere gradients (hero / settings only) */
  --gradient-nebula: radial-gradient(84.6% 73.49% at 50% 26.51%, rgba(4, 63, 150, 0.12), rgba(6, 18, 37, 0.04));
  --gradient-violet: radial-gradient(86.88% 75.47% at 50% 24.53%, rgba(82, 48, 145, 0.12), rgba(26, 11, 51, 0.03));
}

.dark {
  /* Dark theme — Raycast void black + graphite stack */
  --background: #040506;
  --foreground: #ffffff;
  --card: #07080a;
  --card-foreground: #ffffff;
  --popover: #07080a;
  --popover-foreground: #ffffff;
  --primary: #e6e6e6;
  --primary-foreground: #2f3031;
  --secondary: #111214;
  --secondary-foreground: #ffffff;
  --muted: #111214;
  --muted-foreground: #9c9c9d;
  --accent: #111214;
  --accent-foreground: #ffffff;
  --destructive: #ff6363;
  --border: #363739;
  --input: #363739;
  --ring: #454647;
  --chart-1: #ff6363;
  --chart-2: #59d499;
  --chart-3: #56c2ff;
  --chart-4: #a371f7;
  --chart-5: #d29922;
  --sidebar: #07080a;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #e6e6e6;
  --sidebar-primary-foreground: #2f3031;
  --sidebar-accent: rgba(255, 255, 255, 0.06);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #363739;
  --sidebar-ring: #454647;

  /* Raycast brand + signal colors */
  --ember: #ff6363;
  --ember-dark: #452324;
  --mint: #59d499;
  --sky: #56c2ff;
  --ash: #e6e6e6;

  /* Semantic colors — dark mode overrides */
  --color-error-bg: #452324;
  --color-error-border: #7a2d2e;

  --color-success-bg: #0f2e1f;
  --color-success-border: #1f5135;

  --color-warning-bg: #3a2f06;
  --color-warning-border: #5c4810;

  --color-info-bg: #0d213f;
  --color-info-border: #1f3a66;

  /* Shadows — monochrome (black drops, white inset highlights) */
  --shadow-subtle: rgba(255, 255, 255, 0.04) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.25) 0px 1px 2px 0px;
  --shadow-sm: rgba(0, 0, 0, 0.25) 0px 4px 4px 0px;
  --shadow-lg: rgba(0, 0, 0, 0.4) 0px 4px 20px 0px;
  --shadow-xl: rgba(0, 0, 0, 0.4) 0px 4px 40px 8px, rgba(0, 0, 0, 0.8) 0px 0px 0px 0.5px, rgba(255, 255, 255, 0.3) 0px 0.5px 0px 0px inset;
  --shadow-ring: rgba(255, 255, 255, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.4) 0px 0px 0px 1px inset;
  --shadow-highlight: rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset, rgba(255, 255, 255, 0.25) 0px 0px 0px 1px, rgba(0, 0, 0, 0.2) 0px -1px 0px 0px inset;

  /* Atmosphere gradients — stronger in dark */
  --gradient-nebula: radial-gradient(84.6% 73.49% at 50% 26.51%, rgba(4, 63, 150, 0.7), rgba(6, 18, 37, 0.25));
  --gradient-violet: radial-gradient(86.88% 75.47% at 50% 24.53%, rgba(82, 48, 145, 0.7), rgba(26, 11, 51, 0.14));
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    box-sizing: border-box;
  }
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--app-font-family, var(--font-sans));
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: "calt", "kern", "liga";
  }
  code, pre, kbd, .font-mono {
    font-family: var(--font-mono);
    font-feature-settings: "calt", "kern", "liga";
  }
}

/* Theme-aware scrollbar (replaces hardcoded black-alpha) */
::-webkit-scrollbar {
  width: 11px;
  height: 11px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 6px;
  border: 3px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--muted-foreground);
  border: 3px solid transparent;
  background-clip: padding-box;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-down {
  animation: slideDown 0.2s ease-out;
}

@keyframes marketplaceSkeletonShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.marketplace-skeleton-bar {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--secondary) 0%,
    var(--border) 50%,
    var(--secondary) 100%
  );
  background-size: 200% 100%;
  animation: marketplaceSkeletonShimmer 1.4s ease-in-out infinite;
}
```

Key changes from the old file:
- Removed the v3 `@tailwind base/components/utilities` directives; uses `@import "tailwindcss"` (Tailwind v4).
- `@theme inline` now lists a concrete radius scale (6/8/11/16/20/24/28) instead of `calc()` off a single `--radius`.
- Added `--font-sans` and `--font-mono` to `@theme inline` (so `font-sans` / `font-mono` utilities resolve).
- `:root` and `.dark` fully replaced with Raycast tokens. `--primary` is now `#e6e6e6` (dark) / `#1a1a1a` (light) — the near-white CTA.
- Added brand tokens (`--ember`, `--mint`, `--sky`, `--ash`), shadow tokens (`--shadow-*`), gradient tokens (`--gradient-*`), and a `--color-info-*` semantic triple.
- Scrollbar reads `var(--border)` / `var(--muted-foreground)` — theme-aware.
- `body` font-family now falls back to `var(--font-sans)` when `--app-font-family` is unset.
- Added a `code, pre, kbd, .font-mono` rule enforcing GeistMono globally for code/keys.

- [ ] **Step 2.2: Delete the unused legacy stylesheet**

Run: `git rm src/App.css`

This file is the Vite template leftover; it is not imported anywhere. Verify before removing:

Run: `grep -rn "App.css" src/ || echo "no references — safe to delete"`
Expected: `no references — safe to delete`. If anything references it, do NOT delete and investigate.

- [ ] **Step 2.3: Verify the build picks up the new tokens**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 2.4: Commit**

```bash
git add src/index.css
git rm src/App.css
git commit -m "feat(theme): rewrite token foundation to Raycast palette

Replace GitHub-Primer tokens with Raycast design tokens for both
light and dark themes. Primary action is now near-white (#e6e6e6),
destructive is ember-red (#ff6363). Adds brand/signal colors,
monochrome shadow scale, atmosphere gradients, theme-aware
scrollbar, and font-mono enforcement for code/keys. Migrates to
pure Tailwind v4 @theme structure."
```

---

## Task 3: Add the "Raycast (Inter)" font preset

The font picker stays, but a new `"raycast"` preset becomes the default. It resolves to the bundled Inter stack.

**Files:**
- Modify: `src/lib/fontFamily.ts`
- Modify: `src/lib/fontFamily.test.ts`
- Modify: `src/hooks/useTheme.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/zh.ts`

- [ ] **Step 3.1: Write the failing test for the new preset**

Replace the full contents of `src/lib/fontFamily.test.ts` with:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("font family utility exposes stacks for supported presets", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  const raycast = getFontFamilyStack("raycast");
  const system = getFontFamilyStack("system");
  const rounded = getFontFamilyStack("rounded");
  const serif = getFontFamilyStack("serif");

  assert.match(raycast, /Inter/i);
  assert.match(system, /sans-serif/i);
  assert.match(rounded, /sans-serif/i);
  assert.match(serif, /serif/i);
  assert.notEqual(raycast, system);
  assert.notEqual(system, rounded);
  assert.notEqual(system, serif);
});

test("font family utility falls back to raycast for unknown preset", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  assert.equal(getFontFamilyStack("unknown"), getFontFamilyStack("raycast"));
});

test("normalizeFontFamilyPreset accepts raycast/system/rounded/serif and defaults to raycast", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));
  const normalize = (fontFamily as { normalizeFontFamilyPreset: (p: string | null | undefined) => string }).normalizeFontFamilyPreset;

  assert.equal(normalize("raycast"), "raycast");
  assert.equal(normalize("system"), "system");
  assert.equal(normalize("rounded"), "rounded");
  assert.equal(normalize("serif"), "serif");
  assert.equal(normalize(null), "raycast");
  assert.equal(normalize("bogus"), "raycast");
});
```

- [ ] **Step 3.2: Add a `test` script to package.json and run the test to confirm it fails**

Modify `package.json` `scripts` block — add a `test` entry. The new scripts block:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "test": "node --experimental-strip-types --test --import 'data:text/javascript,import { register } from \"node:module\"; import { pathToFileURL } from \"node:url\";' 'src/**/*.test.ts'"
},
```

If the above glob invocation is unreliable in your shell, use the explicit form instead:

```json
"test": "node --experimental-strip-types --test src/lib/fontFamily.test.ts"
```

Run: `npm test`
Expected: FAIL — the tests reference `"raycast"` which is not yet a recognized preset; `getFontFamilyStack("raycast")` currently returns the system stack (no "Inter" match), and `normalizeFontFamilyPreset` defaults unknowns to `"system"`.

- [ ] **Step 3.3: Implement the new preset in `src/lib/fontFamily.ts`**

Replace the full contents of `src/lib/fontFamily.ts` with:

```ts
export const FONT_FAMILY_PRESETS = ["raycast", "system", "rounded", "serif"] as const;

export type FontFamilyPreset = (typeof FONT_FAMILY_PRESETS)[number];

const RAYCAST_FONT_STACK = [
  "\"Inter Variable\"",
  "\"Inter\"",
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  "BlinkMacSystemFont",
  "\"Segoe UI\"",
  "\"PingFang SC\"",
  "\"Hiragino Sans GB\"",
  "\"Microsoft YaHei\"",
  "\"Noto Sans\"",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

const SYSTEM_FONT_STACK = [
  "-apple-system",
  "BlinkMacSystemFont",
  "\"Segoe UI\"",
  "\"PingFang SC\"",
  "\"Hiragino Sans GB\"",
  "\"Microsoft YaHei\"",
  "\"Noto Sans\"",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

const ROUNDED_FONT_STACK = [
  "\"SF Pro Rounded\"",
  "\"ui-rounded\"",
  "\"Nunito\"",
  "\"Hiragino Maru Gothic ProN\"",
  "\"Segoe UI\"",
  "\"PingFang SC\"",
  "\"Microsoft YaHei\"",
  "sans-serif",
].join(", ");

const SERIF_FONT_STACK = [
  "\"Iowan Old Style\"",
  "\"Palatino Linotype\"",
  "\"Book Antiqua\"",
  "\"Songti SC\"",
  "\"Noto Serif CJK SC\"",
  "\"Source Han Serif SC\"",
  "Georgia",
  "\"Times New Roman\"",
  "serif",
].join(", ");

export function normalizeFontFamilyPreset(preset: string | null | undefined): FontFamilyPreset {
  if (preset === "system" || preset === "rounded" || preset === "serif") {
    return preset;
  }

  return "raycast";
}

export function getFontFamilyStack(preset: string | null | undefined): string {
  switch (normalizeFontFamilyPreset(preset)) {
    case "system":
      return SYSTEM_FONT_STACK;
    case "rounded":
      return ROUNDED_FONT_STACK;
    case "serif":
      return SERIF_FONT_STACK;
    case "raycast":
    default:
      return RAYCAST_FONT_STACK;
  }
}
```

Key change: `"raycast"` is added as the first preset; `normalizeFontFamilyPreset` now defaults unknowns/null to `"raycast"` (was `"system"`).

- [ ] **Step 3.4: Run the tests to confirm they pass**

Run: `npm test`
Expected: PASS — 3 tests pass.

- [ ] **Step 3.5: Default the app to the raycast preset**

Modify `src/App.tsx` line 53 — change the default state:

```ts
const [fontFamily, setFontFamily] = useState<FontFamilyPreset>("raycast");
```

Modify `src/hooks/useTheme.tsx` — no change needed (it receives `fontFamily` as a prop and passes it through). Verify by reading the file; the provider takes `fontFamily` from props, so no edit required.

- [ ] **Step 3.6: Add the i18n label and relabel the system option**

The existing keys (en.ts / zh.ts, line ~449) are `fontFamilySystem: "Default"` / `fontFamilySystem: "默认"`. Since Raycast is now the true default, that label is misleading. Add a new `fontFamilyRaycast` key AND relabel `fontFamilySystem` to "System"/"系统".

Modify `src/i18n/locales/en.ts` lines 449 — change:

```ts
    fontFamilySystem: "Default",
```
to:
```ts
    fontFamilyRaycast: "Raycast (Inter)",
    fontFamilySystem: "System",
```

Modify `src/i18n/locales/zh.ts` line 449 — change:
```ts
    fontFamilySystem: "默认",
```
to:
```ts
    fontFamilyRaycast: "Raycast (Inter)",
    fontFamilySystem: "系统",
```

- [ ] **Step 3.7: Add the preset as the first option in the Settings picker**

Modify `src/pages/Settings.tsx` around line 622–630 — replace the `SegmentedControl` options array:

```tsx
<SegmentedControl
  value={normalizeFontFamilyPreset(prefs.font_family)}
  onChange={(v) => updatePreference("font_family", normalizeFontFamilyPreset(v))}
  options={[
    { value: "raycast", label: t("settings.fontFamilyRaycast") },
    { value: "system", label: t("settings.fontFamilySystem") },
    { value: "rounded", label: t("settings.fontFamilyRounded") },
    { value: "serif", label: t("settings.fontFamilySerif") },
  ]}
/>
```

- [ ] **Step 3.8: Verify the build and commit**

Run: `npm run build`
Expected: build completes with no errors.

```bash
git add package.json src/lib/fontFamily.ts src/lib/fontFamily.test.ts src/App.tsx src/pages/Settings.tsx src/i18n/locales/en.ts src/i18n/locales/zh.ts
git commit -m "feat(theme): add Raycast (Inter) font preset as default

New 'raycast' preset resolves to the bundled Inter stack and becomes
the default for new users. Existing system/rounded/serif presets
remain. Adds a node:test 'test' script to package.json."
```

---

## Task 4: Remove hardcoded colors from `Toggle`

**Files:**
- Modify: `src/components/ui/toggle.tsx`

- [ ] **Step 4.1: Replace the inline colors with token references**

Replace the full contents of `src/components/ui/toggle.tsx` with:

```tsx
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
}

export function Toggle({ checked, onChange, disabled = false, title }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 9999,
        backgroundColor: checked ? "var(--primary)" : "var(--input)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background-color 0.2s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: checked ? "var(--primary-foreground)" : "var(--muted-foreground)",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}
```

Key changes: removed the `useTheme` import and `isDark` branching; all four hardcoded hex values replaced with token references. When `checked`: track = `--primary` (near-white in dark, near-black in light), knob = `--primary-foreground` (the inverse). When unchecked: track = `--input` (border-ish), knob = `--muted-foreground`.

- [ ] **Step 4.2: Verify the build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/ui/toggle.tsx
git commit -m "refactor(theme): toggle uses design tokens instead of hardcoded hex"
```

---

## Task 5: Remove hardcoded colors from `Toast`

**Files:**
- Modify: `src/components/ui/toast.tsx`

- [ ] **Step 5.1: Replace the toast item color logic with semantic tokens**

Modify `src/components/ui/toast.tsx`. Replace lines 39–41 (the `bgColor` / `borderColor` / `textColor` derivation) with:

```tsx
  const tokenKey = toast.type; // "error" | "success" | "info"
  const bgColor = `var(--color-${tokenKey}-bg)`;
  const borderColor = `var(--color-${tokenKey}-border)`;
  const textColor = `var(--color-${tokenKey})`;
```

This works because the new `:root` / `.dark` blocks define `--color-error`, `--color-error-bg`, `--color-error-border`, and the matching `success` / `info` triples. The `type` union is exactly `"error" | "success" | "info"`, so `tokenKey` is always a valid suffix.

- [ ] **Step 5.2: Re-point the boxShadow to the shadow token**

In the same file, the `ToastItem` return JSX has `boxShadow: "0 4px 12px rgba(0,0,0,0.15)"` (line ~52). Replace it with:

```tsx
        boxShadow: "var(--shadow-lg)",
```

- [ ] **Step 5.3: Verify the build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/ui/toast.tsx
git commit -m "refactor(theme): toast uses semantic tokens instead of hardcoded hex"
```

---

## Task 6: Remove hardcoded colors from the Layout sync banner and Sidebar/AuthButton hover

**Files:**
- Modify: `src/components/layout/Layout.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/auth/AuthButton.tsx`

- [ ] **Step 6.1: Re-point the sync banner in Layout.tsx**

Read `src/components/layout/Layout.tsx` and locate the sync-issue banner. It currently uses hardcoded yellows (`#fefce8`, `#ca8a04`, `#a16207`). Replace every hardcoded yellow value in that banner's `style` object:
- `#fefce8` (background) → `var(--color-warning-bg)`
- `#ca8a04` (text/foreground) → `var(--color-warning)`
- `#a16207` (border) → `var(--color-warning-border)`

The exact variable names and surrounding code vary — read the file, find each `#fefce8` / `#ca8a04` / `#a16207` occurrence in the sync-banner JSX, and substitute the token above. Leave all other styles (layout, padding, etc.) unchanged.

- [ ] **Step 6.2: Re-point the Sidebar hover**

Read `src/components/layout/Sidebar.tsx`. Find the hover handler(s) using `rgba(0, 0, 0, 0.04)` (applied via `onMouseEnter`/`onMouseLeave` inline style mutation). Replace the hardcoded `rgba(0, 0, 0, 0.04)` with `var(--sidebar-accent)`. The hover-off state should clear back to `transparent` (or whatever the original non-hover background was).

Read carefully before editing — the hover may be applied to multiple elements (NavLink rows). Apply the same substitution to each.

- [ ] **Step 6.3: Re-point the AuthButton hover**

Read `src/components/auth/AuthButton.tsx`. Find the hover handler using `rgba(0, 0, 0, 0.04)` and replace it with `var(--sidebar-accent)`, same approach as Step 6.2. (The AuthButton's `variant="sidebar"` is the one with this hover.)

- [ ] **Step 6.4: Verify no other hardcoded colors remain in these files**

Run:
```bash
grep -nE "#[0-9a-fA-F]{3,6}|rgba?\([0-9]" src/components/layout/Layout.tsx src/components/layout/Sidebar.tsx src/components/auth/AuthButton.tsx || echo "clean"
```
Expected: `clean` — no hardcoded hex or rgba literals remain in these three files. If any appear, they are outside the sync banner / hover regions; leave them only if they are genuinely non-thematic (e.g. a truly constant value). When in doubt, flag to the user.

- [ ] **Step 6.5: Verify the build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6.6: Commit**

```bash
git add src/components/layout/Layout.tsx src/components/layout/Sidebar.tsx src/components/auth/AuthButton.tsx
git commit -m "refactor(theme): sync banner + sidebar/auth hover use tokens

Removes the last hardcoded hex (yellow sync banner) and the
rgba(0,0,0,0.04) hover that darkened wrongly in dark mode;
all now read from semantic tokens."
```

---

## Task 7: Phase 1 acceptance verification

No new files — this is a verification pass against the Phase 1 success criteria.

- [ ] **Step 7.1: Build passes**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 7.2: Unit tests pass**

Run: `npm test`
Expected: 3 fontFamily tests pass.

- [ ] **Step 7.3: Scan for remaining hardcoded colors in components/ui and layout**

Run:
```bash
grep -rnE "#[0-9a-fA-F]{3,6}|rgba?\([0-9]" src/components/ui src/components/layout src/components/auth || echo "clean"
```
Expected: `clean`. (Phase 2–4 may still have hardcoded colors in pages/ and other components — that's out of scope here. This check covers only the Phase 1 target directories.)

- [ ] **Step 7.4: Manual visual smoke test (both themes)**

Run: `npm run dev`
Open the app. Toggle between light and dark themes (Settings → Theme). Verify in BOTH themes:
1. Background is the Raycast canvas (near-black `#040506` dark; warm `#fbfbfa` light).
2. Primary buttons render near-white (dark) / near-black (light) — NOT blue.
3. Destructive elements render ember-red.
4. Scrollbar thumb matches the border color, not a black tint.
5. Default font is Inter (tight, clean); code/version strings render in GeistMono.
6. Toast notifications render with correct semantic colors (trigger one if possible).
7. Toggle switches show the new track/knob colors.

If any of these fail, stop and fix before declaring Phase 1 done.

- [ ] **Step 7.5: Final commit (if any fixes were needed in 7.1–7.4)**

If verification surfaced fixes, commit them:
```bash
git add -A
git commit -m "fix(theme): phase 1 verification fixes"
```

Otherwise, Phase 1 is complete — the tree is clean and all criteria pass.

---

## Phase 1 Completion

After Task 7 passes:
- The entire app renders in the Raycast palette (both themes) with no structural changes.
- Inter is the default font; GeistMono is enforced for code/keys.
- No hardcoded hex remains in `src/components/{ui,layout,auth}`.
- `npm test` runs the pure-function suite.

**Next:** Write the Phase 2 plan (Shell + Primitives — new TopBar, delete Sidebar, elevate CommandPalette). Do not start Phase 2 until Phase 1 is merged/committed and visually verified.
