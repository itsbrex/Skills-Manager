# Cloud Sync Vault Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有云同步基础上，补齐“pull 后应用 + 缺失技能自动恢复”，并引入 Vault 私有仓库无感备份/恢复非市场技能。

**Architecture:** 扩展 CloudSync payload 携带来源元信息（marketplace/vault），pull 后先补装缺失技能再应用 tool_states。Vault 走后端代管 GitHub 私有仓库，客户端通过 Tauri commands 访问 vault/list/upload/download。

**Tech Stack:** Tauri (Rust), React/TS, reqwest, mockito, vitest (新增)。

---

### Task 1: 添加前端测试基础（Vitest）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/package.json`
- Create: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/vitest.config.ts`
- Create: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src/services/__tests__/cloudSyncUtils.test.ts`

**Step 1: 写一个会失败的测试（先不实现函数）**

```ts
import { describe, it, expect } from "vitest";
import { computeMissingSkills } from "../cloudSyncUtils";

describe("computeMissingSkills", () => {
  it("returns skills that are missing locally", () => {
    const missing = computeMissingSkills(
      [{ id: "s1" }, { id: "s2" }],
      [{ id: "s1" }]
    );
    expect(missing.map((s) => s.id)).toEqual(["s2"]);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL with "Cannot find module '../cloudSyncUtils'" or "computeMissingSkills is not a function".

**Step 3: 加入最小测试脚本与配置（仍保持测试失败）**

```json
// package.json (scripts)
"test": "vitest run"
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

**Step 4: 再次运行测试，仍需失败**

Run: `npm run test`
Expected: FAIL because `cloudSyncUtils` not implemented yet.

**Step 5: Commit**

```bash
git add package.json vitest.config.ts src/services/__tests__/cloudSyncUtils.test.ts
git commit -m "chore: add vitest test harness"
```

---

### Task 2: 扩展 Skill 元信息（识别 marketplace/vault）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/models/skill.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/scanner.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/marketplace.rs` (如需复用 meta 字段)
- Test: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/scanner.rs`

**Step 1: 写 failing Rust 测试**

```rust
#[test]
fn load_skill_reads_marketplace_meta_fields() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skill_dir = home.join(".skills-manager").join("skills").join("mkt-skill");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("meta.json"),
            r#"{
  \"name\": \"mkt-skill\",
  \"version\": \"1.0\",
  \"source\": \"marketplace\",
  \"marketplace_skill_id\": \"mkt-123\",
  \"marketplace_skill_slug\": \"mkt-skill\",
  \"repo_url\": \"https://github.com/acme/repo\",
  \"skill_path\": \".claude/skills/mkt-skill\"
}"#,
        ).unwrap();

        let skill = ScannerService::load_skill_with_config(&skill_dir, &config).unwrap();
        assert_eq!(skill.source, SkillSource::Marketplace);
        assert!(skill.marketplace_meta.is_some());
    });
}
```

**Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test load_skill_reads_marketplace_meta_fields`
Expected: FAIL (不存在字段或断言失败)。

**Step 3: 最小实现**
- 在 `Skill` 上新增 `marketplace_meta` / `vault_meta` 可选字段。
- 扩展 `SkillSource` 增加 `Marketplace`、`Vault` 变体。
- `ScannerService::load_meta` 解析 `source` 与相关字段，填充到 `Skill`。

**Step 4: 运行测试确保通过**

Run: `cd src-tauri && cargo test load_skill_reads_marketplace_meta_fields`
Expected: PASS.

**Step 5: Commit**

```bash
git add src-tauri/src/models/skill.rs src-tauri/src/services/scanner.rs
git commit -m "feat: capture marketplace/vault meta in skill scan"
```

---

### Task 3: 扩展 CloudSync payload 与 hash

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/models/cloud_sync.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/cloud_sync.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/commands/cloud_sync.rs`
- Test: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/commands/cloud_sync.rs`

**Step 1: 写 failing 测试（hash 纳入 marketplace/vault 字段）**

```rust
#[test]
fn payload_hash_changes_when_marketplace_meta_changes() {
    let mut payload = CloudSyncPayload { /* 构造含 marketplace 字段 */ };
    let hash1 = payload_hash(&payload).unwrap();
    payload.skills[0].marketplace.as_mut().unwrap().marketplace_skill_id = "mkt-2".to_string();
    let hash2 = payload_hash(&payload).unwrap();
    assert_ne!(hash1, hash2);
}
```

**Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test payload_hash_changes_when_marketplace_meta_changes`
Expected: FAIL.

**Step 3: 最小实现**
- `CloudSyncSkill` 增加 `source`、`marketplace`、`vault` 字段。
- `build_payload` 根据 `Skill` 元信息填充。
- `payload_hash` 归一化时包含 marketplace/vault 字段。

**Step 4: 运行测试确保通过**

Run: `cd src-tauri && cargo test payload_hash_changes_when_marketplace_meta_changes`
Expected: PASS.

**Step 5: Commit**

```bash
git add src-tauri/src/models/cloud_sync.rs src-tauri/src/services/cloud_sync.rs src-tauri/src/commands/cloud_sync.rs
git commit -m "feat: include marketplace/vault meta in cloud sync payload"
```

---

### Task 4: Vault 服务端调用（Rust）

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/vault.rs`
- Create: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/commands/vault.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/commands/mod.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/lib.rs`
- Test: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/vault.rs`

