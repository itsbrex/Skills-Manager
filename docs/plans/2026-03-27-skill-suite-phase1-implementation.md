# Skill Suite Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `superpowers`、`baoyu-skill` 这类成组 skill 建立后端 Phase 1 地基，在不改变现有普通 skill 语义的前提下支持 package manifest、package state、本地安装与卸载。

**Architecture:** Phase 1 只做后端能力，不改 UI，不改现有单 skill marketplace 安装路径，不把扫描器改成递归。package 通过独立 service 管理，成员 skill 物化到 `~/.skills-manager/skills/<package-id>--<member-id>/`，因此现有扫描、启用/禁用、链接和同步逻辑继续只处理叶子 skill。

**Tech Stack:** Rust, Tauri commands, serde/serde_json, `toml` crate, filesystem-based package state, inline Rust tests with `with_temp_home`

---

### Task 1: 增加 Skill Package 模型与叶子 skill 的 package 元数据

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/models/skill_package.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/models/skill.rs`
- Modify: `src-tauri/src/services/scanner.rs`

**Step 1: 写失败测试，覆盖 manifest 解析和 leaf meta 读取**

在 `src-tauri/src/models/skill_package.rs` 和 `src-tauri/src/services/scanner.rs` 添加测试，覆盖：

- `parse_skill_package_manifest_reads_members_and_strategy`
- `parse_skill_package_manifest_rejects_duplicate_skill_ids`
- `scanner_loads_optional_package_meta_from_meta_json`
- `scanner_keeps_plain_skill_package_meta_none`

测试里直接断言这些结构：

```rust
assert_eq!(manifest.package_id, "superpowers");
assert_eq!(manifest.install_strategy, SkillPackageInstallStrategy::MaterializedMembers);
assert_eq!(manifest.members[0].skill_id, "superpowers--brainstorming");
assert_eq!(skill.package_meta.as_ref().unwrap().package_id, "superpowers");
assert!(plain_skill.package_meta.is_none());
```

**Step 2: 跑测试确认失败**

Run: `cargo test parse_skill_package_manifest_reads_members_and_strategy --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，提示 `skill_package` 模型或解析函数不存在。

Run: `cargo test scanner_loads_optional_package_meta_from_meta_json --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，提示 `package_meta` 字段不存在或扫描器未读取 package 字段。

**Step 3: 写最小实现**

在 `src-tauri/src/models/skill_package.rs` 新增：

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SkillPackageInstallStrategy {
    #[serde(rename = "materialized_members")]
    MaterializedMembers,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SkillPackageMember {
    pub member_id: String,
    pub skill_id: String,
    pub path: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SkillPackageManifest {
    pub schema_version: u32,
    pub package_id: String,
    pub name: String,
    pub version: String,
    pub install_strategy: SkillPackageInstallStrategy,
    #[serde(default)]
    pub members: Vec<SkillPackageMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SkillPackageMeta {
    pub package_id: String,
    pub package_name: Option<String>,
    pub package_member_id: String,
    pub package_version: Option<String>,
}
```

在 `src-tauri/src/models/skill.rs` 给 `Skill` 增加可选字段：

```rust
#[serde(default)]
pub package_meta: Option<SkillPackageMeta>,
```

在 `src-tauri/src/services/scanner.rs` 的 `MetaJson` 中增量支持：

- `package_id`
- `package_name`
- `package_member_id`
- `package_version`

解析规则：

- `package_id` 和 `package_member_id` 同时存在时才生成 `package_meta`
- 否则保持 `None`
- 对旧 skill 完全兼容

同时在 `src-tauri/Cargo.toml` 添加：

```toml
toml = "0.8"
```

**Step 4: 跑测试确认通过**

Run: `cargo test parse_skill_package_manifest_reads_members_and_strategy --manifest-path src-tauri/Cargo.toml`

Expected: PASS

