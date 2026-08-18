# Marketplace 项目级 Skill 安装实施计划

**状态：** 已实施，自动化验证通过，待真实 Tauri 界面回归

**创建日期：** 2026-08-17

**目标：** 允许用户从 Marketplace 或 GitHub 链接一次选择全局目录和任意多个已绑定项目安装 Skill，并保证安装状态、更新、卸载和跳转都精确作用于所选 Skill 实例。

**架构：** `AppConfig.skills_dir` 继续作为全局目录。项目绑定保存“项目根目录”和项目中央托管目录（新项目为 `<root>/.skills-manager/skills`），市场安装命令只接收作用域、项目 ID 和明确的受支持工具 ID，由后端按工具白名单解析各工具的项目级 Skill 目录，并从中央目录建立链接。不同工具的目录不再由前端传入或猜测；市场状态从单一安装状态扩展为多个安装实例，同时保留聚合状态兼容现有列表排序和缓存。旧的“项目根目录误当 Skill 目录”配置会在加载时只迁移带 `source: marketplace` 元数据的直接子目录，普通项目文件、本地 Skill 和外部链接不移动。

**技术栈：** Tauri 2、Rust、React 19、TypeScript、现有 `MarketplaceService` / `ScannerService` / `AppConfig` / `instance_id` 体系。

---

## 一、进度总览

- [x] Phase 1：锁定产品语义与数据契约
- [x] Phase 2：实现后端安装目标解析
- [x] Phase 3：实现多作用域安装状态
- [x] Phase 4：接入 Marketplace 安装交互
- [x] Phase 5：接入 GitHub 链接安装
- [x] Phase 6：修正更新与卸载行为
- [x] Phase 7：补齐文案、测试和自动化回归验证
- [x] Phase 8：支持全局与多个项目同时选择安装

完成标准：以上阶段全部勾选，且“十、最终验收清单”全部通过。

---

## 二、范围与正式决策

### 2.1 本期范围

- [x] Marketplace 列表卡片支持同时选择全局和任意多个已绑定项目。
- [x] Marketplace Skill 详情页支持相同的多目标选择。
- [x] GitHub 链接安装支持相同的多目标选择。
- [x] 同一个市场 Skill 可以同时存在全局实例和多个项目实例。
- [x] 更新和卸载按 `instance_id` 精确处理，不影响其他作用域副本。
- [x] 市场列表能够聚合展示全局和所有项目的安装状态。

### 2.2 非目标

- [x] 安装弹窗展示所有已绑定项目，不要求目标项目是当前项目。
- [x] 本期不允许前端直接传入任意文件系统路径。
- [x] 本期扩展项目绑定为“项目根目录 + 中央托管目录”，并保持旧配置兼容迁移。
- [x] 本期不允许为未知工具猜测项目级 Skill 目录；未纳入白名单的工具只能继续使用全局/自定义行为。
- [x] 本期不扩展 Cloud Sync 对项目级 Skill 的同步范围。
- [x] 本期不改变 package/group 仅以全局 Skill 为主的既有语义。
- [x] 本期不自动切换 `active_project_id`。

### 2.3 产品行为

1. 默认安装目标仍为“全局”，保持现有行为兼容。
2. 全局与项目使用复选模型，可以同时选择全局和任意多个已绑定项目。
3. 缺少根目录的项目不可选并显示修复提示；`active_project_id` 只标记当前上下文，不限制安装目标。
4. 每个选中的项目必须至少选择一个已启用且在工具白名单中的工具；每个项目中央副本只保留一份，工具目录只保留链接。
5. 目标未安装时执行安装；目标存在旧版本时执行更新；目标已是最新版且工具目标不变时禁用重复安装。
6. 一个作用域已安装不能阻止另一个作用域继续安装。
7. 重复安装会同步选中的工具链接，取消选择的工具仅在链接确认属于该 Skill 时移除，不覆盖用户目录。
8. 卸载只删除用户明确选择的实例，同时删除该实例的受管工具链接。
9. “全部更新”更新所有发现的市场实例，并保留每个实例原来的中央目录和工具目标。

---

## 三、当前代码基线

以下能力已经存在，实施时应复用，不重新设计。

### 3.1 项目级 Skill 模型

**文件：**

- `src-tauri/src/models/config.rs`
- `src-tauri/src/models/skill.rs`
- `src/types/index.ts`

已有能力：

- `AppConfig.projects`
- `AppConfig.active_project_id`
- `ProjectBinding.skills_dir`
- `Skill.scope`
- `Skill.project_id`
- `Skill.project_name`
- 全局和项目级 `instance_id`

