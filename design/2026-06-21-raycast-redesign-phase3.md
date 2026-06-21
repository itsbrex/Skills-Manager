# Raycast Redesign — Phase 3 (Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Raycast aesthetic to the page bodies. The highest-impact, lowest-risk change first: add the missing `--primary-tint` / `--surface-hover` tokens and sweep every hardcoded `rgba(9,105,218,…)` (GitHub blue) and `rgba(0,0,0,…)` shadow across Skills, Tools, Marketplace, Settings, Feedback, and the create/edit dialogs to design tokens. Then convert Settings from a single long scroll to a left sub-nav + right panel. Editor and Welcome get a lighter pass.

**Architecture:** No new components or routing. The pages keep their current inline-style structure (a full Tailwind migration is out of scope — these are 1500–4000 line files and a rewrite would be fragile). Instead, Phase 3 is a **token sweep**: every hardcoded color literal becomes a `var(--*)` reference, unifying the palette across both themes. The Settings sub-nav restructure is the one structural change. Card grids keep their current layouts (they already look right in the new tokens).

**Tech Stack:** React 19, Tailwind v4 (tokens only — no utilities added), TypeScript, Tauri, `node:test`.

**Spec reference:** `design/2026-06-21-raycast-redesign-spec.md` §5 (Per-Page Redesign), §2.6 (hardcoded color cleanup).

**Prerequisite:** Phases 1 & 2 merged to `main`. The `--primary`, `--destructive`, `--shadow-*`, `--color-warning*` tokens exist (Phase 1); the TopBar/ScopeSearchField/CommandPalette are in place (Phase 2).

---

## Scope Boundaries (important)

**In scope (this plan):**
- Add the two missing tokens referenced by the codebase: `--primary-tint`, `--surface-hover`.
- Sweep hardcoded `rgba(9,105,218,…)` → `var(--primary-tint)` in Skills/Marketplace (≈27 occurrences).
- Sweep hardcoded shadow literals (`rgba(0,0,0,0.08–0.25)`) → `var(--shadow-sm)` / `var(--shadow-lg)` across all pages.
- Sweep `#dc2626` / `#b91c1c` / `rgba(220,38,38,…)` (delete reds) → `var(--destructive)` / `var(--color-error)`.
- Standardize card grid: unify min-width to 320px, gap 16px, radius 11px (`var(--radius)`) across Skills + Tools + Marketplace.
- Convert Settings to left sub-nav + right panel (the one structural change).
- Editor: token sweep on the FileTree + top bar.
- Welcome: token sweep on the 4 steps.

**Explicitly deferred to Phase 4 (Polish) — additional items:**
- **Custom Monaco editor theme** (spec §5.6 mentions a Raycast color scheme for the code editor). Theming Monaco's token colors (keywords, strings, etc.) is a self-contained sub-task that doesn't affect the app chrome; deferred to Phase 4 alongside the other polish work. Task 6 only sweeps the Editor's surrounding chrome (top bar, file tree), not Monaco internals.

