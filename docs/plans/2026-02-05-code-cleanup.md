# Code Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 清理冗余代码、提取公共组件、统一样式规范，确保第一版代码简洁高质量。

**Architecture:** 分三个阶段执行：快速修复（删除死代码、修复类型）→ 组件提取（DRY 原则）→ 样式统一（CSS 变量 + Tailwind）

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Monaco Editor

---

## Phase 1: Quick Fixes (快速修复)

### Task 1.1: Remove console.error statements

**Files:**
- Modify: `src/pages/Settings.tsx:58`
- Modify: `src/pages/Welcome.tsx:42`

**Step 1: Remove console.error from Settings.tsx**

找到并删除：
```typescript
console.error("Failed to load editors:", err);
```

**Step 2: Remove console.error from Welcome.tsx**

找到并删除：
```typescript
console.error("Failed to save preferences:", error);
```

**Step 3: Verify no console statements remain**

Run: `grep -rn "console\." src/pages/`
Expected: No results (or only intentional debug statements)

**Step 4: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Welcome.tsx
git commit -m "fix: remove console.error statements per coding standards"
```

---

### Task 1.2: Add i18n for "Modified" string in Editor

**Files:**
- Modify: `src/pages/Editor.tsx:190-191`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**Step 1: Add translation keys to zh.ts**

在 `editor` 对象中添加：
```typescript
modified: "已修改",
```

**Step 2: Add translation keys to en.ts**

在 `editor` 对象中添加：
```typescript
modified: "Modified",
```

**Step 3: Replace hardcoded string in Editor.tsx**

将：
```typescript
<span style={{...}}>
  Modified
</span>
```

改为：
```typescript
<span style={{...}}>
  {t("editor.modified")}
</span>
```

**Step 4: Verify the change**

Run: `npm run tauri dev`
Expected: "Modified" 或 "已修改" 根据语言设置正确显示

**Step 5: Commit**

```bash
git add src/pages/Editor.tsx src/i18n/locales/zh.ts src/i18n/locales/en.ts
git commit -m "fix: add i18n for Modified string in editor"
```

---

### Task 1.3: Fix Monaco Editor theme sync

**Files:**
- Modify: `src/pages/Editor.tsx`

**Step 1: Import useTheme hook**

确保从 theme context 导入：
```typescript
import { useTheme } from "../contexts/ThemeContext";
```

**Step 2: Get current theme in component**

在组件内部：
```typescript
const { theme } = useTheme();
```

**Step 3: Update Monaco Editor theme prop**

将：
```typescript
theme="vs-dark"
```

改为：
```typescript
theme={theme === "dark" ? "vs-dark" : "light"}
```

**Step 4: Verify theme switching**

Run: `npm run tauri dev`
Expected: 切换主题时编辑器主题同步变化

**Step 5: Commit**

```bash
git add src/pages/Editor.tsx
git commit -m "fix: sync Monaco editor theme with app theme"
```

---

### Task 1.4: Remove unused initialLoading state

**Files:**
- Modify: `src/pages/Settings.tsx:25`
- Modify: `src/pages/Skills.tsx:43`

**Step 1: Remove from Settings.tsx**

删除：
```typescript
const [initialLoading, setInitialLoading] = useState(true);
```

以及所有 `setInitialLoading` 调用。

**Step 2: Remove from Skills.tsx**

删除：
```typescript
const [initialLoading, setInitialLoading] = useState(true);
```

以及所有 `setInitialLoading` 调用。

**Step 3: Verify no TypeScript errors**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Skills.tsx
git commit -m "refactor: remove unused initialLoading state variables"
```

---

### Task 1.5: Fix editorRef type

**Files:**
- Modify: `src/pages/Editor.tsx:24`

**Step 1: Import Monaco editor type**

```typescript
import type { editor } from "monaco-editor";
```

**Step 2: Update useRef type**

将：
```typescript
const editorRef = useRef<unknown>(null);
```

改为：
```typescript
const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
```

