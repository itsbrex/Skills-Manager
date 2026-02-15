# Marketplace Third-Party API Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将技能市场重构为基于第三方 API 分页拉取，落地 24 小时本地缓存，并确保搜索/筛选在大规模数据下可用。

**Architecture:** 后端命令层改为调用第三方 API 客户端并做字段映射；缓存层改为页级缓存（`page+query+source`）并持久化 24h；前端搜索改为远端检索触发，列表分页继续增量加载。

**Tech Stack:** Rust (Tauri commands/services), React + TypeScript, reqwest, serde, 本地 JSON 持久化缓存

---

### Task 1: 后端模型与缓存结构重构（24h 页级缓存）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/marketplace.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs`
- Test: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs`（existing `#[cfg(test)]`）

**Step 1: Write the failing test**

为 `MarketplaceCache` 新增测试（页级 key + 24h TTL）：
1. 同 key 命中
2. 过期失效
3. 持久化恢复

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test marketplace_cache_ -- --nocapture`  
Expected: FAIL（接口签名或缓存结构尚未改造）

**Step 3: Write minimal implementation**

1. 将单状态缓存改为 `HashMap<PageCacheKey, CachedPageState>`
2. TTL 统一改为 `24 * 60 * 60`
3. 持久化格式改为多页快照

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test marketplace_cache_ -- --nocapture`  
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/models/marketplace.rs /Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs
git commit -m "refactor: upgrade marketplace cache to 24h page-level strategy"
```

### Task 2: 第三方 API 客户端与字段映射实现

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/marketplace.rs`
- Test: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs`

**Step 1: Write the failing test**

新增解析与映射测试：
1. API skill -> `MarketplaceSkill` 映射
2. `installUrl/slug` 解析出 `repo_url/skill_path`
3. 非 GitHub 链接走外链模式

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test marketplace_api_ -- --nocapture`  
Expected: FAIL

**Step 3: Write minimal implementation**

1. 增加第三方 API 响应结构体与调用函数（`/sources`、`/skills`）
2. 在命令层接入 API 调用与缓存读写
3. 网络失败时优先回退本地缓存

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test marketplace_api_ -- --nocapture`  
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/marketplace.rs
git commit -m "feat: integrate marketplace third-party api with model mapping"
```

### Task 3: 前端搜索改远端分页检索 + 交互收敛

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src/pages/Marketplace.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src/types/index.ts`
- Test: 手工验证（页面行为）

**Step 1: Write the failing test**

前端无现成自动化测试，本任务以手工可复现失败场景作为 RED：
1. 仅本地过滤已加载项，无法全量搜索（现状）
2. 输入关键词后分页未重置（现状）

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run typecheck`  
Expected: PASS（类型基线正常），随后手工验证失败场景成立。

**Step 3: Write minimal implementation**

1. `deferredSearchQuery` 变化时触发远端 `fetch_marketplace_skills`
2. `loadMore` 时携带当前 query/source 继续分页
3. 刷新/安装后重载保持当前 query/source 上下文

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run typecheck`  
Expected: PASS，手工验证搜索与分页行为正确。

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src/pages/Marketplace.tsx /Users/yjw/code/projects/skills-manager/src/types/index.ts
git commit -m "feat: switch marketplace search to remote paginated query"
```

### Task 4: 全量验证与文档同步

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs`（如需默认源同步）
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/zh.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/en.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/docs/plans/2026-02-15-marketplace-api-integration-design.md`

**Step 1: Write the failing test**

若新增类型或默认源断言，先补充 Rust 单测（默认 source 类型/ID）。

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test default_marketplace_sources -- --nocapture`  
Expected: FAIL（若默认值已变更）

**Step 3: Write minimal implementation**

补齐默认源、文案和设计文档最终状态。

**Step 4: Run test to verify it passes**

Run:
1. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test`
2. `cd /Users/yjw/code/projects/skills-manager && npm run typecheck`

Expected: 全部 PASS。

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs /Users/yjw/code/projects/skills-manager/src/i18n/locales/zh.ts /Users/yjw/code/projects/skills-manager/src/i18n/locales/en.ts /Users/yjw/code/projects/skills-manager/docs/plans/2026-02-15-marketplace-api-integration-design.md
git commit -m "chore: finalize marketplace api integration docs and defaults"
```