**Explicitly deferred to Phase 4 (Polish):**
- Full Tailwind migration of page bodies.
- Card component extraction (SkillCard / ToolCard components).
- Animation passes, empty-state redesigns, focus-state audit.
- Marketplace's 8-swatch gradient avatar palette (Skills:106-113, Marketplace:109-116) — kept as-is; it's a deliberate decorative palette, not a theme bug.
- ThemeSelector/SegmentedControl consolidation.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/index.css` | Add `--primary-tint`, `--surface-hover` tokens (both themes) | Modify |
| `src/pages/Skills.tsx` | Sweep ~27 hardcoded blue + red + shadow literals | Modify |
| `src/pages/Tools.tsx` | Sweep ~2 literals (overlay shadow) | Modify |
| `src/pages/Marketplace.tsx` | Sweep ~15 blue + shadow literals; unify grid | Modify |
| `src/pages/Settings.tsx` | Sweep ~3 literals; **restructure to sub-nav + panel** | Modify |
| `src/pages/Feedback.tsx` | Sweep ~2 shadow literals | Modify |
| `src/pages/Editor.tsx` | Token sweep on top bar + chrome | Modify |
| `src/components/editor/FileTree.tsx` | Token sweep | Modify |
| `src/components/welcome/*.tsx` | Token sweep on 4 steps | Modify |

---

## Pre-flight

- [ ] **Step 0.1: Confirm clean tree and create feature branch**

Run: `git status --short`
Expected: empty (clean). If not, commit or stash.

```bash
git checkout main
git checkout -b feat/raycast-redesign-phase3
```

- [ ] **Step 0.2: Verify Phase 1/2 are present**

Run: `grep -c "#e6e6e6" src/index.css && grep -c "ScopeSearchField" src/components/TopBar.tsx`
Expected: both ≥ 1. If 0, Phase 1/2 is not merged — do not proceed.

---

## Task 1: Add the missing tokens

The codebase references `var(--primary-tint)` and `var(--surface-hover)` but they were never defined — they resolve to empty today. Add them.

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1.1: Add tokens to `:root` (light)**

In `src/index.css`, inside the `:root { ... }` block, after the existing `--shadow-highlight:` line (before the `--gradient-nebula:` line), insert:

```css
  /* Primary tint scale — used for selected/hover fills derived from primary.
     Resolves the previously-undefined var(--primary-tint) referenced across pages. */
  --primary-tint: rgba(26, 26, 26, 0.08);
  --primary-tint-border: rgba(26, 26, 26, 0.35);

  /* Surface hover — raised-fill hover state for cards/rows. */
  --surface-hover: rgba(0, 0, 0, 0.04);
```

- [ ] **Step 1.2: Add dark overrides to `.dark`**

In the `.dark { ... }` block, after the existing `--shadow-highlight:` line, insert:

```css
  /* Primary tint scale — dark mode: near-white tints on black. */
  --primary-tint: rgba(230, 230, 230, 0.08);
  --primary-tint-border: rgba(230, 230, 230, 0.35);

  /* Surface hover — dark mode: white-alpha lift. */
  --surface-hover: rgba(255, 255, 255, 0.04);
```

- [ ] **Step 1.3: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 1.4: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): add --primary-tint and --surface-hover tokens

These were already referenced by Skills/Tools/Marketplace but never
defined (resolving to empty). Adding them in both themes unblocks the
hardcoded-color sweep in the rest of Phase 3."
```

---

## Task 2: Sweep hardcoded colors in Skills.tsx

The largest cleanup: ~27 literals. Use the exploration report's file:line list. The pattern: `rgba(9,105,218,X)` → a `--primary-tint` variant; reds → `var(--destructive)`; shadows → `var(--shadow-*)`.

**Files:**
- Modify: `src/pages/Skills.tsx`

- [ ] **Step 2.1: Replace the GitHub-blue literals**

For each occurrence below, replace the literal with the token. Run a grep to confirm each still exists at that line first (line numbers may drift slightly):

| Line | Current | Replace with |
|---|---|---|
| 130 | `rgba(9, 105, 218, 0.08)` | `var(--primary-tint)` |
| 131 | `rgba(9, 105, 218, 0.28)` | `var(--primary-tint-border)` |
| 2243 | `rgba(9, 105, 218, 0.4)` | `var(--primary-tint-border)` |
| 2248 | `rgba(9, 105, 218, 0.08)` | `var(--primary-tint)` |
| 2462 | `rgba(9, 105, 218, 0.1)` | `var(--primary-tint)` |
| 2593 | `rgba(9, 105, 218, 0.08)` | `var(--primary-tint)` |
| 2594 | `rgba(9, 105, 218, 0.25)` | `var(--primary-tint-border)` |
| 2691 | `rgba(9, 105, 218, 0.08)` | `var(--primary-tint)` |
| 2696 | `rgba(9, 105, 218, 0.4)` | `var(--primary-tint-border)` |
| 2700 | `rgba(9, 105, 218, 0.15)` | `var(--primary-tint)` |
| 2716 | `rgba(9, 105, 218, 0.4)` | `var(--primary-tint-border)` |
| 2994 | `rgba(9, 105, 218, 0.12)` | `var(--primary-tint)` |
| 2997 | `rgba(9, 105, 218, 0.35)` | `var(--primary-tint-border)` |
| 3103 | `rgba(9, 105, 218, 0.35)` | `var(--primary-tint-border)` |
| 3111 | `rgba(9, 105, 218, 0.12)` | `var(--primary-tint)` |
| 3648 | `rgba(9, 105, 218, 0.08)` | `var(--primary-tint)` |
| 3711 | `rgba(9, 105, 218, 0.04)` | `var(--primary-tint)` |
| 3712 | `rgba(9, 105, 218, 0.14)` | `var(--primary-tint-border)` |