**Step 3: Verify TypeScript is happy**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/pages/Editor.tsx
git commit -m "fix: add proper type for Monaco editor ref"
```

---

### Task 1.6: Remove toolAbbreviations dead code

**Files:**
- Modify: `src/pages/Skills.tsx:10-12`

**Step 1: Identify and remove dead code**

删除：
```typescript
const toolAbbreviations: Record<string, string> = {
  "codex": "Codex",
};
```

**Step 2: Verify no references remain**

Run: `grep -n "toolAbbreviations" src/`
Expected: No results

**Step 3: Verify app still works**

Run: `npm run tauri dev`
Expected: Skills 页面正常显示

**Step 4: Commit**

```bash
git add src/pages/Skills.tsx
git commit -m "refactor: remove unused toolAbbreviations constant"
```

---

## Phase 2: Component Extraction (组件提取)

### Task 2.1: Extract Toggle component

**Files:**
- Create: `src/components/ui/toggle.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Tools.tsx`

**Step 1: Create Toggle component**

```typescript
// src/components/ui/toggle.tsx
import { useTheme } from "../../contexts/ThemeContext";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: checked ? "#3b82f6" : isDark ? "#4b5563" : "#d1d5db",
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
          backgroundColor: "white",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}
```

**Step 2: Replace inline Toggle in Settings.tsx**

导入并使用新组件替换内联实现。

**Step 3: Replace inline toggle in Tools.tsx**

导入并使用新组件替换内联实现。

**Step 4: Verify both pages work**

Run: `npm run tauri dev`
Expected: 两个页面的 Toggle 正常工作

**Step 5: Commit**

```bash
git add src/components/ui/toggle.tsx src/pages/Settings.tsx src/pages/Tools.tsx
git commit -m "refactor: extract Toggle component to shared UI"
```

---

### Task 2.2: Extract RefreshButton component

**Files:**
- Create: `src/components/ui/refresh-button.tsx`
- Modify: `src/pages/Skills.tsx`
- Modify: `src/pages/Tools.tsx`

**Step 1: Create RefreshButton component**

```typescript
// src/components/ui/refresh-button.tsx
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function RefreshButton({ onClick, loading = false }: RefreshButtonProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === "dark";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        backgroundColor: isDark ? "#374151" : "#f3f4f6",
        border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
        borderRadius: 8,
        cursor: loading ? "not-allowed" : "pointer",
        fontSize: 14,
        color: isDark ? "#e5e7eb" : "#374151",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        style={{
          animation: loading ? "spin 1s linear infinite" : "none",
        }}
      >
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      {t("common.refresh")}
    </button>
  );
}
```

**Step 2: Replace in Skills.tsx and Tools.tsx**

导入并使用新组件。

**Step 3: Verify refresh works on both pages**

Run: `npm run tauri dev`
Expected: 刷新按钮在两个页面正常工作

**Step 4: Commit**

```bash
git add src/components/ui/refresh-button.tsx src/pages/Skills.tsx src/pages/Tools.tsx
git commit -m "refactor: extract RefreshButton component to shared UI"
```

---

### Task 2.3: Extract theme icons to shared components

**Files:**
- Create: `src/components/icons/theme-icons.tsx`
- Modify: `src/pages/Welcome.tsx`
- Modify: `src/pages/Settings.tsx`

**Step 1: Create theme icons file**

```typescript
// src/components/icons/theme-icons.tsx
interface IconProps {
  size?: number;
  className?: string;
}

export function SunIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function MoonIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function MonitorIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
```

**Step 2: Update Welcome.tsx to use shared icons**

删除本地图标定义，导入共享组件。

**Step 3: Update Settings.tsx to use shared icons**

删除内联 SVG，导入共享组件。

**Step 4: Verify theme selector works**

Run: `npm run tauri dev`
Expected: 主题选择器在欢迎页和设置页正常显示

**Step 5: Commit**

```bash
git add src/components/icons/theme-icons.tsx src/pages/Welcome.tsx src/pages/Settings.tsx
git commit -m "refactor: extract theme icons to shared components"
```

---

### Task 2.4: Use Alert component for error display

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Tools.tsx`

