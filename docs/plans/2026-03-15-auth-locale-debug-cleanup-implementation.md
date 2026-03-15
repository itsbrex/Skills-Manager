# Auth Locale + Debug Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** OAuth 登录中间页按客户端 `locale` 显示语言（默认 `en`），并移除客户端 OAuth 调试 UI 与 auth-debug 日志代码。

**Architecture:** `skills-market-api` 在 `/auth/start` 存储 `locale` 到 `auth_states`，回调页按 `locale` 选择文案并回退 `en`。`skills-manager` 传递客户端语言到 `/auth/start`，并删除调试日志/面板但保留正常深链路处理。

**Tech Stack:** Cloudflare Workers (Hono, D1, Vitest), Tauri (Rust), React/TypeScript。

---

### Task 1: skills-market-api 加入 locale 存储与回调页多语言（TDD）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-market-api/test/auth.test.ts`
- Modify: `/Users/yjw/code/projects/skills-market-api/migrations/0007_add_auth_sync_tables.sql`
- Modify: `/Users/yjw/code/projects/skills-market-api/src/index.ts`

**Step 1: Write the failing tests**

在 `test/auth.test.ts` 中：
- 更新 `resetAuthSchema` 的 `auth_states` 表结构，加入 `locale TEXT` 列。
- 新增测试：`GET /api/v1/auth/github/start stores locale`
  - 请求 `/auth/github/start?...&locale=zh`
  - 查询 `auth_states.locale`，断言为 `zh`
- 新增测试：`GET /api/v1/auth/github/callback renders English copy when locale=en`
  - 先插入 `auth_states`，带 `locale='en'`
  - 请求 `/auth/github/callback?code=authcode&state=s1`
  - 断言 HTML 包含英文标题（例如 `Open Skills Manager to finish signing in`）

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/yjw/code/projects/skills-market-api
npx vitest run test/auth.test.ts
```
Expected: FAIL（locale 未存储、回调页仍是中文）

**Step 3: Write minimal implementation**

在 `src/index.ts`：
- 新增 `const DEFAULT_AUTH_LOCALE = 'en';`
- `/api/v1/auth/:provider/start` 读取 `locale` query，使用 `normalizeLocale` 并回退 `DEFAULT_AUTH_LOCALE`，写入 `auth_states.locale`
- `/api/v1/auth/:provider/callback` 查询 `auth_states.locale`，回退 `DEFAULT_AUTH_LOCALE`
- 用简单映射渲染 HTML 文案（`en` / `zh`），并设置 `<html lang="...">`

在迁移 `0007_add_auth_sync_tables.sql`：
- `auth_states` 增加 `locale TEXT` 列（可空）

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/yjw/code/projects/skills-market-api
npx vitest run test/auth.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-market-api/test/auth.test.ts \
  /Users/yjw/code/projects/skills-market-api/src/index.ts \
  /Users/yjw/code/projects/skills-market-api/migrations/0007_add_auth_sync_tables.sql

git commit -m "feat: add locale-aware auth callback page"
```

---

### Task 2: skills-manager 传递 locale 到 /auth/start（TDD）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src/services/auth.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src/pages/Settings.tsx`

**Step 1: Write the failing test**

在 `src-tauri/src/services/auth.rs` 的测试中：
- 将 `build_auth_start_url` 测试改为期望包含 `locale=en`

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/yjw/code/projects/skills-manager/src-tauri
cargo test
```
Expected: FAIL（URL query 缺少 `locale`）

**Step 3: Write minimal implementation**

- `build_auth_start_url` 增加 `locale` 参数，非空时追加 query `locale=...`
- `start_oauth_auth` / `start_github_auth` / `start_google_auth` 接受并传递 `locale`
- 前端 `startGithubAuth` / `startGoogleAuth` 传入当前语言（来自 `useTranslation().language`）
- 在 `Sidebar.tsx` 与 `Settings.tsx` 的登录入口调用时传入 `language`

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/yjw/code/projects/skills-manager/src-tauri
cargo test
```
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/services/auth.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs \
  /Users/yjw/code/projects/skills-manager/src/services/auth.ts \
  /Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx \
  /Users/yjw/code/projects/skills-manager/src/pages/Settings.tsx

git commit -m "feat: pass locale to auth start"
```

---

### Task 3: skills-manager 移除 OAuth 调试 UI 与 auth-debug 日志

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs`

**Step 1: Implement cleanup**

- 删除 Sidebar 中“OAuth 回调调试（临时）”面板、测试按钮与相关 state
- 删除 `append_auth_debug_log` 相关调用
- Rust 侧移除 auth-debug 日志文件写入逻辑与命令导出
- `lib.rs` 移除所有 auth-debug 日志行与 handler 注册

**Step 2: Manual verification**

- 确认 Sidebar 不再出现调试面板
- 确认登录回调流程仍可触发 exchange

**Step 3: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs

git commit -m "chore: remove auth debug ui and logging"
```
