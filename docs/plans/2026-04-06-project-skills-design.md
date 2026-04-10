# Project-Level Skills Quality-First Plan

**Goal:** 在保留现有全局 skills 管理能力的前提下，把项目级 skills 纳入统一管理，并以“身份语义一致、边界清晰、可验证、不回归”为首要目标完成收口。

**Architecture:** 系统继续保留 `AppConfig.skills_dir` 作为全局 hub；通过 `projects` 与 `active_project_id` 定义当前项目上下文；扫描层返回 `global + active project` 的聚合结果；所有具体操作统一基于 `instance_id` 精确定位 skill 实例，从而支持 global/project 同名 skill 共存。

**Tech Stack:** Tauri 2、Rust、React 19、TypeScript、现有 ScannerService / Skills 页面 / AppConfig 配置体系。

---

## 一、目标

1. 保留现有全局 skills 管理逻辑，不破坏已有用户配置。
2. 支持手动绑定项目目录，并为项目定义独立的 project skills 目录。
3. 在项目视图下统一展示 `project skills + global skills`。
4. 允许 global/project 同名 skill 共存，且所有操作必须命中唯一实例。
5. 不把 project skill 自动导入全局 hub，也不做目录级覆盖。
6. 在实施过程中优先保证全局模式不回归。

---

## 二、非目标

1. 初版不做自动识别当前 Git 仓库。
2. 初版不做“全部项目同时叠加”视图。
3. 初版不做同名 skill 的覆盖、继承、优先级解析。
4. 初版不让 package/group 自动纳入 project scope 语义。
5. 初版不把 cloud sync / sync status 扩展为 project-scoped skills 的跨设备一致性系统。

---

## 三、当前代码基线（已落地能力）

以下能力已在仓库中出现，应视为既有基线，而不是从零设计项：

### 1. 配置模型已支持项目绑定

**文件：** `src-tauri/src/models/config.rs`

当前已有：

- `ProjectBinding`
- `AppConfig.projects`
- `AppConfig.active_project_id`

这意味着项目绑定与当前活动项目上下文已经具备后端配置基础。

### 2. Skill 模型已支持实例级身份

**文件：** `src-tauri/src/models/skill.rs`
**文件：** `src/types/index.ts`

当前已有：

- `instance_id`
- `scope`
- `project_id`
- `project_name`

并且 Rust 侧已有：

- `Skill::global_instance_id`
- `Skill::project_instance_id`
- `Skill::with_scope`

### 3. 扫描器已支持 global + active project 聚合

**文件：** `src-tauri/src/services/scanner.rs`

当前已有：

- `scan_global_skills`
- `scan_project_skills`
- `scan_scoped_skills`
- `ensure_unique_instance_ids`

并已有测试覆盖 global/project 同名 skill 共存与 enabled 状态隔离。

### 4. 后端主操作链路已基本切到实例级

**文件：** `src-tauri/src/commands/skills.rs`

当前已有：

- `load_skill_by_instance_id`
- `enable_skill(instance_id, tool_id)`
- `disable_skill(instance_id, tool_id)`
- `delete_skill(instance_id)`
- `list_skills()` 返回 scoped skills

说明“实例级定位”已是事实上的主链路。

### 5. 前端列表层已经感知 scope

**文件：** `src/pages/skills/buildUnifiedSkillItems.ts`

当前已有：

- skill item key 基于 `instance_id`
- `project` scope 在排序中优先
- 搜索文本已包含 `instance_id` / `scope` / `project_id`

因此剩余工作重点不是“发明一套新模型”，而是把现有半落地状态收口成统一产品语义。

---

## 四、最终决策（质量优先版）

以下决策作为本方案的正式约束，后续实现与评审都以此为准。

### 1. `instance_id` 是唯一操作键

#### 规则

- Global 实例：`global:<skill_id>`
- Project 实例：`project:<project_id>:<skill_id>`

#### 要求