Run: `cargo test scanner_loads_optional_package_meta_from_meta_json --manifest-path src-tauri/Cargo.toml`

Expected: PASS

**Step 5: 提交**

```bash
git add src-tauri/Cargo.toml src-tauri/src/models/skill_package.rs src-tauri/src/models/mod.rs src-tauri/src/models/skill.rs src-tauri/src/services/scanner.rs
git commit -m "feat: add skill package models and scanner metadata"
```

### Task 2: 实现本地 package state 与 manifest 解析服务

**Files:**
- Create: `src-tauri/src/services/skill_packages.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/models/skill_package.rs`

**Step 1: 写失败测试，覆盖 state 读写和 list**

在 `src-tauri/src/services/skill_packages.rs` 添加测试：

- `list_installed_skill_packages_returns_empty_when_packages_dir_missing`
- `write_and_read_installed_skill_package_round_trip`
- `parse_manifest_from_file_validates_unique_member_ids`
- `parse_manifest_from_file_validates_unique_skill_ids`

测试里使用 `crate::test_support::with_temp_home`，并断言目录结构：

```rust
let packages_dir = home.join(".skills-manager").join("packages");
assert_eq!(stored.package_id, "superpowers");
assert_eq!(stored.selected_members, vec!["brainstorming".to_string()]);
```

**Step 2: 跑测试确认失败**

Run: `cargo test write_and_read_installed_skill_package_round_trip --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，提示 `SkillPackageService` 或相关方法不存在。

**Step 3: 写最小实现**

在 `src-tauri/src/models/skill_package.rs` 增加状态模型：

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InstalledSkillPackage {
    pub package_id: String,
    pub name: String,
    pub version: String,
    pub installed_members: Vec<String>,
    pub selected_members: Vec<String>,
    pub manifest_hash: Option<String>,
    pub installed_at: i64,
    pub updated_at: i64,
}
```

在 `src-tauri/src/services/skill_packages.rs` 实现：

```rust
pub struct SkillPackageService;

impl SkillPackageService {
    pub fn packages_dir() -> PathBuf { ... }
    pub fn package_dir(package_id: &str) -> PathBuf { ... }
    pub fn parse_manifest(content: &str) -> Result<SkillPackageManifest, String> { ... }
    pub fn read_manifest(path: &Path) -> Result<SkillPackageManifest, String> { ... }
    pub fn list_installed_packages() -> Result<Vec<InstalledSkillPackage>, String> { ... }
    pub fn read_installed_package(package_id: &str) -> Result<InstalledSkillPackage, String> { ... }
    pub fn write_installed_package(state: &InstalledSkillPackage) -> Result<(), String> { ... }
}
```

实现细节：

- `packages_dir()` 固定到 `~/.skills-manager/packages`
- 每个 package 用 `packages/<package-id>/state.json`
- manifest 校验时拒绝重复 `member_id` 和重复 `skill_id`
- 只接受 `materialized_members`

**Step 4: 跑测试确认通过**

Run: `cargo test write_and_read_installed_skill_package_round_trip --manifest-path src-tauri/Cargo.toml`

Expected: PASS

Run: `cargo test parse_manifest_from_file_validates_unique_skill_ids --manifest-path src-tauri/Cargo.toml`

Expected: PASS

**Step 5: 提交**

```bash
git add src-tauri/src/models/skill_package.rs src-tauri/src/services/skill_packages.rs src-tauri/src/services/mod.rs
git commit -m "feat: add local skill package state service"
```

### Task 3: 实现 package 物化安装与卸载，不改现有普通 skill 扫描语义

**Files:**
- Modify: `src-tauri/src/services/skill_packages.rs`
- Modify: `src-tauri/src/services/scanner.rs`
- Test: `src-tauri/src/services/skill_packages.rs`
- Test: `src-tauri/src/services/scanner.rs`

**Step 1: 写失败测试，覆盖物化安装和卸载**

在 `src-tauri/src/services/skill_packages.rs` 添加测试：