Approach: do these with targeted `Edit` calls (each `rgba(9, 105, 218, 0.08)` etc. appears multiple times, so use `replace_all: true` for each distinct value to handle every occurrence at once). Order: handle each distinct alpha value once with replace_all:
- `rgba(9, 105, 218, 0.04)` → `var(--primary-tint)`
- `rgba(9, 105, 218, 0.08)` → `var(--primary-tint)`
- `rgba(9, 105, 218, 0.1)` → `var(--primary-tint)`
- `rgba(9, 105, 218, 0.12)` → `var(--primary-tint)`
- `rgba(9, 105, 218, 0.14)` → `var(--primary-tint-border)`
- `rgba(9, 105, 218, 0.15)` → `var(--primary-tint)`
- `rgba(9, 105, 218, 0.25)` → `var(--primary-tint-border)`
- `rgba(9, 105, 218, 0.28)` → `var(--primary-tint-border)`
- `rgba(9, 105, 218, 0.35)` → `var(--primary-tint-border)`
- `rgba(9, 105, 218, 0.4)` → `var(--primary-tint-border)`

- [ ] **Step 2.2: Replace the destructive reds**

- `#dc2626` → `var(--destructive)` (lines 476, 491)
- `#b91c1c` → `var(--destructive)` (lines 487, 2612)
- `rgba(220, 38, 38, 0.08)` → `var(--color-error-bg)` (line 486, 2613)
- `rgba(220, 38, 38, 0.25)` → `var(--color-error-border)` (line 2614)

Use `replace_all: true` per distinct literal.

- [ ] **Step 2.3: Replace the indigo primary fallbacks**

- `var(--primary, #2563eb)` → `var(--primary)` (line 2200)
- `var(--primary-foreground, #fff)` → `var(--primary-foreground)` (line 2792)
- `var(--primary, #6366f1)` → `var(--primary)` (lines 2795, 4014, 4015)
- `#fff` where it's a primary-foreground text (2792, 4013) → `var(--primary-foreground)`

Be careful: `#fff` also appears in the gradient palette (lines 106-113) — do NOT touch those. Only replace the `#fff` that are paired with a primary fill on lines 2792 and 4013.

- [ ] **Step 2.4: Replace the shadow literals**

- `rgba(0, 0, 0, 0.25)` (menu shadows, lines 241, 425) → `var(--shadow-lg)`
- `rgba(0,0,0,0.16)` (line 2286) → `var(--shadow-lg)`
- `rgba(0,0,0,0.08)` (line 2357) → `var(--shadow-sm)`
- `rgba(0,0,0,0.06)` (line 2709) → `var(--shadow-sm)`
- `rgba(0,0,0,0.1)` (line 2755) → `var(--shadow-sm)`
- `rgba(0,0,0,0.22)` (line 3441) → `var(--shadow-xl)`
- `rgba(0,0,0,0.2)` (line 3921) → `var(--shadow-xl)`
- `rgba(15, 23, 42, 0.04)` (line 378) → `var(--surface-hover)`
- `rgba(15, 23, 42, 0.06)` (line 2912) → `var(--surface-hover)`
- `rgba(17, 24, 39, 0.72)` (line 3710, tag chip text) → `var(--muted-foreground)`

Note: the `boxShadow:` property takes a full shadow string like `"0 4px 12px rgba(0,0,0,0.08)"`. When replacing, replace the whole `boxShadow` value with the token: `boxShadow: "var(--shadow-sm)"`. Read each line to confirm the full value before editing.

- [ ] **Step 2.5: Verify no GitHub-blue remains**

Run:
```bash
grep -nE "rgba\(9, ?105, ?218|rgba\(220, ?38, ?38|#dc2626|#b91c1c|#2563eb|#6366f1" src/pages/Skills.tsx || echo "clean"
```
Expected: `clean`.