### 3.2 项目级扫描

**文件：** `src-tauri/src/services/scanner.rs`

已有能力：

- `scan_global_skills`
- `scan_project_skills`
- `scan_scoped_skills`
- 全局与当前项目同名 Skill 并存

### 3.3 当前市场安装限制

**文件：**

- `src-tauri/src/commands/marketplace.rs`
- `src-tauri/src/services/marketplace.rs`
- `src/pages/Marketplace.tsx`

当前限制：

- `install_marketplace_skill` 固定使用 `config.skills_dir`。
- `install_marketplace_skill_by_ref` 固定使用 `config.skills_dir`。
- 市场安装状态只基于全局目录判断。
- `sync_marketplace_installed_skills` 把更新重新写入全局目录。
- 市场卸载按 marketplace skill ID 找到所有副本并逐个删除，无法选择作用域。

---

## 四、Phase 1：数据契约与状态模型

### Task 1：定义安装目标模型

**Files:**

- Modify: `src-tauri/src/commands/marketplace.rs`
- Modify: `src/types/index.ts`

**TODO:**

- [x] Rust 新增 `MarketplaceInstallTarget`。
- [x] TypeScript 新增对应类型。
- [x] `scope` 只接受 `global` 或 `project`。
- [x] `project` scope 必须携带 `project_id` 和至少一个 `tool_id`。
- [x] `tool_ids` 只允许配置中启用且有显式项目目录映射的内置工具。
- [x] 安装命令的 `target` 参数保持可选，缺省解析为全局，兼容旧调用。

建议结构：

```ts
interface MarketplaceInstallTarget {
  scope: "global" | "project";
  project_id?: string | null;
  tool_ids?: string[];
}
```

前端多目标选择结构：

```ts
interface MarketplaceInstallSelection {
  global: boolean;
  projects: MarketplaceInstallTarget[];
}
```

选择结构会展开为多个受校验的单目标后端调用；单个目标失败不阻断其他目标。

### Task 2：定义安装实例状态

**Files:**

- Modify: `src-tauri/src/models/marketplace.rs`
- Modify: `src/types/index.ts`

**TODO:**

- [x] 新增 `MarketplaceInstallation` 模型。
- [x] `MarketplaceSkill` 新增 `installations` 字段，并设置 serde/default 兼容旧缓存。
- [x] 保留顶层 `install_status` 作为聚合状态。
- [x] 定义聚合优先级：`update_available > installed > not_installed`。

建议结构：

```ts
interface MarketplaceInstallation {
  instance_id: string;
  scope: "global" | "project";
  project_id?: string | null;
  project_name?: string | null;
  tool_ids: string[];
  install_status: "not_installed" | "installed" | "update_available";
}
```

**Phase 1 验收：**

- [x] 前后端类型能够序列化和反序列化。
- [x] 未携带 `target` 的旧调用仍按全局安装。
- [x] 旧市场缓存缺少 `installations` 时不会解析失败。

---

## 五、Phase 2：后端安装目标解析

### Task 3：实现安全的目标目录解析

**Files:**

- Modify: `src-tauri/src/commands/marketplace.rs`

**TODO:**

- [x] 新增纯函数 `resolve_marketplace_install_target`。
- [x] `global` 返回 `config.skills_dir`。
- [x] `project` 按 `project_id` 查找 `config.projects`。
- [x] 拒绝缺少 `project_id` 的项目目标。
- [x] 拒绝不存在或已失效的项目绑定。
- [x] 返回解析后的目录、scope、project ID 和 project name。
- [x] 项目目标同时返回按工具解析的目录，并拒绝未纳入白名单的工具。
- [x] 不接受前端传入的目录路径。

### Task 4：安装命令接入目标目录

**Files:**

- Modify: `src-tauri/src/commands/marketplace.rs`

**TODO:**

- [x] `install_marketplace_skill` 使用解析后的目标目录。
- [x] `install_marketplace_skill_by_ref` 使用解析后的目标目录。
- [x] GitHub group 的所有成员使用同一个目标目录。
- [x] `InstallResult.installed_path` 返回实际安装位置。
- [x] 安装完成后使 Skills 缓存和 Marketplace 缓存失效。
- [x] 项目安装先写入项目中央托管目录，再按实际工具目录创建链接。
- [x] 重新安装会同步工具链接，且只清理确认属于当前 Skill 的受管链接。

### Task 5：后端目标解析测试

**Files:**

- Test: `src-tauri/src/commands/marketplace.rs`