- `install_skill_package_from_local_source_materializes_members`
- `install_skill_package_writes_package_meta_into_member_meta_json`
- `remove_skill_package_removes_materialized_members_only`
- `install_skill_package_does_not_touch_plain_skills`

在 `src-tauri/src/services/scanner.rs` 添加测试：

- `scan_skills_lists_materialized_package_members_as_plain_leaf_skills`

测试 fixture 目录建议这样构造：

```text
source-superpowers/
  skill-pack.toml
  skills/
    brainstorming/SKILL.md
    writing-plans/SKILL.md
```

核心断言：

```rust
assert!(skills_dir.join("superpowers--brainstorming").exists());
assert!(skills_dir.join("superpowers--writing-plans").exists());
assert_eq!(scanned_ids, vec!["superpowers--brainstorming", "superpowers--writing-plans"]);
assert!(plain_skill_dir.exists(), "plain skills must remain untouched");
```

**Step 2: 跑测试确认失败**

Run: `cargo test install_skill_package_from_local_source_materializes_members --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，提示安装函数不存在或没有写出 materialized 成员目录。

**Step 3: 写最小实现**

在 `src-tauri/src/services/skill_packages.rs` 增加：

```rust
pub fn install_from_local_source(source_dir: &Path, skills_dir: &Path) -> Result<InstalledSkillPackage, String> { ... }
pub fn remove_package(package_id: &str, skills_dir: &Path) -> Result<(), String> { ... }
```

安装逻辑：

1. 读取 `source_dir/skill-pack.toml`
2. 为每个 member 计算目标目录 `skills/<skill_id>/`
3. 复制 member 目录内容到目标目录
4. 在目标目录写入或覆盖 `meta.json`
5. `meta.json` 必须带：

```json
{
  "package_id": "superpowers",
  "package_member_id": "brainstorming",
  "package_name": "Superpowers",
  "package_version": "1.0.0"
}
```

6. 写入 `packages/<package-id>/state.json`

卸载逻辑：

- 只删除 `state.json` 中记录的 materialized 成员目录
- 不扫描删除其他普通 skill
- 最后删除空的 `packages/<package-id>/`

**Step 4: 跑测试确认通过**

Run: `cargo test install_skill_package_from_local_source_materializes_members --manifest-path src-tauri/Cargo.toml`

Expected: PASS

Run: `cargo test remove_skill_package_removes_materialized_members_only --manifest-path src-tauri/Cargo.toml`

Expected: PASS

Run: `cargo test scan_skills_lists_materialized_package_members_as_plain_leaf_skills --manifest-path src-tauri/Cargo.toml`

Expected: PASS

**Step 5: 提交**

```bash
git add src-tauri/src/services/skill_packages.rs src-tauri/src/services/scanner.rs
git commit -m "feat: materialize skill package members into leaf skills"
```

### Task 4: 暴露 package 命令接口，但保持现有 Skills/Marketplace UI 不变

**Files:**
- Create: `src-tauri/src/commands/skill_packages.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/types/index.ts`

**Step 1: 写失败测试，覆盖命令层最小 happy path**

在 `src-tauri/src/commands/skill_packages.rs` 添加测试：

- `list_skill_packages_returns_written_state`
- `remove_skill_package_command_cleans_up_materialized_members`

如命令测试构造 Tauri `State` 太重，可以退而求其次：

- 保持命令层轻薄
- 重点断言 service 已被调用，命令测试只做 smoke test

**Step 2: 跑测试确认失败**

Run: `cargo test list_skill_packages_returns_written_state --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，提示 command 模块或导出不存在。

**Step 3: 写最小实现**

在 `src-tauri/src/commands/skill_packages.rs` 增加：

```rust
#[tauri::command]
pub fn list_skill_packages() -> Result<Vec<InstalledSkillPackage>, String> { ... }

#[tauri::command]
pub fn install_skill_package_from_path(source_path: String) -> Result<InstalledSkillPackage, String> { ... }

#[tauri::command]
pub fn remove_skill_package(package_id: String) -> Result<(), String> { ... }
```