**Step 1: Check existing Alert component**

确认 `src/components/ui/alert.tsx` 存在并了解其 API。

**Step 2: Replace inline error in Settings.tsx**

将硬编码的错误显示样式替换为 Alert 组件：
```typescript
import { Alert, AlertDescription } from "../components/ui/alert";

// 替换为：
<Alert variant="destructive">
  <AlertDescription>{error}</AlertDescription>
</Alert>
```

**Step 3: Replace inline error in Tools.tsx**

同样替换为 Alert 组件。

**Step 4: Verify error display works**

模拟错误场景验证显示正确。

**Step 5: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Tools.tsx
git commit -m "refactor: use Alert component for error display"
```

---

## Phase 3: Style Unification (样式统一)

### Task 3.1: Define CSS color variables

**Files:**
- Create or Modify: `src/index.css`

**Step 1: Add CSS custom properties**

在 `:root` 中添加：
```css
:root {
  /* Semantic colors */
  --color-error: #dc2626;
  --color-error-bg: #fef2f2;
  --color-error-border: #fecaca;

  --color-success: #16a34a;
  --color-success-bg: #dcfce7;
  --color-success-border: #bbf7d0;

  --color-warning: #ca8a04;
  --color-warning-bg: #fefce8;
  --color-warning-border: #fef08a;

  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;

  /* Dark mode overrides */
  &.dark {
    --color-error-bg: #450a0a;
    --color-error-border: #7f1d1d;
    --color-success-bg: #052e16;
    --color-success-border: #14532d;
    --color-warning-bg: #422006;
    --color-warning-border: #713f12;
  }
}
```

**Step 2: Verify variables are available**

Run: `npm run tauri dev`
Expected: 应用正常启动

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add semantic color CSS variables"
```

---

### Task 3.2: Replace hardcoded colors with CSS variables

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Tools.tsx`
- Modify: `src/pages/Sync.tsx`

**Step 1: Replace colors in Skills.tsx**

将 `#16a34a` 替换为 `var(--color-success)`，以此类推。

**Step 2: Replace colors in Settings.tsx**

同上。

**Step 3: Replace colors in Tools.tsx**

同上。

**Step 4: Replace colors in Sync.tsx**

同上。

**Step 5: Verify all pages display correctly**

Run: `npm run tauri dev`
Expected: 所有颜色正确显示

**Step 6: Commit**

```bash
git add src/pages/Skills.tsx src/pages/Settings.tsx src/pages/Tools.tsx src/pages/Sync.tsx
git commit -m "refactor: replace hardcoded colors with CSS variables"
```

---

### Task 3.3: Extract PageHeader component

**Files:**
- Create: `src/components/ui/page-header.tsx`
- Modify: All page files

**Step 1: Create PageHeader component**

```typescript
// src/components/ui/page-header.tsx
import { useTheme } from "../../contexts/ThemeContext";

interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
      }}
    >
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: isDark ? "#f9fafb" : "#111827",
        }}
      >
        {title}
      </h1>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {actions}
        </div>
      )}
    </header>
  );
}
```

**Step 2: Replace headers in all pages**

依次更新 Skills.tsx, Tools.tsx, Sync.tsx, Settings.tsx。

**Step 3: Verify all page headers display correctly**

Run: `npm run tauri dev`
Expected: 所有页面标题正常显示

**Step 4: Commit**

```bash
git add src/components/ui/page-header.tsx src/pages/*.tsx
git commit -m "refactor: extract PageHeader component to shared UI"
```

---

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1 | 6 tasks | Low |
| Phase 2 | 4 tasks | Medium |
| Phase 3 | 3 tasks | Medium |

**Total: 13 tasks**

执行完成后，代码将：
- 符合 coding-style.md 规范
- 遵循 DRY 原则（无重复组件）
- 使用统一的颜色系统
- 具有更好的类型安全性