1. 启用、禁用、删除、编辑、批量选择、批量操作一律基于 `instance_id`。
2. `skill.id` 仅用于展示、搜索、分组提示、同名冲突提示。
3. 不允许再新增任何把 `skill.id` 当唯一定位键的新逻辑。

### 2. `active_project_id` 持久化到全局配置

#### 规则

- `active_project_id` 保存在 `AppConfig` 中。
- Skills 页和 Settings 页共享这一状态。

#### 失效策略

当 `active_project_id` 指向的项目不存在时：

1. 扫描结果自动回退为 `global-only`。
2. 前端给出轻量 toast / 非阻塞提示。
3. 不使用 hard error 中断页面加载。

### 3. `skill_metadata` 统一按 `instance_id` 存储

#### 决策

当前存在 global 使用 `skill.id`、project 使用 `instance_id` 的半迁移状态。为保证语义一致，最终应统一迁移到：

- skill 视图元数据 key = `instance_id`
- group 元数据 key = `group:<group_id>`

#### 原因

如果标签、收藏、备注等被视为“管理视图属性”，它们应跟随具体 skill 实例，而不是逻辑名义上的 `skill.id`。

#### 约束

1. 同名 global/project skill 的标签必须隔离。
2. 后续新增的视图属性也应遵循同样规则。
3. 若需要兼容旧 key，应在读取阶段做兼容映射，在保存阶段统一写新 key。

### 4. group/package 在 V1 只认 global scope

#### 决策

- package/group 的成员关系继续以 global skill 为准。
- project skill 不自动并入 package/group。

#### 原因

当前前端 group 构建逻辑已经偏向 global-only；若在本轮把 group 也做成 scoped 语义，会显著扩大复杂度与验证面。

#### 约束

1. group bulk 操作优先命中 global 实例。
2. 文案与交互要避免让用户误以为 project skill 已属于 package/group 成员。

### 5. cloud sync / sync status 在 V1 不纳入 project-scoped skills

#### 决策

本轮不把 project-scoped skills 作为跨设备一致性对象。

#### 原因

project skill 依赖本地项目目录绑定，不具备天然的跨设备可移植性；若在语义未定清前纳入同步，会引入大量“另一台设备找不到该项目”的状态问题。

#### 范围

1. cloud sync 只保证全局技能体系与全局配置语义稳定。
2. sync status / fix sync 的扩展若已触及 scoped skills，需要在本轮明确限制或回收为 global-only 范围。
3. 如未来要支持 project sync，需单独设计项目标识匹配与降级策略。

### 6. create skill 必须显式带 scope 语义

#### 决策

在支持项目级 skill 后，“新建 skill”不能继续只有全局语义。

#### V1 要求

1. 在项目视图下创建 skill 时，UI 必须明确当前创建目标是 `Global` 还是 `Project`。
2. 默认值可以跟随当前视图，但不能完全隐式。
3. 创建逻辑必须写入目标 scope 对应目录，不允许先创建 global 再靠后续移动修正。

### 7. `refresh_skills` 只继续导入 global hub

#### 决策

`refresh_skills` 中“从工具目录扫描并导入 hub”的逻辑，只能作用于全局 hub。

#### 约束

1. project skills 目录不能被纳入导入目标。
2. refresh 最终返回的列表仍可为 scoped 聚合结果。
3. 严禁因为 refresh 打破 global/project 目录边界。

---

## 五、项目绑定目录选择语义改造实现计划（2026-04-10）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将项目绑定从“选择项目根目录并自动推导 `.claude/skills`”改为“直接选择用户指定的 skills 目录，并支持自动生成且可编辑项目名”。

**Architecture:** 后端扫描继续只依赖 `ProjectBinding.skills_dir`；前后端配置模型移除 `root_path` 作为核心语义，并在配置加载阶段兼容旧配置迁移。前端项目绑定弹窗改为先选择 skills 目录，再确认/编辑项目名后保存。

**Tech Stack:** React 19 + TypeScript、Tauri 2、Rust serde 配置模型、现有 `ConfigManager` / `ScannerService` / `Skills.tsx`。

---

