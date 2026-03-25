# Marketplace GitHub 直链安装 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 支持用户输入 GitHub 具体技能链接后直接安装，并让这类技能复用现有市场技能的更新追踪链路。

**Architecture:** 后端把 GitHub 直链解析成稳定的 `MarketplaceSkill` 身份，写入与市场安装一致的 `meta.json` 元数据；市场页新增直链安装入口；列表合并与批量更新阶段补上“非内置源但可追踪”的已安装技能刷新逻辑。

**Tech Stack:** Tauri Rust commands/services, React + TypeScript, existing marketplace cache/scanner flow

---

### Task 1: 为 GitHub 直链身份补测试

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/marketplace.rs`

**Step 1: 写失败测试**

- `derive_github_repo_and_skill_path` 需要把 `blob/.../SKILL.md` 归一化到技能目录。
- `build_marketplace_skill_from_reference` 需要在直链场景下用 `repo_url + skill_path` 生成稳定且不冲突的身份。

**Step 2: 运行测试确认失败**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test build_marketplace_skill_from_reference_distinguishes_github_direct_skills_by_repo derive_github_repo_and_skill_path_strips_manifest_file_from_blob_url -- --nocapture`

### Task 2: 实现后端直链解析与更新追踪

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/marketplace.rs`

**Step 1: 解析 GitHub 直链**

- 归一化 repo 根地址与 skill path。
- 对 `SKILL.md` / `README.md` blob 链接去掉文件名。

**Step 2: 稳定化安装身份**

- 为直链安装生成稳定 source/id。
- 写入与市场安装一致的元数据，确保本地扫描后仍可识别。

**Step 3: 补充非内置源已安装技能的远端 revision 刷新**

- 市场列表第一页补齐这些技能的真实 `install_status`。
- “全部更新” 与后台更新检查纳入这部分技能。

### Task 3: 实现市场页直链安装入口

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src/pages/Marketplace.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/zh.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/en.ts`

**Step 1: 新增 GitHub 链接输入与安装动作**

- 输入 GitHub 技能链接。
- 调用后端安装命令。

**Step 2: 安装后刷新列表**

- 复用现有 toast 与列表刷新逻辑。

### Task 4: 验证

**Files:**
- Test: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/marketplace.rs`
- Test: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/marketplace.rs`

**Step 1: 跑 Rust 定向测试**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test marketplace -- --nocapture`

**Step 2: 跑前端构建**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`
