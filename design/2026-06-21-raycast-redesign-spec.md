# Skills Manager — Raycast-Style UI Redesign

> **Status:** Approved design spec — 2026-06-21
> **Reference:** `DESIGN.md` (Raycast style reference at repo root)
> **Scope:** Full visual + structural redesign of the Skills Manager UI in both light and dark themes, unifying the styling system and adopting the Raycast aesthetic.

---

## 1. Locked Decisions

These five decisions were validated during brainstorming and govern the entire design.

| Area | Decision | Rationale |
|---|---|---|
| **Theme mode** | Full parity — both light and dark themes fully redesigned | No feature regression; dark is the showcase, light stays cohesive |
| **Navigation** | Palette-first; sidebar removed | Adopt Raycast's command-palette-centric identity |
| **Home view** | Top search bar + ⌘K; content dominates | Palette handles actions, pages handle browsing |
| **Accent / primary action** | Near-white CTA (`#e6e6e6`) for primary; Ember Red (`#ff6363`) for destructive only | Raycast's inverted convention + practical red-means-delete |
| **Fonts** | Adopt Inter + GeistMono as default; keep the font picker | Faithful to Raycast; no setting regression |

**Selection styling rule (refined):** selected rows use a plain monochrome white fill (`rgba(255,255,255,0.06)` in dark) — no colored accent border, no Sky-Signal tint. Selected text upgrades to `#fff`; unselected stays `#9c9c9d`. The contrast marks the selection.

---

## 2. Token Foundation & CSS Architecture

### 2.1 Single source of truth

Rewrite `src/index.css` to a clean Tailwind v4 structure:
- Replace the current hybrid v3 `@tailwind base/components/utilities` directives with `@import "tailwindcss"`.
- Keep one `@theme` block mapping `--color-*` keys to raw CSS variables (so existing utilities like `bg-background`, `text-muted-foreground` resolve to the new values without component edits).
- Delete the stale `src/App.css` (unused legacy template CSS).

### 2.2 Token mapping

The Raycast palette maps onto the existing shadcn token names so existing utilities resolve to new values without component-by-component edits.

| shadcn token (kept) | Dark value (Raycast) | Light value (new) |
|---|---|---|
| `--background` | `#040506` (void black) | `#fbfbfa` (warm paper) |
| `--card` / `--popover` | `#07080a` (deep charcoal) | `#ffffff` |
| `--secondary` | `#111214` (graphite-700) | `#f4f4f2` |
| `--muted-foreground` | `#9c9c9d` (slate-200) | `#6a6b6c` (slate-300) |
| `--border` / `--input` | `#363739` (graphite-500) | `#e4e4e0` |
| `--foreground` | `#ffffff` (snow) | `#1a1a1a` |
| `--primary` | `#e6e6e6` (ash-50 — CTA) | `#1a1a1a` |
| `--primary-foreground` | `#2f3031` | `#ffffff` |
| `--destructive` | `#ff6363` (ember red) | `#d32f2f` |
| `--ring` | `#454647` (graphite-400) | `#363739` (graphite-500) |

### 2.3 New semantic tokens

Add to `:root` / `.dark` and wire into `@theme`:
- **Radius scale:** `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 11px`, `--radius-xl: 16px`, `--radius-full: 9999px`. Base `--radius: 11px`.
- **Shadow series** (Raycast layered shadows, all monochrome `rgba(0,0,0,x)` / `rgba(255,255,255,x)` — never color-tinted):
  - `--shadow-subtle` — card baseline (white inset + black drop)
  - `--shadow-sm` — button/dropdown drop
  - `--shadow-xl` — modal/palette (`rgba(0,0,0,0.4) 0px 4px 40px 8px` + black ring + white inset hairline)
  - `--shadow-ring` — interactive ring border (`rgb(27,28,30) 0 0 0 1px, rgb(7,8,10) 0 0 0 1px inset`)
  - `--shadow-highlight` — selected card (white 0.25 outer ring)
- **Atmosphere gradients** (used sparingly on hero/settings only):
  - `--gradient-nebula`: `radial-gradient(84.6% 73.49% at 50% 26.51%, rgba(4,63,150,0.7), rgba(6,18,37,0.25))`
  - `--gradient-violet`: `radial-gradient(86.88% 75.47% at 50% 24.53%, rgba(82,48,145,0.7), rgba(26,11,51,0.14))`

### 2.4 Typography