- [ ] **Step 2.6: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 2.7: Commit**

```bash
git add src/pages/Skills.tsx
git commit -m "refactor(theme): sweep Skills hardcoded colors to tokens

Replaces ~27 rgba(9,105,218,…) GitHub-blue literals with
var(--primary-tint) / --primary-tint-border, destructive reds with
var(--destructive) / --color-error-*, indigo primary fallbacks with
var(--primary), and raw shadow strings with var(--shadow-*). The
decorative 8-swatch gradient palette is intentionally kept."
```

---

## Task 3: Sweep Marketplace, Tools, Feedback, Settings (non-structural)

Same sweep on the other pages. Smaller counts.

**Files:**
- Modify: `src/pages/Marketplace.tsx`
- Modify: `src/pages/Tools.tsx`
- Modify: `src/pages/Feedback.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 3.1: Marketplace — replace blue + shadow literals**

Distinct literals to replace (use `replace_all: true` per literal):
- `rgba(9, 105, 218, 0.35)` → `var(--primary-tint-border)` (lines 888, 1136, 1511)
- `rgba(9, 105, 218, 0.10)` → `var(--primary-tint)` (line 890)
- `rgba(9, 105, 218, 0.28)` → `var(--primary-tint-border)` (line 912)
- `rgba(9, 105, 218, 0.1)` → `var(--primary-tint)` (line 1065, 1844)
- `rgba(9, 105, 218, 0.12)` → `var(--primary-tint)` (lines 1137, 1508)
- `rgba(9, 105, 218, 0.14)` → `var(--primary-tint-border)` (line 1868)
- `rgba(9, 105, 218, 0.08)` → `var(--primary-tint)` (line 1870 — but this one is inside a `linear-gradient(135deg, rgba(9,105,218,0.08), rgba(9,105,218,0.03))`; replace both: `linear-gradient(135deg, var(--primary-tint), transparent)`)
- `rgba(9, 105, 218, 0.03)` → `transparent` (consumed by the line above)

Shadow literals → tokens:
- `0 8px 24px rgba(0,0,0,0.12)` (lines 967, 1186) → `var(--shadow-lg)`
- `0 4px 12px rgba(0,0,0,0.08)` (line 1291) → `var(--shadow-sm)`
- `0 2px 6px rgba(0,0,0,0.1)` (line 1310) → `var(--shadow-sm)`
- `0 4px 16px rgba(0,0,0,0.15)` (line 1560) → `var(--shadow-lg)`
- `0 6px 20px rgba(0,0,0,0.2)` (line 1570) → `var(--shadow-lg)`
- `0 24px 80px rgba(0,0,0,0.24)` (lines 1665, 1817) → `var(--shadow-xl)`

Note: the `getSkillColor()` palette at lines 109-116 is **kept** (decorative). Do not touch.

- [ ] **Step 3.2: Tools — replace the overlay shadow**

- `rgba(0, 0, 0, 0.5)` (line 1346, modal overlay) → `var(--color-overlay, rgba(0,0,0,0.5))`. Since `--color-overlay` isn't defined, simplest: leave as `rgba(0,0,0,0.5)` (modal overlays are conventionally theme-independent) OR add `--overlay` token. **Decision: leave the overlay literal** — it's a standard scrim, not a theme color. Document this as the one intentional exception.

So Tools actually needs **no changes** if we accept the overlay exception. Verify with:
```bash
grep -nE "#[0-9a-fA-F]{3,6}|rgba?\([0-9]" src/pages/Tools.tsx
```
Expected: only line 1346 (`rgba(0, 0, 0, 0.5)` overlay). Confirm and move on.

- [ ] **Step 3.3: Feedback — replace the two shadow literals**

- `0 14px 28px rgba(15,23,42,0.08)` (line 519, focused field) → keep the `var(--primary-tint-border)` ring part, drop the colored drop: result `0 0 0 3px var(--primary-tint-border)`. Read line 519 first — the full value is `"0 0 0 3px var(--primary-tint-border), 0 14px 28px rgba(15,23,42,0.08)"`; replace with `"0 0 0 3px var(--primary-tint-border), var(--shadow-lg)"`.
- `inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(15,23,42,0.04)` (line 520, unfocused) → replace the colored parts: `"inset 0 1px 0 rgba(255,255,255,0.55), var(--shadow-sm)"`. (The inset white highlight is a bevel — keep it.)

- [ ] **Step 3.4: Settings — replace the three literals**

- `rgba(34, 197, 94, 0.1)` (line 320, save badge green tint) → add a success-tint: this is `var(--color-success-bg)` (already defined in Phase 1). Replace with `var(--color-success-bg)`.
- `rgba(9, 105, 218, 0.2)` (line 814, update button border) → `var(--primary-tint-border)`.
- Line 1531 `ui-monospace, SFMono-Regular, Menlo, monospace` — leave (it's a `<kbd>` font-family, already correct, not a color).

- [ ] **Step 3.5: Verify no GitHub-blue remains across all four**

Run:
```bash
grep -nE "rgba\(9, ?105, ?218|rgba\(34, ?197, ?94" src/pages/Marketplace.tsx src/pages/Settings.tsx src/pages/Feedback.tsx || echo "clean"
```
Expected: `clean`.

- [ ] **Step 3.6: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 3.7: Commit**

```bash
git add src/pages/Marketplace.tsx src/pages/Settings.tsx src/pages/Feedback.tsx
git commit -m "refactor(theme): sweep Marketplace/Settings/Feedback hardcoded colors

