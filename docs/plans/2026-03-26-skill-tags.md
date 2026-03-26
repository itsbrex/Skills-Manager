# Skill Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Skills 页面增加本地标签管理与顶部筛选，帮助用户在 Skill 数量增多后更快定位目标。

**Architecture:** 标签作为用户本地元数据，按 `skill.id` 存入 `config.json`，由前端随 `get_config` 一起读取并更新。Skills 页复用现有搜索与卡片布局，新增标签归一化、聚合、筛选与轻量编辑交互，不改动 `SKILL.md` 或扫描逻辑。

**Tech Stack:** React 19 + TypeScript + Tauri 2 + Rust serde + Node test + cargo test

---

### Task 1: 前端标签逻辑测试

**Files:**
- Create: `src/pages/skills/skillTags.test.ts`
- Create: `src/pages/skills/skillTags.ts`

**Step 1: 写失败测试**

覆盖：
- 标签归一化：去空白、去重、统一小写键、保留展示顺序
- 搜索匹配：`name / id / tags`
- 顶部筛选：全部、单标签、多标签、未标记
- 标签聚合排序：按使用频次优先，再按名称排序

**Step 2: 跑测试确认失败**

Run: `node --test src/pages/skills/skillTags.test.ts`

**Step 3: 写最小实现**

实现标签元数据类型与纯函数工具。

**Step 4: 跑测试确认通过**

Run: `node --test src/pages/skills/skillTags.test.ts`

### Task 2: Rust 配置模型测试

**Files:**
- Modify: `src-tauri/src/models/config.rs`
- Modify: `src-tauri/src/services/config_manager.rs`

**Step 1: 写失败测试**

覆盖：
- `AppConfig` 可序列化/反序列化 skill tag 元数据
- 缺失字段时兼容旧配置
- 保存/加载后标签内容保持不变

**Step 2: 跑测试确认失败**

Run: `cargo test skill_tags --manifest-path src-tauri/Cargo.toml`

**Step 3: 写最小实现**

在配置模型中增加标签元数据结构与默认值。

**Step 4: 跑测试确认通过**

Run: `cargo test skill_tags --manifest-path src-tauri/Cargo.toml`

### Task 3: 前后端接线

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/pages/Skills.tsx`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**Step 1: 实现前端数据读取与保存**

基于 `get_config` / `save_config` 更新标签，不新增额外 Tauri 命令。

**Step 2: 实现顶部标签筛选与卡片标签展示**

加入聚合标签条、未标记筛选、计数展示。

**Step 3: 实现卡片内轻量标签编辑**

支持新增标签和删除已有标签，保存后刷新本地状态并给出 toast。

**Step 4: 运行目标测试**

Run: `node --test src/pages/skills/skillTags.test.ts`

### Task 4: 整体验证

**Files:**
- Modify: `src/pages/Skills.tsx`

**Step 1: 运行前端构建**

Run: `npm run build`

**Step 2: 运行 Rust 相关测试**

Run: `cargo test skill_tags --manifest-path src-tauri/Cargo.toml`

**Step 3: 手工检查**

确认：
- 老配置可正常加载
- Skills 页可新增/删除标签
- 搜索和顶部筛选叠加生效
- 未标记 Skill 可被单独筛出