- Bundle **Inter** (weights 400/500/600) and **GeistMono** (weights 300/400/500) locally as woff2 via `@fontsource` (or equivalent) so they are always available offline in the Tauri desktop context.
- New tokens: `--font-sans: 'Inter', ui-sans-serif, system-ui, ...` and `--font-mono: 'GeistMono', ui-monospace, ...`.
- **Code blocks, keyboard hint chips (`⌘K`, `↵`), version strings always use GeistMono** regardless of the user's font preset — this is hardcoded, not part of the picker.
- Inter tightens at display sizes: negative tracking on headings ≥24px (`-0.05px` to `-0.13px`); positive tracking on captions/badges (`+0.04em` to `+0.073em`).
- `src/lib/fontFamily.ts` preset picker **kept**; add a new default preset **"Raycast (Inter)"** as the first option. Existing system/rounded/serif presets remain available.

### 2.5 Scrollbar

Make theme-aware (currently hardcoded to a black-alpha thumb that looks wrong in dark mode):
- Track: `transparent`. Thumb: `var(--border)`. Width: 11px, thin slider with 3px radius.
- Both themes use the same construction reading from tokens.

### 2.6 Hardcoded-color cleanup

These were flagged in exploration as bypassing the theme system. All must be re-pointed to tokens:
- `src/components/ui/toast.tsx` — hardcoded `#fef2f2`, `#dc2626`, `#f0fdf4`, `#16a34a`, `#eff6ff`, `#2563eb`, `#bfdbfe`, `#bbf7d0` → semantic tokens.
- `src/components/ui/toggle.tsx` — hardcoded `#3b82f6`, `#4b5563`, `#d1d5db` → tokens.
- `src/components/layout/Layout.tsx` sync banner — hardcoded `#fefce8`, `#ca8a04`, `#a16207` (yellow palette) → warning tokens.
- `src/components/layout/Sidebar.tsx` and `src/components/auth/AuthButton.tsx` hover — `rgba(0,0,0,0.04)` (darkens wrongly in dark mode) → `var(--sidebar-accent)`.

---

## 3. Navigation & App Shell

### 3.1 Structural change

Remove the left `Sidebar` (200px) entirely. Replace with a single 52px top bar. `Layout.tsx` collapses to `TopBar` + `<main><Outlet/></main>`.

### 3.2 TopBar composition (left → right)

1. **Window-drag / traffic-light zone** (72px on macOS) — preserves the existing Tauri drag-region behavior. Transparent, `WebkitAppRegion: 'drag'`.
2. **Brand** — ember ✦ + "Skills" wordmark (Inter weight 600, tight tracking).
3. **Scope search field** (center, flexible width up to ~520px) — see §3.3.
4. **Page actions** (right) — each page renders its own contextual actions here (e.g. "+ New Skill" on Skills, "Refresh" on Marketplace, "Save" on Editor). Not global.

### 3.3 Scope search field (the primary navigation primitive)

The search field is the centerpiece. It shows the current page as a clickable chip on the left, and supports two modes:

**State A — Normal (browsing current page):**
- Field shows: `[✦ Skills ▾]  Search skills…   [⌘K]`
- The chip (`✦ <PageName> ▾`) always reflects the active route.
- Plain typing searches content/actions within the current page and **falls back to the full command palette** when nothing local matches. This is a navigation/action surface — it does **not** duplicate page-level filters (the Skills tag-filter bar and Marketplace search sub-bar remain independent, in-page filters).

**State B — Page switcher (triggered by typing `/` or clicking the chip):**
- A dropdown anchors to the field, listing all 5 destinations (Skills, Tools, Marketplace, Settings, Feedback).
- Each row: icon · name · right-side count metadata in GeistMono.
- Filter by typing; navigate with `↑↓`; select with `↵`.
- Monochrome fill selection (no colored accent) per §1.

### 3.4 ⌘K command palette (unchanged trigger, elevated treatment)

⌘K still opens the full command palette (all actions + all destinations + skill search). The `/` scope mode is a lighter, page-scoped subset; ⌘K is the full power-user surface. Both coexist.

### 3.5 Files affected

| File | Action |
|---|---|
| `src/components/layout/Sidebar.tsx` | **Delete** |
| `src/components/layout/sidebarChrome.ts` (+ test) | **Delete** |
| `src/components/layout/Layout.tsx` | Rewrite: `TopBar` + `<main>` only |
| `src/components/TopBar.tsx` | **New** — the 52px bar |
| `src/components/ScopeSearchField.tsx` | **New** — chip + `/` dropdown logic |
| `src/components/CommandPalette.tsx` | Rewrite — elevated Raycast treatment (§4) |
| `src/components/ui/page-header.tsx` | **Delete** (replaced by TopBar page-action slot) |
| All routes | **Unchanged** — `/`, `/tools`, `/marketplace`, `/settings`, `/feedback`, `/editor` |

---

## 4. Component System