Marketplace: ~15 blue/shadow literals -> tokens. Settings: save-badge
green -> var(--color-success-bg), update-button border -> primary-tint.
Feedback: field shadows -> shadow tokens. Tools left as-is (only a
theme-independent modal overlay, intentionally kept)."
```

---

## Task 4: Standardize card grids

Unify the three card grids to the same metrics for visual consistency.

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `src/pages/Tools.tsx`
- Modify: `src/pages/Marketplace.tsx`

- [ ] **Step 4.1: Unify grid template + radius**

For each grid container:
- Skills.tsx line ~2638: `gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px'` — already correct. Card `borderRadius: "14px"` (line 2689) → `borderRadius: "var(--radius)"`.
- Tools.tsx line ~1244 and ~1304: `minmax(340px, 1fr)` → `minmax(320px, 1fr)`. Card `borderRadius: "12px"` (line 769) → `var(--radius)`.
- Marketplace.tsx line ~1241: `minmax(280px, 1fr)` → `minmax(320px, 1fr)`. Card radius (find in the card style, ~line 1280) → `var(--radius)`.

Read each location first to get the exact string, then edit.

- [ ] **Step 4.2: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/pages/Skills.tsx src/pages/Tools.tsx src/pages/Marketplace.tsx
git commit -m "style(theme): unify card grids to 320px min / var(--radius)

Skills/Tools/Marketplace now share the same min card width (320px),
gap (16px), and corner radius (var(--radius) = 11px)."
```

---

## Task 5: Convert Settings to left sub-nav + right panel

The one structural change. Currently Settings is a single 680px-wide scroll with 9 stacked sections. Convert to: a left nav (section list) + right panel (the active section's content). Preserve hash deep-linking.

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 5.1: Read the current Settings main render**

Read `src/pages/Settings.tsx` lines 300-949 to understand the full section structure. The sections are (from exploration):
1. `settings-general` (L352)
2. `settings-marketplace` (L519)
3. `settings-appearance` (L604)
4. `settings-llm` (L651)
5. `settings-account` (L662)
6. shortcuts (L702, no id)
7. `settings-advanced` (L722, no id — actually has no `id` prop, but the key is `settings.advanced`)
8. `settings-about` (L760)
9. support (L897, no id)

Give the id-less sections ids so the sub-nav can target them: `settings-shortcuts`, `settings-advanced` (add id), `settings-support`.

- [ ] **Step 5.2: Add a section registry + active-section state**

At the top of the `Settings` component (after the existing state declarations, around line 50), add:

```tsx
const SETTINGS_SECTIONS = [
  { id: "settings-general", label: t("settings.general") },
  { id: "settings-marketplace", label: t("settings.marketplace") },
  { id: "settings-appearance", label: t("settings.appearance") },
  { id: "settings-llm", label: t("settings.llmTitle") },
  { id: "settings-account", label: t("settings.account") },
  { id: "settings-shortcuts", label: t("shortcuts.title") },
  { id: "settings-advanced", label: t("settings.advanced") },
  { id: "settings-about", label: t("settings.about") },
  { id: "settings-support", label: t("settings.support") },
] as const;