**Step 1: 写 failing 测试（mockito）**

```rust
#[test]
fn vault_download_fetches_zip() {
    let mut server = mockito::Server::new();
    let _mock = server.mock("GET", "/api/v1/vault/download")
        .with_status(200)
        .with_body("zip-bytes")
        .create();

    let bytes = tauri::async_runtime::block_on(async {
        vault_download(&server.url(), "token", "skill-1").await.unwrap()
    });
    assert_eq!(bytes, b"zip-bytes");
}
```

**Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test vault_download_fetches_zip`
Expected: FAIL (函数不存在)。

**Step 3: 最小实现**
- `services/vault.rs`：实现 `vault_list/vault_upload/vault_download`（reqwest）。
- `commands/vault.rs`：读取 auth token，调用 service；下载后解包到 `skills_dir`。
- 将 commands 注册到 `lib.rs`。

**Step 4: 运行测试确保通过**

Run: `cd src-tauri && cargo test vault_download_fetches_zip`
Expected: PASS.

**Step 5: Commit**

```bash
git add src-tauri/src/services/vault.rs src-tauri/src/commands/vault.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add vault client commands"
```

---

### Task 5: 前端 CloudSync pull 应用 + 缺失技能补装

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src/services/cloudSyncUtils.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src/hooks/useCloudSyncAgent.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src/types/index.ts`
- Test: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src/services/__tests__/cloudSyncUtils.test.ts`

**Step 1: 写 failing 测试（已在 Task 1）**

**Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL (missing computeMissingSkills implementation).

**Step 3: 最小实现**

```ts
// cloudSyncUtils.ts
export function computeMissingSkills(remote: { id: string }[], local: { id: string }[]) {
  const localIds = new Set(local.map((s) => s.id));
  return remote.filter((s) => !localIds.has(s.id));
}
```

**Step 4: 运行测试确保通过**

Run: `npm run test`
Expected: PASS.

**Step 5: 更新 useCloudSyncAgent**
- `performPull` 在 `snapshot.payload` 存在时调用 `applyCloudPayload`。
- `applyCloudPayload` 增加安装缺失技能逻辑：
  - marketplace: 调用新 Tauri command `install_marketplace_skill_by_ref`
  - vault: 调用 `vault_download`
- 安装完成后再应用 tool_states。

**Step 6: Commit**

```bash
git add src/services/cloudSyncUtils.ts src/hooks/useCloudSyncAgent.tsx src/types/index.ts src/services/__tests__/cloudSyncUtils.test.ts
git commit -m "feat: apply cloud sync payload and restore missing skills"
```

---

### Task 6: 无感备份非市场技能（Vault Upload）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src/hooks/useCloudSyncAgent.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src/services/cloudSync.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/commands/vault.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/vault.rs`
- Test: `/Users/yjw/code/projects/skills-manager/.worktrees/codex/cloud-sync-vault/src-tauri/src/services/vault.rs`

**Step 1: 写 failing 测试（上传去重）**

```rust
#[test]
fn vault_upload_skips_when_hash_same() {
  // 构造本地 index 与 payload hash 相同，期望返回 Skipped
}
```

**Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test vault_upload_skips_when_hash_same`
Expected: FAIL.

**Step 3: 最小实现**
- `vault_upload` 接受 hash 与 size，若同 hash 则返回 `skipped`。
- 前端在 `manualSync`/定时同步前调用 `vault_backup`。

**Step 4: 运行测试确保通过**

Run: `cd src-tauri && cargo test vault_upload_skips_when_hash_same`
Expected: PASS.

**Step 5: Commit**

```bash
git add src-tauri/src/services/vault.rs src-tauri/src/commands/vault.rs src/hooks/useCloudSyncAgent.tsx src/services/cloudSync.ts
git commit -m "feat: add vault backup before cloud sync push"
```

---

### Task 7: 文档与收尾

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/docs/plans/2026-03-15-cloud-sync-vault-design.md`
- Modify: `/Users/yjw/code/projects/skills-manager/README.md` (如需描述新能力)

**Step 1: 更新文档**
- 补充 Vault API 与 payload 字段说明。

**Step 2: 验证**
- `npm run test`
- `cd src-tauri && cargo test`

**Step 3: Commit**

```bash
git add docs/plans/2026-03-15-cloud-sync-vault-design.md README.md
git commit -m "docs: document vault sync flow"
```

---

## Notes
- npm test 目前不存在脚本，已在 Task 1 增加。
- 由于后端服务未在本仓库内，Rust 侧仅实现客户端调用与解包/备份逻辑。
- 每个任务严格遵守 @test-driven-development。