**TODO:**

- [x] 测试未传目标时解析到全局目录。
- [x] 测试显式全局目标。
- [x] 测试有效项目目标和有效的非当前项目目标。
- [x] 测试项目目标缺少 `project_id`。
- [x] 测试不存在的 `project_id`。
- [x] 测试项目 ID 不能绕过配置传入任意目录。

**Phase 2 验收：**

- [x] Marketplace 单 Skill 能安装到项目目录。
- [x] GitHub 单 Skill 和 group 能安装到项目目录。
- [x] 全局安装行为无回归。

---

## 六、Phase 3：多作用域安装状态

### Task 6：收集市场 Skill 的本地实例

**Files:**

- Modify: `src-tauri/src/commands/marketplace.rs`
- Optionally Modify: `src-tauri/src/services/scanner.rs`

**TODO:**

- [x] 收集全局市场 Skill。
- [x] 收集全局和所有已绑定项目的市场 Skill，不改变 Skills 页面只扫描当前项目的语义。
- [x] 使用 marketplace metadata 关联远端 Skill，而不是只按目录名关联。
- [x] 为每个本地实例计算独立的 `install_status`。
- [x] 生成稳定的 `instance_id`、scope 和项目信息。
- [x] 同一个 marketplace skill ID 的多个实例不能互相覆盖。

### Task 7：合并市场列表状态

**Files:**

- Modify: `src-tauri/src/commands/marketplace.rs`
- Modify: `src-tauri/src/services/marketplace.rs`

**TODO:**

- [x] `fetch_marketplace_skills` 返回 `installations`。
- [x] 收藏快照与离线列表能用本地实例补回安装状态。
- [x] 顶层 `install_status` 使用聚合优先级计算。
- [x] Marketplace 状态独立于当前项目，并聚合所有项目实例。
- [x] 升级 Marketplace 本地快照 key 或 schema version，避免旧快照污染。

### Task 8：状态模型测试

**TODO:**

- [x] 仅全局安装时返回一个 global installation。
- [x] 仅项目安装时返回一个 project installation。
- [x] 全局与项目同时安装时返回两个 installation。
- [x] 全局最新版、项目旧版本时聚合状态为 `update_available`。
- [x] 同名非市场 Skill 不得被识别为已安装市场实例。

**Phase 3 验收：**

- [x] 市场列表能够区分全局和多个项目安装状态。
- [x] 一个作用域已安装时，另一个作用域仍可执行安装。

---

## 七、Phase 4：Marketplace 安装交互

### Task 9：新增安装位置选择组件

**Files:**

- Create: `src/components/marketplace/InstallTargetDialog.tsx`
- Modify: `src/pages/Marketplace.tsx`
- Modify: `src/components/marketplace/SkillDetailModal.tsx`

**TODO:**

- [x] 弹窗使用复选模型展示全局和所有已绑定项目。
- [x] 默认选中全局。
- [x] 每个目标展示“未安装 / 已安装 / 可更新”。
- [x] 选择未安装目标时主操作为“安装”。
- [x] 选择可更新目标时主操作为“更新”。
- [x] 所选目标均为最新版且工具集合未变化时禁用提交。
- [x] 缺少项目根目录的绑定不可选，其他非当前项目仍可选择。
- [x] 每个选中项目独立配置工具目标。
- [x] 提供进入项目绑定管理的操作。
- [x] 安装中锁定目标选择和提交按钮。

### Task 10：列表卡片和详情页接入

**Files:**

- Modify: `src/pages/Marketplace.tsx`
- Modify: `src/components/marketplace/SkillDetailModal.tsx`

**TODO:**

- [x] 卡片安装按钮打开目标选择弹窗。
- [x] 详情页安装按钮打开同一个弹窗。
- [x] `handleInstall` 接收多目标 selection，展开后逐目标执行。
- [x] 支持同时勾选全局和多个项目，单目标失败不阻断其他目标。
- [x] 安装成功后刷新市场状态。
- [x] 项目安装成功后的“查看”操作使用 `instance_id`。
- [x] 项目实例不可见时不跳转到错误的全局实例。
- [x] 卡片展示简洁的作用域安装摘要。

**Phase 4 验收：**

- [x] 从卡片可一次安装全局和多个项目副本。
- [x] 从详情页可执行相同行为。
- [x] 重复点击不会并发执行多个安装任务。

---

## 八、Phase 5：GitHub 链接安装

### Task 11：GitHub 安装弹窗增加目标选择

**Files:**

- Modify: `src/pages/Marketplace.tsx`