### Task 1: 用测试锁定新的项目绑定构造语义

**Files:**
- Modify: `src/pages/projectBindings.test.ts`
- Modify: `src/pages/projectBindings.ts`

**Step 1: Write the failing test**

把当前 root-path 语义测试改成 skills-dir 语义，至少覆盖：
- `buildProjectBindingFromSkillsDir("/Users/yjw/code/project-alpha/custom-skills")` 直接保留 `skills_dir`
- 末尾斜杠规范化
- 允许直接选择 `.claude/skills`
- 当目录名是 `skills` 时默认项目名取上一级目录名
- 默认项目名可被覆盖，且覆盖后 `id` 不变化
- 冲突判断改为基于 `skills_dir`，不是 `root_path`

**Step 2: Run test to verify it fails**

Run: `npx tsx --test src/pages/projectBindings.test.ts`
Expected: FAIL，提示旧函数名/旧断言与新语义不匹配。

**Step 3: Write minimal implementation**

在 `src/pages/projectBindings.ts` 中：
- 将 `buildProjectBindingFromRootPath` 改为 `buildProjectBindingFromSkillsDir`
- 新增 `buildDefaultProjectNameFromSkillsDir`
- 新增 `renameProjectBinding`
- 将冲突判断改为 `hasProjectSkillsDirConflict`
- 保留 `resolveActiveProjectId` / `resolveNextActiveProjectIdAfterAddition` / `resolveNextProjectBindingsAfterRemoval`
- 删除“禁止选择 `.claude` / `.claude/skills`”的校验，仅拒绝空路径和文件系统根目录

**Step 4: Run test to verify it passes**

Run: `npx tsx --test src/pages/projectBindings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/projectBindings.ts src/pages/projectBindings.test.ts
git commit -m "refactor: bind projects by skills directory"
```

### Task 2: 收敛前端类型定义到 skills_dir

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/pages/Skills.tsx`

**Step 1: Write the failing test**

这里以 TypeScript 编译作为约束：修改类型后让旧的 `root_path` 引用报错，逼出所有调用点。

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: FAIL，`ProjectBinding.root_path`、旧 helper 名称等引用报错。

**Step 3: Write minimal implementation**

在 `src/types/index.ts` 中把 `ProjectBinding` 收敛为：
- `id: string`
- `name: string`
- `skills_dir: string`

然后在 `src/pages/Skills.tsx` 中把所有：
- `buildProjectBindingFromRootPath` → `buildProjectBindingFromSkillsDir`
- `hasProjectRootConflict` → `hasProjectSkillsDirConflict`
- `selectProjectRoot` → 新文案 key（如 `selectProjectSkillsDir`）
- 项目展示中的 `project.root_path` 删除，改为只展示 `project.skills_dir`

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: 仍可能因 Rust/文案未改失败，但前端 `root_path` 相关错误应消失。

**Step 5: Commit**

```bash
git add src/types/index.ts src/pages/Skills.tsx
git commit -m "refactor: remove project root path from frontend bindings"
```

### Task 3: 改造 Skills 页项目绑定弹窗为“选择 skills 目录 + 可编辑项目名”

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**Step 1: Write the failing test**

先补纯布局/文案测试或最小 smoke 断言，验证：
- 添加按钮文案变为“选择 Skills 目录”语义
- 弹窗中展示 `skills_dir`
- 不再出现“自动识别 .claude/skills / 项目根目录”旧文案

若当前没有现成组件测试框架，可先用 `npm run build` + 精确 grep/静态检查作为阶段性红灯。

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: 在引入新状态前，旧代码与新类型/文案不一致。

**Step 3: Write minimal implementation**

在 `src/pages/Skills.tsx`：
- 添加“待确认的新绑定草稿” state，例如 `pendingProjectBinding`
- 点击“添加项目”时直接用目录选择器选择 skills 目录
- 生成默认名后，不立刻保存，而是在弹窗里显示：
  - 项目名输入框（可编辑）
  - Skills 路径（只读）
  - 确认/取消按钮
- 确认时才调用 `saveProjectBindingsConfig`
- 冲突提示改为 `skills_dir` 重复
- 列表卡片只展示 `name` 与 `skills_dir`

在 i18n 中新增/替换文案：
- `settings.selectProjectSkillsDir`
- `settings.projectName`
- `settings.projectNameDesc`（若需要）
- 更新 `settings.projectBindingsDesc`
- 保留 `settings.projectSkillsPath`
- 移除或停用 `settings.selectProjectRoot` / `settings.projectRootPath`

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Skills.tsx src/i18n/locales/zh.ts src/i18n/locales/en.ts
git commit -m "feat: select custom skills directories for project bindings"
```