同步修改：

- `src-tauri/src/commands/mod.rs` 导出命令
- `src-tauri/src/lib.rs` 注册到 `generate_handler!`
- `src/types/index.ts` 新增：

```ts
export interface SkillPackageMeta {
  package_id: string;
  package_name?: string | null;
  package_member_id: string;
  package_version?: string | null;
}

export interface InstalledSkillPackage {
  package_id: string;
  name: string;
  version: string;
  installed_members: string[];
  selected_members: string[];
  manifest_hash?: string | null;
  installed_at: number;
  updated_at: number;
}
```

注意：

- 本任务只暴露 API，不接入现有页面
- `install_marketplace_skill` 和 `fetch_marketplace_skills` 本轮不改

**Step 4: 跑测试确认通过**

Run: `cargo test list_skill_packages_returns_written_state --manifest-path src-tauri/Cargo.toml`

Expected: PASS

Run: `cargo test remove_skill_package_command_cleans_up_materialized_members --manifest-path src-tauri/Cargo.toml`

Expected: PASS

**Step 5: 提交**

```bash
git add src-tauri/src/commands/skill_packages.rs src-tauri/src/commands/mod.rs src-tauri/src/services/mod.rs src-tauri/src/models/mod.rs src-tauri/src/lib.rs src/types/index.ts
git commit -m "feat: expose skill package management commands"
```

### Task 5: 回归测试，证明普通 skill、同步和容器目录行为没有被破坏

**Files:**
- Modify: `src-tauri/src/services/scanner.rs`
- Modify: `src-tauri/src/services/cloud_sync.rs`
- Modify: `src-tauri/src/services/config_manager.rs`

**Step 1: 写失败测试，锁住兼容边界**

添加这些测试：

- `scan_skills_with_config_still_ignores_container_dirs_without_skill_files`
- `package_managed_skills_do_not_change_cloud_sync_payload_shape`
- `package_state_does_not_use_skill_metadata_storage`

关键断言：

```rust
assert_eq!(ids, vec!["valid-skill"]);
assert_eq!(payload.skills[0].id, "superpowers--brainstorming");
assert!(config.skill_metadata.is_empty());
```

**Step 2: 跑测试确认失败**

Run: `cargo test package_managed_skills_do_not_change_cloud_sync_payload_shape --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，如果 payload 或 fixture 尚未支持 package-managed leaf skills。

**Step 3: 写最小实现**

保持实现约束：

- 继续用叶子 skill id 进入 `CloudSyncPayload`
- 不新增 `config.skill_metadata` 字段用途
- 容器目录忽略测试保持通过

必要时只补 fixture 和断言，不额外扩张功能范围。

**Step 4: 跑完整验证**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS

如果前端类型校验已在仓库使用，再补一轮：

Run: `npm test -- --runInBand`

Expected: PASS，或至少没有因为 `src/types/index.ts` 变更引入新的类型错误。

**Step 5: 提交**

```bash
git add src-tauri/src/services/scanner.rs src-tauri/src/services/cloud_sync.rs src-tauri/src/services/config_manager.rs
git commit -m "test: lock compatibility for plain skills and cloud sync"
```

## Notes

- 本计划故意不触碰 `src-tauri/src/services/marketplace.rs` 的单 skill 安装路径。package 与 marketplace 的自动识别放到后续阶段，以降低对现有 skill 的影响。
- 本计划故意不改 `Skills.tsx`、`Marketplace.tsx`。Phase 1 完成后，UI 仍然只看到物化后的叶子 skill，这是预期行为。
- 如果 Task 3 发现“删除 package 管理成员时用户本地改动需要保护”，允许在同一任务内加一个最小的覆盖确认或备份策略，但不要顺手扩展到 UI。