### 4.1 Unification principle

Stop mixing the two styling paradigms. **Every** `src/components/ui/*` component and every custom component is converted to Tailwind utilities + design tokens. No inline `style={{}}` objects, no hardcoded hex. This is the deduplication payoff.

### 4.2 Component specs (dark values; light mirrors via tokens)

| Component | Surface | Border | Radius | Shadow | Key detail |
|---|---|---|---|---|---|
| Button primary | `#e6e6e6` fill | — | 8px | `--shadow-sm` | Text `#2f3031`, weight 500 |
| Button destructive | `#ff6363` fill | — | 8px | `--shadow-sm` | White text |
| Button outline/ghost | transparent | `#454647` | 8px | — | Hover → `rgba(255,255,255,0.06)` |
| Card | `#07080a` | `rgba(255,255,255,0.06)` | 11px | `--shadow-subtle` | Padding 24px |
| Card (selected) | `#07080a` | `rgba(255,255,255,0.25)` ring | 11px | `--shadow-highlight` | White outer ring marks selection |
| Badge / chip | `#1b1c1e` | — | 6px | — | Weight 500, tracking `+0.04em` |
| Badge (destructive) | `#452324` | — | 6px | — | Ember-dark bg, ember-red text |
| Input | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.1)` | 8px | — | Focus ring = `#454647` |
| Toggle off | `#1b1c1e` | — | full | — | Knob `#9c9c9d` |
| Toggle on | `#e6e6e6` | — | full | — | Knob `#040506` |
| Status dot | semantic dot | — | full | — | 8px; ember-red / mint `#59d499` / sky `#56c2ff` |
| Modal | `#07080a` | `rgba(255,255,255,0.1)` | 16px | `--shadow-xl` | Respects `constants/modal.ts` (980px detail, 420px create) |
| Command palette | `#07080a` | `#363739` | 16px | `--shadow-xl` | See §4.3 |
| Toast | `#1b1c1e` | semantic | 8px | `--shadow-xl` | Token-driven accent bar (no hardcoded hex) |

### 4.3 Elevated Command Palette (signature component)

The component closest to Raycast's identity gets the most investment:
- **16px radius** (from 14px), layered graphite shadow (`--shadow-xl`).
- **Result rows:** icon · title · right-side GeistMono metadata label (e.g. "SKILL", "TOOL", "ACTION", file counts) · kbd shortcut hint when applicable.
- **Section dividers:** uppercase section labels (`NAVIGATION`, `SKILLS`, `ACTIONS`) at 10px with `+0.04em` tracking and slate-300 color.
- **Selected row:** monochrome `rgba(255,255,255,0.06)` fill, no colored accent. Selected text → `#fff`.
- **Hover row:** `rgba(255,255,255,0.03)` fill.
- **Footer:** GeistMono keyboard legend — `↑↓ navigate  ·  ↵ select  ·  esc dismiss`.

### 4.4 Selection rule (applies palette-wide)

The monochrome-fill selection from §1 applies uniformly to: Command Palette results, `/` page-switcher dropdown, and any future list/grid selection states. Consistency over per-component special-casing.

---

## 5. Per-Page Redesign

Every page gets the token + component lift. Structural changes vary by page.

### 5.1 Skills (`/`) — highest priority

- Redesign as a **card grid** (the home-view mockup). Each skill card: ember ✦ icon · name (weight 600) · file count + last-updated (GeistMono, slate-300).
- **Tag filter bar** retained, restyled as badge chips.
- Batch operations and create/open-in-editor actions move into the **TopBar page-action slot** (right side).
- Translation + project-bindings dialogs retained, restyled.

### 5.2 Tools (`/tools`)

- Tool card grid, same card system. Each tool card: icon · name · enabled-skill count.
- Toggling individual skills becomes an **inline toggle on the card row** (no dialog round-trip).
- Bulk toggle + relation dialogs retained, restyled.

### 5.3 Marketplace (`/marketplace`)

- Sort-mode + search filters combined in a top sub-bar, then skill card grid.
- `InstallCountBadge` restyled.
- Skill detail modal keeps 980px width, gets Raycast modal spec (16px radius, `--shadow-xl`, blur backdrop per `modal.ts`).
- GitHub direct-install retained.

### 5.4 Settings (`/settings`)

- Convert from long-scroll to **left sub-nav + right panel** (sections: General / Appearance / Marketplace / LLM / Account / About). Hash deep-linking preserved.
- Theme picker, font picker (now with "Raycast (Inter)" default), update checker, GitHub token — all get Raycast form-input treatment.
- Donation QR codes retained.

### 5.5 Feedback (`/feedback`)