### Task 4: 让 Rust 配置模型兼容旧 root_path 配置并只持久化新结构

**Files:**
- Modify: `src-tauri/src/models/config.rs`
- Modify: `src-tauri/src/services/config_manager.rs`

**Step 1: Write the failing test**

在 `config_manager.rs` 测试中新增：
- 旧配置只有 `root_path` 时，load 后自动迁移出 `skills_dir = root_path/.claude/skills`
- 旧配置同时有 `root_path` 与 `skills_dir` 时，以 `skills_dir` 为准
- `name` 为空时从 `skills_dir` 生成默认值
- 保存后序列化结果中不再包含 `root_path`

**Step 2: Run test to verify it fails**

Run: `cargo test config_manager --manifest-path src-tauri/Cargo.toml`
Expected: FAIL，当前模型和迁移逻辑无法满足新断言。

**Step 3: Write minimal implementation**

在 `src-tauri/src/models/config.rs`：
- 将 `ProjectBinding` 正式收敛为 `id/name/skills_dir`
- 为兼容旧配置，使用自定义反序列化中间结构或 `#[serde(default)]` 迁移辅助结构

在 `src-tauri/src/services/config_manager.rs`：
- load 时规范化每个 `projects[*].skills_dir`
- 如果读取到 legacy `root_path`，一次性迁移到 `skills_dir`
- `name` 空时自动生成默认名
- `active_project_id` 指向不存在项目时置空
- save 时只写新结构

**Step 4: Run test to verify it passes**

Run: `cargo test config_manager --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/models/config.rs src-tauri/src/services/config_manager.rs
git commit -m "refactor: migrate project bindings to skills_dir"
```

### Task 5: 补扫描与命令层回归，确认不依赖 `.claude/skills` 约定

**Files:**
- Modify: `src-tauri/src/services/scanner.rs`
- Modify: `src-tauri/src/commands/skills.rs`
- Modify: `src-tauri/src/commands/cloud_sync.rs`

**Step 1: Write the failing test**

新增或改造测试夹具，覆盖：
- `ProjectBinding.skills_dir` 指向任意目录时，`scan_project_skills` 仍能识别 skill
- 同名 global/project skill 在自定义目录下仍生成唯一 `instance_id`
- 命令层 enable/disable/delete 仍命中正确实例
- cloud sync 相关夹具不再要求 `root_path`

**Step 2: Run test to verify it fails**

Run: `cargo test scanner --manifest-path src-tauri/Cargo.toml && cargo test skills --manifest-path src-tauri/Cargo.toml`
Expected: FAIL，旧夹具或结构体字段不匹配。

**Step 3: Write minimal implementation**

