# 成组 Skill（Skill Suite）管理设计

日期：2026-03-27

## 背景

当前 `skills-manager` 的核心模型是“一个目录 = 一个 skill”。这套模型对普通 skill 很直接，但对 `superpowers`、`baoyu-skill` 这类“一个仓库里包含多个可独立触发的 skill”的场景不够自然。

现状里已经存在两个重要约束：

- 本地扫描只识别 `skills_dir` 第一层目录里的 skill，不递归扫描容器目录。
- `skill.id` 同时承担目录名、链接名、同步主键等职责，不能随意改成不兼容的层级命名。

因此，这个设计的核心目标不是“把所有 skill 改成树状”，而是引入一个新的“套件”层，同时尽量不影响现有普通 skill。

## 目标

- 支持把 `superpowers`、`baoyu-skill` 这类仓库作为“套件”管理。
- 套件内的每个子 skill 仍然可以像普通 skill 一样被扫描、启用、禁用、同步、删除。
- 套件安装、更新、卸载可以成组操作。
- UI 可以按套件分组展示，但默认仍兼容现有扁平 skill 列表。
- 普通 skill 的本地目录结构、工具链接方式、同步语义尽量不变。

## 非目标

- 不把本地 skill 扫描改成递归树扫描。
- 不把工具侧的 skill 链接目录改成分层结构。
- 不在第一阶段改变 cloud sync 的 payload 结构。
- 不要求现有单 skill 仓库补 package manifest 才能继续工作。

## 现状约束

### 1. 本地扫描是“顶层扁平 skill”

当前扫描器只读取 `skills_dir` 第一层目录，并把带 `SKILL.md`/`skill.md`/`meta.json` 的目录视为 skill。容器目录默认应被忽略，测试里已经明确包含 `superpowers` 这种目录名。

这意味着如果直接把 `superpowers/skills/brainstorming` 这种嵌套目录扔进 hub，现有扫描流程不会把它当成一个可管理 skill。

### 2. `skill.id` 是文件系统级标识

当前 `skill.id` 不只是展示字段，还会被用于：

- `skills_dir.join(skill_id)`
- tool skills 目录下的链接名/复制目录名
- cloud sync 的主键
- marketplace / vault 的本地安装识别

因此不能把真实 id 设计成 `superpowers:brainstorming` 这类对 Windows 不友好的格式。展示名和落盘 id 必须拆开。

### 3. 现有 `skill_metadata` 不适合承载套件状态

当前 `config.skill_metadata` 只用于 tags，而且归一化逻辑会在 `tags` 为空时直接丢弃整条记录。把套件状态混进这里风险很高，容易影响普通 skill 的配置持久化。

结论：套件状态不应优先设计在 `config.skill_metadata` 里。

## 方案对比

### 方案 A：直接把 Skill 模型改成树状

做法：

- 扫描器递归扫描所有子目录。
- `Skill` 增加 `children`，UI 和命令都围绕树结构重写。

问题：

- 影响面最大，扫描、启用、链接、同步、市场安装都会被波及。
- 普通 skill 的行为边界会变复杂。
- 现有大量“skill_id 即目录名”的假设会被迫重构。

结论：不采用。

### 方案 B：引入独立的“套件层”，叶子 skill 继续保持一等公民

做法：

- 新增 `SkillPackage` / `SkillSuite` 概念。
- 套件只负责安装、更新、分组和来源管理。
- 真正进入现有运行链路的仍然是“叶子 skill”。

优点：

- 普通 skill 不需要迁移。
- 工具启用/禁用逻辑、同步逻辑、链接逻辑都可保持不变。
- 可以渐进式落地。

缺点：

- 会有一层额外的 package state。
- 套件共享资源在第一阶段不做去重时会有重复文件。

结论：推荐。

### 方案 C：只靠 tag 做分组

做法：

- 继续只维护 `Skill`。
- 用 `suite:superpowers` 这类 tag 做 UI 分组。

问题：

- 无法表达套件级安装、更新、卸载。
- 无法记录成员来源和结构。
- marketplace / import / sync 场景都不够稳。

结论：只能作为过渡，不适合作为正式方案。

## 推荐方案

采用方案 B，并进一步限定为：