- Compact single-column form. Contact type/value/content inputs, GitHub issues link, QR codes (WeChat/Feishu). Restyle only; no structural change.

### 5.6 Editor (`/editor`)

- Already full-screen Monaco (outside Layout shell). Restyle top bar → Raycast treatment (save, translate actions, Linux notice).
- **FileTree sidebar** gets graphite surface treatment.
- **Monaco theme** set to a custom Raycast color scheme (dark void background, slate text, ember accents). This is the one place Monaco itself needs theme tokens.

### 5.7 Welcome wizard

- 4 steps restyled. The welcome/brand page specifically gets a **hero treatment** with radial nebula-gradient atmosphere (`--gradient-nebula`), making it feel like a product launch.
- Tool detection, directory setup, import-skills steps get Raycast form-input treatment.

---

## 6. Component Simplification Summary

The inline-style components are removed or converted, eliminating the dual-paradigm clutter:

| Component | Action |
|---|---|
| `Sidebar.tsx` + `sidebarChrome.ts` | **Delete** |
| `Layout.tsx` | Simplify to `TopBar` + `main` (~60 lines) |
| `page-header.tsx` (inline-styled) | **Delete** — replaced by TopBar page-action slot |
| `toggle.tsx`, `toast.tsx`, `loading.tsx`, `refresh-button.tsx` | Convert to tokens; remove hardcoded hex |
| `TopBar.tsx` | **New** |
| `ScopeSearchField.tsx` | **New** (`/` + chip logic) |

---

## 7. Implementation Phasing

Four phases, each independently shippable. The token work (Phase 1) is foundational — everything depends on it.

### Phase 1 — Foundation
- Rewrite `src/index.css` → pure Tailwind v4; all new tokens for both themes.
- Bundle Inter + GeistMono.
- Theme-aware scrollbar.
- Remove hardcoded colors from toast/toggle/loading/banner/Sidebar hover.
- **No visual reorg yet** — components keep their positions, just render in the new palette.
- Risk: low (token interpolation, reversible).

### Phase 2 — Shell + Primitives
- New `TopBar` + `ScopeSearchField`.
- Delete Sidebar; rewrite Layout.
- Convert all 11 `ui/*` components to tokens.
- Elevate CommandPalette (16px radius, kbd hints, monochrome selection).
- Risk: medium (structural, but app remains functional throughout).

### Phase 3 — Pages
- Redesign Skills → Tools → Marketplace → Settings → Feedback per §5.
- Welcome wizard.
- Editor: Raycast Monaco theme + FileTree restyle.
- Risk: medium (pure visual rework).

### Phase 4 — Polish
- Animations: 200ms `ease` micro-interactions, `cubic-bezier(0.23,1,0.32,1)` entrances (outQuint). Nothing exceeds 700ms.
- Radial gradient atmosphere (hero, settings).
- Empty states, focus-state audit.
- Regression test across both themes.
- Risk: low.

---

## 8. Out of Scope (Untouched)

- `src/pages/skills/`, `pages/tools/`, `pages/marketplace/`, `pages/polls/`, `projectBindings.ts` — pure logic + tests, no UI.
- `src/services/`, `src/telemetry/`, `src/contexts/`, most of `src/hooks/` (only `useTheme` gets a new default value).
- Tauri Rust backend (`src-tauri/`).
- Routing structure — all routes preserved, just reached differently.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Removing the sidebar reduces discoverability for mouse-only users | Scope chip + `/` trigger is always visible in the top bar; ⌘K opens full palette; both are one interaction away |
| Two full theme palettes to maintain long-term | Tokens are the single source — both themes read the same token names with different values, so component code is theme-agnostic |
| Monaco theming is isolated to one page | Keep the custom theme self-contained in the Editor page; document it as an exception |
| Font bundling increases app size | Inter + GeistMono woff2 subsets are ~100KB combined; acceptable for a desktop app |

---

## 10. Success Criteria

The redesign is complete when:
1. No inline `style={{}}` objects with hardcoded hex remain in `src/components/**` or `src/pages/**`.
2. Both light and dark themes render the full app with the Raycast aesthetic (validated across all 6 pages + welcome wizard + editor).
3. The sidebar is gone; navigation works via scope chip + `/` + ⌘K with no lost functionality.
4. Every primary action uses the near-white CTA; every destructive action uses ember red; no blue-primary buttons remain.
5. Inter is the default UI font; GeistMono is used for all code/keys/versions regardless of preset.
6. The command palette uses 16px radius, kbd hints, monochrome selection, GeistMono metadata.
7. No regression in functionality — all existing features (create/edit/delete skills, tool toggles, marketplace install, settings, feedback, editor) work identically.