只修与 `ProjectBinding` 新结构相关的测试夹具和必要实现，不扩展功能边界。

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/services/scanner.rs src-tauri/src/commands/skills.rs src-tauri/src/commands/cloud_sync.rs
git commit -m "test: cover custom project skills directories"
```

### Task 6: 最终整体验证

**Files:**
- Modify: none
- Test: `src/pages/projectBindings.test.ts`
- Test: `src/pages/skills/headerActionLayout.test.ts`
- Test: `src-tauri/src/services/config_manager.rs`
- Test: `src-tauri/src/services/scanner.rs`

**Step 1: Run targeted frontend tests**

Run: `npx tsx --test src/pages/projectBindings.test.ts src/pages/skills/headerActionLayout.test.ts`
Expected: PASS

**Step 2: Run frontend build**

Run: `npm run build`
Expected: PASS

**Step 3: Run backend tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 4: Manual verification**

手动验证：
- 在 Skills 页面打开项目绑定弹窗
- 点击添加项目后选择任意 skills 目录
- 自动生成项目名，并可修改
- 确认后列表显示新名字和所选 `skills_dir`
- 设为当前项目后，Skills 列表能读到该目录下的 skills
- 移除后 active project 正常回退

**Step 5: Commit**

```bash
git add src types src-tauri docs/plans/2026-04-06-project-skills-design.md
git commit -m "feat: support custom project skills directories"
```

---

## 六、核心数据模型

### 1. AppConfig

**文件：** `src-tauri/src/models/config.rs`
**文件：** `src/types/index.ts`

```rust
pub struct ProjectBinding {
    pub id: String,
    pub name: String,
    pub root_path: PathBuf,
    pub skills_dir: PathBuf,
}
```

```rust
#[serde(default)]
pub projects: Vec<ProjectBinding>,
#[serde(default)]
pub active_project_id: Option<String>,
```

#### 约束

1. 老配置缺失字段时必须可正常反序列化。
2. `projects` 默认空数组。
3. `active_project_id` 默认 `None`。
4. 初版不要求后端强制校验 `root_path` 必须是 Git 仓库。

### 2. Skill

**文件：** `src-tauri/src/models/skill.rs`
**文件：** `src/types/index.ts`

```ts
instance_id: string
scope: "global" | "project"
project_id?: string | null
project_name?: string | null
```

#### 说明

- `id`：逻辑 skill 标识 / 目录名，如 `review-pr`
- `instance_id`：唯一实例标识
- `path`：实例实际目录

---

## 六、剩余实施项（按质量优先排序）

### Phase 1：先收口 identity 与边界规则

#### Task 1.1：统一 metadata key 为 `instance_id`

**Files:**
- Modify: `src/pages/skills/skillTags.ts`
- Check: 所有读写 `skill_metadata` 的页面与工具函数
- Check: Rust/前端配置序列化逻辑

**要求：**
1. skill 标签统一按 `instance_id` 读写。
2. 若需要兼容旧 global key，读取时兼容、写入时统一升级。
3. 补测试覆盖同名 global/project skill 标签互不串联。

#### Task 1.2：明确 active project 失效回退行为

**Files:**
- Check/Modify: `src-tauri/src/services/scanner.rs`
- Modify: `src/pages/Skills.tsx`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**要求：**
1. `active_project_id` 无效时后端返回 global-only。
2. 前端给轻提示。
3. 不影响页面正常渲染。

#### Task 1.3：锁定 group/package 的 global-only 语义

**Files:**
- Check/Modify: `src/pages/skills/buildUnifiedSkillItems.ts`
- Check: `src-tauri/src/commands/skills.rs`
- Check: group 相关测试

**要求：**
1. group member 解析继续只认 global skill。
2. 批量 group 操作优先命中 global 实例。
3. 测试中显式覆盖“存在同名 project skill 时仍选 global”。

#### Task 1.4：限制 cloud sync / sync status 范围

**Files:**
- Check/Modify: `src-tauri/src/services/cloud_sync.rs`
- Check/Modify: `src-tauri/src/commands/sync.rs`
- Check: `src/types/index.ts`

**要求：**
1. 明确 V1 不把 project-scoped skills 纳入跨设备同步语义。
2. 如当前实现已包含 project 字段，需要补注释、过滤或限制逻辑。
3. 防止未来误以为 project scope 已获得完整同步支持。

---

### Phase 2：补产品闭环

#### Task 2.1：Settings 页增加项目绑定管理

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`
- Check: `src/types/index.ts`

**要求：**
1. 支持查看、新增、删除项目绑定。
2. 收集字段至少包含：名称、根目录、skills 目录。
3. 校验 `id` 唯一、路径非空。
4. 保存后 Skills 页能读取最新配置。