**TODO:**

- [x] GitHub 弹窗复用 Marketplace 的全局/多项目选择器。
- [x] 默认选择全局。
- [x] 展示所有有效项目，不要求目标项目是当前项目。
- [x] 为每个所选目标调用 `install_marketplace_skill_by_ref`。
- [x] 成功或部分成功提示包含各目标项目。
- [x] 安装完成后刷新全局及全部项目的 Marketplace 状态。

**Phase 5 验收：**

- [x] GitHub 单 Skill 可同时安装到全局和多个项目。
- [x] GitHub group 所有成员可同时安装到全局和多个项目。
- [x] GitHub 直链更新仍能命中原项目实例。

---

## 九、Phase 6：更新与卸载

### Task 12：单个更新保留作用域

**Files:**

- Modify: `src/pages/Marketplace.tsx`
- Modify: `src-tauri/src/commands/marketplace.rs`

**TODO:**

- [x] 更新动作必须携带目标 scope 和 project ID。
- [x] 更新前再次由后端解析目标目录。
- [x] 项目副本更新后仍位于项目目录。
- [x] 更新一个实例不能覆盖或删除另一个实例。

### Task 13：批量更新所有市场实例

**Files:**

- Modify: `src-tauri/src/commands/marketplace.rs`

**TODO:**

- [x] `sync_marketplace_installed_skills` 枚举需要更新的安装实例，而不是只枚举远端 Skill。
- [x] 按每个实例所属目录调用安装服务。
- [x] 同一 Skill 的 global/project 旧版本分别计入 checked/updated/failed。
- [x] 单个实例失败不阻断其他实例。
- [x] 错误信息包含 scope 或项目名，便于定位。

### Task 14：精确卸载

**Files:**

- Modify: `src/pages/Marketplace.tsx`

**TODO:**

- [x] 只有一个安装实例时，确认框明确显示其作用域。
- [x] 存在多个实例时，要求用户选择卸载目标。
- [x] 调用 `delete_skill(instance_id)` 删除选中实例。
- [x] 移除当前按 marketplace skill ID 删除全部副本的行为。
- [x] 卸载后刷新 `installations` 和聚合状态。

**Phase 6 验收：**

- [x] 更新项目实例不会在全局目录生成副本。
- [x] 卸载项目实例不会删除全局实例。
- [x] 卸载全局实例不会删除项目实例。
- [x] 全部更新可处理同一 Skill 的多个旧版本实例。

---

## 十、Phase 7：文案、测试与最终验证

### Task 15：中英文文案

**Files:**

- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**TODO:**

- [x] 安装位置标题与说明。
- [x] 全局和当前项目标签。
- [x] 未安装、已安装、可更新状态。
- [x] 当前项目不可用提示。
- [x] 项目安装、更新和卸载成功提示。
- [x] 多实例卸载选择文案。
- [x] 批量更新失败信息。

### Task 16：自动化测试

**TODO:**

- [x] Rust：安装目标解析单元测试。
- [x] Rust：全局和项目安装目录测试。
- [x] Rust：项目根误绑定迁移只移动 marketplace 元数据目录。
- [x] Rust：项目工具目录映射、链接同步和用户目录冲突保护测试。
- [x] Rust：多实例状态聚合测试。
- [x] Rust：批量更新保持实例目录测试。
- [x] TypeScript：安装目标状态映射测试。
- [x] TypeScript：聚合状态和按钮动作测试。
- [x] TypeScript：卸载目标选择测试。

### Task 17：构建和手动回归