const [activeSection, setActiveSection] = useState<string>("settings-general");
```

- [ ] **Step 5.3: Update the hash deep-link effect**

The existing effect (lines 56-64) scrolls to the hash. Change it to set the active section instead:

```tsx
useEffect(() => {
  if (!config) return;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;
  if (SETTINGS_SECTIONS.some((s) => s.id === hash)) {
    setActiveSection(hash);
  }
}, [config, location]);
```

(Keep `SETTINGS_SECTIONS` in scope; if defined inside the component this works. If `t` isn't in scope where you place the array, move the array inside the component after `t` is defined.)

- [ ] **Step 5.4: Wrap each section in an id'd container and render only the active one**

Restructure the `<main>` (lines 345-949) into a two-column layout: a fixed-width left nav + a right panel. The right panel renders only the active section.

Replace the `<main>...</main>` block with:

```tsx
<main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
  {/* Left sub-nav */}
  <nav style={{
    width: 200,
    minWidth: 200,
    borderRight: '1px solid var(--border)',
    background: 'var(--background)',
    padding: '16px 8px',
    overflow: 'auto',
  }}>
    {SETTINGS_SECTIONS.map((section) => {
      const isActive = activeSection === section.id;
      return (
        <button
          key={section.id}
          type="button"
          onClick={() => {
            setActiveSection(section.id);
            window.location.hash = section.id;
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            marginBottom: 2,
            borderRadius: 'var(--radius)',
            border: 'none',
            background: isActive ? 'var(--sidebar-accent)' : 'transparent',
            color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
            fontSize: 13,
            fontWeight: isActive ? 500 : 400,
            cursor: 'pointer',
            transition: 'background-color 0.15s, color 0.15s',
          }}
        >
          {section.label}
        </button>
      );
    })}
  </nav>

  {/* Right panel — only the active section */}
  <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
    <div style={{ maxWidth: '680px' }}>
      {activeSection === 'settings-general' && (<>
        <SectionTitle>{t("settings.general")}</SectionTitle>
        <SettingsCard>{/* ...existing general section body... */}</SettingsCard>
      </>)}
      {activeSection === 'settings-marketplace' && (<>
        <SectionTitle>{t("settings.marketplace")}</SectionTitle>
        <SettingsCard>{/* ...existing marketplace section body... */}</SettingsCard>
      </>)}
      {/* ...one conditional block per section... */}
    </div>
  </div>
</main>
```

**How to execute this without rewriting 600 lines of JSX:** Move each existing `<SectionTitle>...</SectionTitle><SettingsCard>...</SettingsCard>` pair into its own conditional block. The bodies stay byte-for-byte identical — only the wrapping changes. Do this section by section with the Edit tool: for each section, wrap its existing JSX in `{activeSection === 'ID' && (<> ...existing... </>)}`.

The shortcuts, advanced, and support sections need their `<SectionTitle>` to carry the matching `id` (or just the conditional — the id is no longer needed for scroll, but keep it for safety).

- [ ] **Step 5.5: Verify build**

Run: `npm run build`
Expected: completes with no errors. (Watch for JSX errors from the wrapping — if `tsc` fails, the conditional wrapping has a syntax issue; fix and retry.)

- [ ] **Step 5.6: Verify deep-linking still works (manual)**

The CommandPalette items (`settingGeneral`, `settingAppearance`, etc.) call `goToSettingsSection("settings-general")` which navigates to `/settings` and sets `window.location.hash`. After Task 5.3, this sets `activeSection`. Confirm the effect picks up the hash.

- [ ] **Step 5.7: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat(settings): left sub-nav + right panel layout

Settings is no longer one long 680px scroll. A 200px left nav lists
the 9 sections; the right panel shows only the active one. Hash
deep-linking from CommandPalette now switches the active section
instead of scrolling. Section bodies are unchanged."
```