**套件只新增在“包管理层”；现有运行时仍然只认叶子 skill。**

也就是：

- 扫描器不改成递归。
- `list_skills` 继续返回叶子 skill。
- tool enable/disable 继续针对叶子 skill。
- cloud sync 继续同步叶子 skill。
- marketplace 对单 skill 的安装流程保持原样。

## 核心设计

### 1. 新的数据层次

新增两个概念：

#### `SkillPackageManifest`

用于描述一个成组 skill 仓库。

建议文件名：`skill-pack.toml`

示例：

```toml
schema_version = 1
package_id = "superpowers"
name = "Superpowers"
version = "1.0.0"
install_strategy = "materialized_members"

[[members]]
member_id = "brainstorming"
skill_id = "superpowers--brainstorming"
path = "skills/brainstorming"
name = "brainstorming"

[[members]]
member_id = "writing-plans"
skill_id = "superpowers--writing-plans"
path = "skills/writing-plans"
name = "writing-plans"
```

约束：

- `package_id` 采用跨平台安全 slug。
- `member_id` 仅在 package 内唯一。
- `skill_id` 是最终落盘的叶子 skill id，必须文件系统安全。
- 展示层如需显示 `superpowers:brainstorming`，应单独拼接 display label，而不是拿它当真实 id。

#### `InstalledSkillPackage`

用于记录本地套件状态。

建议独立存储在 package state 中，而不是塞进 `config.skill_metadata`。

建议字段：

- `package_id`
- `name`
- `version`
- `source`
- `repo_url`
- `installed_members`
- `selected_members`
- `manifest_hash`
- `installed_at`
- `updated_at`

### 2. 安装策略：物化叶子成员，不改运行时

推荐第一阶段使用：

**`materialized_members` 策略**

含义：

- 套件作为一个管理单元被下载/解析。
- 套件中的每个成员 skill 被“物化”为 hub 顶层的独立 skill 目录。
- 物化后的每个成员对现有运行时来说就是普通 skill。

建议目录结构：

```text
~/.skills-manager/
  skills/
    superpowers--brainstorming/
    superpowers--writing-plans/
    baoyu--paper-polish/
  packages/
    superpowers/
      manifest.toml
      state.json
    baoyu/
      manifest.toml
      state.json
```

这里有一个关键选择：

- `skills/` 继续只放叶子 skill。
- `packages/` 单独保存套件级状态。

这样可以保证现有扫描器完全不需要知道 package 的存在。

### 3. 叶子 skill 的元数据

物化后的叶子 skill 目录继续保留 `SKILL.md`，并额外写入 `meta.json`。

在 `meta.json` 中增量加入 package 字段，例如：

```json
{
  "name": "brainstorming",
  "description": "Use this before creative work...",
  "version": "1.0.0",
  "source": "marketplace",
  "repo_url": "https://github.com/example/superpowers",
  "skill_path": "skills/brainstorming",
  "package_id": "superpowers",
  "package_name": "Superpowers",
  "package_member_id": "brainstorming",
  "package_version": "1.0.0"
}
```

这些字段应设计成可选、增量、向后兼容：

- 旧 skill 没有这些字段也完全正常。
- 新扫描逻辑即使暂时忽略这些字段，也不影响叶子 skill 的基本可用性。

### 4. UI 与 API 分层

保留现有 API：

- `list_skills`
- `enable_skill`
- `disable_skill`
- `delete_skill`
- `refresh_skills`

新增 package 级 API：

- `list_skill_packages`
- `get_skill_package(package_id)`
- `install_skill_package`
- `update_skill_package`
- `remove_skill_package`

UI 分层：

- Skills 页面默认仍展示 flat list。
- 增加可选“按套件分组”视图或过滤器。
- 叶子 skill 卡片可显示所属 package badge。
- package 详情页可列出成员、安装状态、版本、更新操作。

这样普通 skill 用户完全可以不感知 package 概念。

## 为什么这个方案对其他 Skill 影响最小

### 不改扫描语义

普通 skill 仍然是 `skills/<skill-id>/` 这种顶层目录。扫描器仍然只扫顶层，现有单 skill 不会因为 package 引入而被重复扫描或漏扫。

### 不改工具链接语义