**Commands:**

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib -- --test-threads=1
node --test src/pages/projectBindings.test.ts src/pages/marketplace/installTargets.test.ts src/pages/marketplace/projectToolTargets.test.ts src/pages/marketplace/sortMarketplaceSkillsByInstallStatus.test.ts
```

**TODO:**

- [x] 前端 TypeScript 和 Vite 构建通过。
- [x] Marketplace Rust 定向测试通过。
- [x] Scanner Rust 定向测试通过。
- [x] Rust 全量串行测试通过（311/311）。
- [x] `git diff --check` 通过。
- [ ] 手动验证全局安装。
- [ ] 手动验证项目安装。
- [ ] 手动验证一次选择全局和多个项目安装。
- [ ] 手动验证单个实例更新。
- [ ] 手动验证全部更新。
- [ ] 手动验证精确卸载。
- [ ] 手动验证切换当前项目只改变上下文标记，不隐藏其他项目状态。
- [ ] 手动验证 GitHub 单 Skill 和 group 安装。

---

## 十一、最终验收清单

- [x] 未配置项目的用户仍可正常使用 Marketplace，全局行为无回归。
- [x] 用户可以同时选择全局和任意多个有效项目。
- [x] 后端不信任前端目录路径，只使用配置内的项目绑定。
- [x] 同一市场 Skill 可以同时存在于全局和多个项目。
- [x] 市场状态能够分别展示所有安装实例。
- [x] 更新始终写回实例原目录。
- [x] 卸载只删除选中的 `instance_id`。
- [x] GitHub 链接安装与普通 Marketplace 安装行为一致。
- [x] 中英文界面文案完整。
- [ ] 自动化测试、前端构建和真实 Tauri 手动回归全部通过。

---

## 十二、风险与回滚点

### 风险 1：顶层 `install_status` 无法表达多实例

处理：新增 `installations` 作为真实状态，顶层字段仅作为排序和旧 UI 的聚合兼容值。

### 风险 2：项目绑定变化后 Marketplace 快照状态过期

处理：Marketplace 每次读取都重新扫描全局和所有项目实例，再与远端快照合并；当前项目只作为界面上下文标记。

### 风险 3：批量更新把项目实例写回全局

处理：批量更新的执行单元必须是 installation，而不是 marketplace skill；每个 installation 都重新解析目标目录。

### 风险 4：卸载误删多个实例

处理：卸载 API 继续使用既有 `delete_skill(instance_id)`；前端不得再按 marketplace skill ID 批量删除。

### 回滚点

1. 后端 `target` 参数保持可选，可先保留全局安装入口。
2. 新增字段使用默认值，旧缓存和旧前端不会因反序列化直接失败。
3. 各 Phase 独立提交；出现问题时可按 Phase 回滚。

---

## 十三、实施记录

执行时在此追加记录，格式如下：

```md
### YYYY-MM-DD / Phase N

- 完成：
- 测试：
- 遗留：
- 关联提交：
```

当前记录：

- 2026-08-17：完成实施方案整理，尚未开始代码修改。

### 2026-08-18 / Phase 1-7

- 完成：安装目标安全解析、多实例状态聚合、Marketplace 与 GitHub 目标选择、按实例更新和卸载、中英文文案及缓存 schema 升级。
- 测试：`npm run build`；Marketplace Rust 66 项通过；Scanner Rust 13 项通过；Marketplace TypeScript 9 项通过；`git diff --check` 通过。
- 遗留：当前会话缺少 Browser 插件要求的控制运行时，未执行真实 Tauri 界面的手动安装、更新、卸载及截图回归；相关手动项保持未勾选。
- 关联提交：未提交。

### 2026-08-18 / 项目级工具目录修正

- 完成：项目绑定改为项目根目录 + 中央托管目录；加入 Claude Code、Codex、Vercel Skills、OpenCode、Cursor、Gemini 的显式项目目录映射；Marketplace/GitHub 项目安装支持多工具选择；安装、更新、扫描、启用/禁用和精确卸载统一使用中央副本与工具链接。
- 兼容：加载旧配置时识别“项目根目录误当 Skill 目录”的情况，只迁移带 `source: marketplace` 的直接子目录，并对重名/失败执行保守处理；普通项目文件、本地 Skill 和非受管链接不移动。
- 测试：`cargo test --lib -- --test-threads=1`（309/309）；Marketplace 相关 Rust 测试（21/21）；Scanner（13/13）；Skills 项目生命周期（12/12）；TypeScript 项目绑定与 Marketplace 目标测试（20/20）；`npm run build`；`git diff --check`。
- 遗留：当前环境没有可用的 Browser 控制运行时，未执行真实 Tauri 界面的手动安装、更新、卸载及截图回归；相关手动项保持未勾选。

### 2026-08-18 / Phase 8 多目标安装优化

- 完成：安装弹窗与 GitHub 弹窗统一支持全局和多个项目同时勾选；每个项目独立配置工具；后端接受任意有效项目绑定；Marketplace 状态、更新检查和全部更新覆盖所有项目，不再依赖 `active_project_id`。
- 行为：多目标逐项执行并反馈完整成功、部分成功或全部失败；已安装目标自动跳过；增删工具链接都会被识别为需要同步。
- 测试：`cargo test --lib -- --test-threads=1`（311/311）；TypeScript 项目绑定与 Marketplace 目标测试（24/24）；`npm run build`；`git diff --check`。
- 遗留：Browser 插件未暴露可调用运行时，未执行真实 Tauri 界面的点击、截图和控制台回归；相关手动项保持未勾选。