---

## Task 6: Editor + Welcome token sweep

Lighter pass — these are outside the main Layout shell and smaller.

**Files:**
- Modify: `src/pages/Editor.tsx`
- Modify: `src/components/editor/FileTree.tsx`
- Modify: `src/components/welcome/WelcomeStep.tsx`
- Modify: `src/components/welcome/ToolDetectionStep.tsx`
- Modify: `src/components/welcome/DirectorySetupStep.tsx`
- Modify: `src/components/welcome/ImportSkillsStep.tsx`

- [ ] **Step 6.1: Find hardcoded colors in these files**

Run:
```bash
grep -nE "#[0-9a-fA-F]{3,6}|rgba?\([0-9]" src/pages/Editor.tsx src/components/editor/FileTree.tsx src/components/welcome/*.tsx | grep -v "rgba(0, ?0, ?0, ?0\.[0-9]" || echo "only shadow literals"
```
Review the output. Shadow literals (`rgba(0,0,0,0.X)`) → `var(--shadow-*)`. Any `#hex` → nearest token.

- [ ] **Step 6.2: Apply the sweep**

For each hit, replace with the appropriate token using the same rules as Task 2 (shadows → `var(--shadow-sm/lg/xl)`, blues → `var(--primary-tint)`, reds → `var(--destructive)`). Use targeted edits; these files are smaller so line-by-line is feasible.

If a file has no hits, skip it.

- [ ] **Step 6.3: Verify build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 6.4: Commit**

```bash
git add -A
git commit -m "refactor(theme): sweep Editor + Welcome hardcoded colors to tokens"
```

---

## Task 7: Phase 3 acceptance verification

- [ ] **Step 7.1: Build passes**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 7.2: Tests pass**

Run: `npm test`
Expected: 3 fontFamily tests pass.

- [ ] **Step 7.3: Hardcoded-color scan (pages + editor + welcome)**

Run:
```bash
grep -rnE "#[0-9a-fA-F]{3,6}|rgba?\([0-9]" src/pages src/components/editor src/components/welcome | grep -vE "rgba\(0, ?0, ?0, ?0\.5\)|linear-gradient\(135deg, #|getSkillColor|#fff" || echo "clean (excluding known exceptions)"
```
Expected: `clean (excluding known exceptions)`. Known exceptions that may still appear: the Marketplace/Skills gradient palette (`getSkillColor`, decorative), `#fff` inside that palette, and any `rgba(0,0,0,0.5)` modal overlays. Anything else is a miss — fix it.

- [ ] **Step 7.4: Manual visual smoke test in Tauri window**

Run: `npm run tauri dev`

Verify in BOTH themes:
1. **Skills**: cards render with the Raycast palette; selected/hover states use the primary-tint (no blue tint). Tag chips, batch-select, enabled-tool chips all themed.
2. **Tools**: cards look right; the one overlay exception is fine.
3. **Marketplace**: sort/tag/filter UI themed; cards consistent with Skills.
4. **Settings**: left sub-nav shows 9 sections; clicking switches the right panel; deep-linking from ⌘K palette works (search "general settings" → opens Settings on General).
5. **Feedback**: form fields themed.
6. **Editor**: top bar + file tree themed.
7. **Welcome**: all 4 steps themed.
8. Card grids across Skills/Tools/Marketplace have consistent width/radius.
9. No regression: create/edit/delete skills, toggle tools, install from marketplace, save settings.

If any fail, stop and fix.

- [ ] **Step 7.5: Commit any verification fixes**

```bash
git add -A
git commit -m "fix(theme): phase 3 verification fixes"
```

---

## Phase 3 Completion

After Task 7 passes:
- Every page renders in the Raycast palette with no hardcoded theme colors (except the intentional decorative + overlay exceptions).
- Settings is a sub-nav app, not a scroll.
- Card grids are visually consistent.
- The app is feature-complete and themed end-to-end.

**Next:** Phase 4 (Polish) — animations, atmosphere gradients, empty states, focus audit, full Tailwind migration of page bodies, card-component extraction. Write that plan after Phase 3 merges.