#### Task 2.2：Skills 页增加项目上下文切换

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**要求：**
1. 提供 `全局` / `项目：<name>` 的视图上下文表达。
2. 切换时更新 `active_project_id` 并 reload skills。
3. 项目视图中 project skill 排前，global skill 排后。

#### Task 2.3：create skill 增加 scope 选择

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `src-tauri/src/commands/skills.rs`
- Check: 创建相关对话框与类型

**要求：**
1. 在项目上下文下，新建 skill 必须明确目标 scope。
2. Rust 端创建逻辑按目标目录写入。
3. 不破坏现有 global-only 创建体验。

---

### Phase 3：补 UX 与回归验证

#### Task 3.1：增加同名 skill 轻提示

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: 相关纯函数 / 测试

**要求：**
1. 当项目视图中同时存在同名 global/project skill 时，给出轻量提示。
2. 不做阻塞式弹窗。
3. 提示只帮助识别，不改变操作语义。

#### Task 3.2：补完整测试与回归检查

**Files:**
- Modify: `src/**/*.test.ts`
- Modify: `src/**/*.test.tsx`
- Modify: `src-tauri/src/**/*.rs`

**至少覆盖：**
1. 旧配置反序列化不报错。
2. global-only 行为不变。
3. global + active project 聚合正常。
4. 同名 global/project skill 可共存。
5. enable/disable/delete/edit 精确命中实例。
6. tag metadata 按 `instance_id` 隔离。
7. group 仍优先 global。
8. active project 失效回退为 global-only。

---

## 七、实施原则

1. **不做 big bang 重构**：按主链路逐步替换，优先保证行为正确。
2. **先补测试，再改逻辑**：尤其是 identity、metadata、group、sync 边界。
3. **每个阶段单独验证**：不要等最后一起验。
4. **全局模式零回归优先**：任何 scoped 改动都不能破坏现有全局能力。
5. **不扩产品边界**：实例级能力只解决“精确定位哪个 skill”，不顺手放开不该有的删除/同步/继承语义。

---

## 八、验证命令

### 前端

```bash
npm run typecheck
npm run lint
```

### 后端

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo test scanner --manifest-path src-tauri/Cargo.toml
```

如仓库中的实际测试命令不同，以项目现有测试入口为准，但必须覆盖上述场景。

---

## 九、手动验证清单

1. 未配置项目时，Skills 页与当前版本一致。
2. 新增项目绑定后，Skills 页可切到对应项目上下文。
3. 项目视图下同时显示 project + global skills，且 project 排前。
4. global/project 同名 skill 同时可见。
5. 编辑分别打开正确目录。
6. 启用/禁用 project skill 不影响同名 global skill。
7. 删除命中正确实例目录。
8. 切回全局视图后，只显示 global skills。
9. 失效的 `active_project_id` 会回退为 global-only，并给轻提示。
10. 同名 global/project skill 的标签互不串联。

---

## 十、完成定义

当以下条件全部满足时，此功能算完成：

1. 用户可在设置页绑定至少一个项目及其 skills 目录。
2. Skills 页可在 global / project 视图间切换。
3. 项目视图下可同时看到 global + project skills。
4. global/project 同名 skill 可共存且操作互不干扰。
5. `skill_metadata` 已统一按 `instance_id` 隔离。
6. create skill 已具备明确 scope 语义。
7. group/package 语义已明确为 global-only。
8. cloud sync / sync status 未错误承诺 project-scoped skills 跨设备一致性。
9. 全局模式不回归。
10. 类型检查、lint、Rust 测试通过。

---

## 十一、建议执行顺序

1. metadata key 统一到 `instance_id`
2. active project 失效回退策略
3. 锁定 group/package global-only 语义
4. 限制 cloud sync / sync status 范围
5. Settings 项目绑定管理
6. Skills 页项目上下文切换
7. create skill scope 选择
8. 同名 skill UX 与最终回归测试

这份顺序以“先锁边界，再补闭环，最后做体验”为原则，优先保证过程质量与可验证性。