启用/禁用 skill 仍然是把某个叶子 skill 目录链接或复制到工具目录。工具侧不需要理解 package，也不会收到新的目录结构。

### 不改同步语义

cloud sync 仍然只同步叶子 skill id 与启用状态。普通 skill 的 payload 不需要迁移。

### 不改已有市场安装路径

单 skill marketplace 安装继续走现有 `repo_url + skill_path -> 安装成一个 skill` 的流程。只有检测到 package manifest 的来源才进入 package 安装路径。

### 不污染现有 tag 配置

套件状态不落在 `config.skill_metadata`，不会和现有 tag 管理、归一化逻辑发生冲突。

## 迁移策略

### Phase 1：只做兼容地基

- 增加 package manifest 解析能力。
- 增加 package state 存储。
- 增加 package 级安装/更新/卸载命令。
- 叶子 skill 仍按普通 skill 被扫描与展示。

这一阶段不要求改动现有普通 skill。

### Phase 2：增强 UI

- Skills 列表支持按 package 分组。
- skill 卡片显示 package badge。
- package 详情页支持成员视图。

这一阶段也不需要迁移旧 skill。

### Phase 3：增强同步与市场体验（可选）

- 在 marketplace 中区分“单 skill”与“skill suite”。
- 云端可选同步 package 安装来源，用于更好地重建 package 关系。

注意：这一阶段是增强，不是第一阶段前置条件。

## 明确不采用的设计

### 1. 不把 `:` 作为真实 skill id 分隔符

原因：

- Windows 文件系统不兼容。
- 当前 id 会直接参与本地目录名和链接名。

替代：

- 真实 id 用 `superpowers--brainstorming`
- 展示标签用 `superpowers:brainstorming`

### 2. 不把 package 状态写进 `config.skill_metadata`

原因：

- 当前归一化逻辑以 tags 为核心。
- 空 tags 记录会被丢弃。
- 这会给普通 skill 带来隐式配置风险。

### 3. 不把 package 根目录直接放进 `skills/` 并期待递归扫描

原因：

- 现有扫描就是扁平。
- 改成递归后会牵一发而动全身。

## 风险与控制

### 风险 1：成员 skill id 冲突

例如不同 package 都有 `brainstorming`。

控制：

- 强制 package 前缀物化，如 `superpowers--brainstorming`。

### 风险 2：更新套件时覆盖用户改动

用户可能在物化后的叶子 skill 中做了本地修改。

控制：

- package 管理页面提示“此 skill 由 package 管理”。
- 更新前做目录备份或比对 hash。
- 第一阶段至少做到显式确认，不静默覆盖。

### 风险 3：共享资源重复

物化策略会带来重复文件。

控制：

- 第一阶段接受冗余，换取兼容性。
- 等 package 体系稳定后，再评估 dedupe / hardlink / shared cache。

### 风险 4：普通 skill 被误识别为 package

控制：

- 仅当仓库根或指定路径存在 `skill-pack.toml` 时，才走 package 路径。
- 其他情况全部按现有单 skill 处理。

## 实现建议

如果开始落地，建议按下面顺序做：

1. 新增 package manifest 解析与 package state 存储。
2. 扩展 marketplace/import 流程，支持 package 安装到 `packages/` + 物化成员到 `skills/`。
3. 扩展 `meta.json` 的 package 可选字段。
4. 新增 package 查询 API。
5. 最后再做 UI 分组和 package 管理页。

这个顺序的好处是：

- 前三步都属于增量式后端能力。
- 在 UI 还没改之前，物化出的成员 skill 已经能按现有逻辑工作。
- 就算 package 功能只实现一半，也不会影响普通 skill。

## 结论

推荐把 `superpowers`、`baoyu-skill` 这类对象设计成“套件”，但不要让套件直接替代现有 `Skill`。

最稳的路径是：

- 套件只负责来源、分组、安装、更新、卸载。
- 真正进入扫描、启用、链接、同步链路的仍然是叶子 skill。
- 叶子 skill 继续保持顶层目录、文件系统安全 id、现有运行语义不变。

这样做的结果是：

- **对现有普通 skill 的影响最小**
- **对已有代码路径的侵入最小**
- **后续依然可以逐步增强 package 能力，而不需要一次性重写 skill 模型**
