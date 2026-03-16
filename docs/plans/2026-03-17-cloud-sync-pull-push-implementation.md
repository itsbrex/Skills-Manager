# Cloud Sync Pull-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 启动/登录立即拉取，手动/自动同步先 pull 再 push，新增同步阶段状态，并将 preferences 全量云同步。

**Architecture:** 在前端引入可测试的同步工作流函数（pull→push+冲突重试），Hook 负责调用与状态更新；Rust 侧扩展 CloudSyncPayload 携带 preferences 并参与 hash。

**Tech Stack:** React + Tauri (TypeScript), Rust (Tauri backend), node:test, cargo test

---

### Task 1: 添加同步工作流的失败测试（前端 TDD RED）

**Files:**
- Create: `src/services/__tests__/cloudSyncWorkflow.test.ts`

**Step 1: 写失败测试（pull→push 顺序与 stage）**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPullThenPush } from "../cloudSyncWorkflow.ts";

const okResult = { status: "synced", revision: 2 } as const;

test("syncPullThenPush runs pull then push and updates stages", async () => {
  const stages: string[] = [];
  const calls: string[] = [];

  await syncPullThenPush({
    pull: async () => {
      calls.push("pull");
    },
    push: async () => {
      calls.push("push");
      return okResult;
    },
    onStage: (stage) => stages.push(stage),
  });

  assert.deepEqual(calls, ["pull", "push"]);
  assert.deepEqual(stages, ["pulling", "pushing", "idle"]);
});
```

**Step 2: 运行测试（应失败：找不到模块）**

Run: `node --test --experimental-strip-types src/services/__tests__/cloudSyncWorkflow.test.ts`

Expected: FAIL with “Cannot find module '../cloudSyncWorkflow.ts'”.

---

### Task 2: 实现同步工作流（前端 TDD GREEN）

**Files:**
- Create: `src/services/cloudSyncWorkflow.ts`
- Modify: `src/services/__tests__/cloudSyncWorkflow.test.ts`

**Step 1: 最小实现**

```typescript
import type { CloudSyncPushResult } from "../types/index.ts";

export type SyncStage = "idle" | "pulling" | "pushing" | "error";

type SyncPullThenPushOptions = {
  pull: () => Promise<void>;
  push: () => Promise<CloudSyncPushResult>;
  onStage: (stage: SyncStage) => void;
  onError?: (message: string) => void;
  retryOnConflict?: boolean;
};

export async function syncPullThenPush({
  pull,
  push,
  onStage,
  onError,
  retryOnConflict = true,
}: SyncPullThenPushOptions): Promise<CloudSyncPushResult> {
  try {
    onStage("pulling");
    await pull();
    onStage("pushing");
    let result = await push();

    if (result.status === "conflict" && retryOnConflict) {
      onStage("pulling");
      await pull();
      onStage("pushing");
      result = await push();
    }

    if (result.status === "conflict") {
      throw new Error("Sync conflict persists after retry");
    }

    onStage("idle");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onError?.(message);
    onStage("error");
    throw err;
  }
}
```

**Step 2: 增加冲突与 pull 失败测试**

```typescript
test("syncPullThenPush stops when pull fails", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      syncPullThenPush({
        pull: async () => {
          calls.push("pull");
          throw new Error("pull failed");
        },
        push: async () => {
          calls.push("push");
          return okResult;
        },
        onStage: () => {},
      }),
    /pull failed/,
  );
  assert.deepEqual(calls, ["pull"]);
});

test("syncPullThenPush retries once on conflict", async () => {
  const calls: string[] = [];
  let pushCount = 0;

  await syncPullThenPush({
    pull: async () => {
      calls.push("pull");
    },
    push: async () => {
      calls.push("push");
      pushCount += 1;
      return pushCount === 1
        ? ({ status: "conflict", revision: 1, payload: {} as any, local_payload: {} as any })
        : okResult;
    },
    onStage: () => {},
  });

  assert.deepEqual(calls, ["pull", "push", "pull", "push"]);
});
```

**Step 3: 运行测试（应通过）**

Run: `node --test --experimental-strip-types src/services/__tests__/cloudSyncWorkflow.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add src/services/cloudSyncWorkflow.ts src/services/__tests__/cloudSyncWorkflow.test.ts
git commit -m "test: add sync pull-then-push workflow"
```

---

### Task 3: Rust 测试覆盖 preferences（后端 TDD RED）

**Files:**
- Modify: `src-tauri/src/commands/cloud_sync.rs`
- Modify: `src-tauri/src/services/cloud_sync.rs`

**Step 1: 增加 hash 变化测试（应编译失败）**

在 `commands/cloud_sync.rs` 的 `tests` 模块新增：

```rust
#[test]
fn payload_hash_changes_when_preferences_change() {
    crate::test_support::with_temp_home(|_| {
        let payload = CloudSyncPayload {
            version: 1,
            updated_at: 1,
            device_id: "d1".to_string(),
            skills: vec![],
            tool_states: Default::default(),
            custom_tools: vec![],
            preferences: Some(UserPreferences::default()),
        };

        let mut updated = payload.clone();
        let mut prefs = UserPreferences::default();
        prefs.language = "zh".to_string();
        updated.preferences = Some(prefs);

        let hash1 = payload_hash(&payload).expect("hash payload");
        let hash2 = payload_hash(&updated).expect("hash updated");
        assert_ne!(hash1, hash2);
    });
}
```

**Step 2: 增加 build_payload 包含 preferences 断言（应编译失败）**

在 `services/cloud_sync.rs` 的 `build_payload_includes_enabled_skills_and_custom_tools` 里添加：

```rust
assert!(payload.preferences.is_some());
```

**Step 3: 运行测试（应失败）**

Run: `cargo test payload_hash_changes_when_preferences_change`

Expected: 编译失败或测试失败（CloudSyncPayload 缺字段）。

---

### Task 4: Rust 实现 preferences 同步（后端 TDD GREEN）

**Files:**
- Modify: `src-tauri/src/models/cloud_sync.rs`
- Modify: `src-tauri/src/services/cloud_sync.rs`
- Modify: `src-tauri/src/commands/cloud_sync.rs`

**Step 1: CloudSyncPayload 加 preferences 字段**

```rust
use crate::models::config::UserPreferences;

pub struct CloudSyncPayload {
    pub version: u8,
    pub updated_at: i64,
    pub device_id: String,
    #[serde(default)]
    pub skills: Vec<CloudSyncSkill>,
    #[serde(default)]
    pub tool_states: HashMap<String, CloudSyncToolState>,
    #[serde(default)]
    pub custom_tools: Vec<CloudSyncCustomTool>,
    #[serde(default)]
    pub preferences: Option<UserPreferences>,
}
```

**Step 2: build_payload 写入 preferences**

```rust
let preferences = config
    .preferences
    .clone()
    .unwrap_or_default();

CloudSyncPayload {
    // ...
    preferences: Some(preferences),
}
```

**Step 3: payload_hash 结构体加入 preferences**

```rust
struct HashPayload {
    version: u8,
    updated_at: i64,
    device_id: String,
    skills: Vec<CloudSyncSkill>,
    tool_states: BTreeMap<String, CloudSyncToolState>,
    custom_tools: Vec<CloudSyncCustomTool>,
    preferences: Option<UserPreferences>,
}
```

**Step 4: 更新所有 CloudSyncPayload 测试构造体**

为现有测试中的 `CloudSyncPayload { ... }` 补 `preferences: Some(UserPreferences::default())`。

**Step 5: 运行测试（应通过）**

Run: `cargo test payload_hash_changes_when_preferences_change`

Expected: PASS

**Step 6: Commit**

```bash
git add src-tauri/src/models/cloud_sync.rs src-tauri/src/services/cloud_sync.rs src-tauri/src/commands/cloud_sync.rs
git commit -m "feat: include preferences in cloud sync payload"
```

---

### Task 5: 前端 types 与 payload 应用 preferences（含设置同步）

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useCloudSyncAgent.tsx`

**Step 1: 扩展 CloudSyncPayload 类型**

```typescript
export interface CloudSyncPayload {
  // ...
  custom_tools: CloudSyncCustomTool[];
  preferences?: UserPreferences | null;
}
```

**Step 2: applyCloudPayload 应用 preferences**

在 `applyCloudPayload` 中，在保存 config 时加入：

```typescript
if (payload.preferences) {
  const merged = {
    ...defaultPreferences,
    ...(config.preferences ?? {}),
    ...payload.preferences,
  };
  config.preferences = merged;
  await invoke("save_config", { config });
  setCloudSyncSettingsSnapshot({
    auto: merged.cloud_sync_auto,
    intervalMinutes: merged.cloud_sync_interval_minutes,
  });
  setVaultConsent(merged.vault_backup_consent);
}
```

**Step 3: 运行前端测试（现有）**

Run: `node --test --experimental-strip-types src/services/__tests__/cloudSyncWorkflow.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/useCloudSyncAgent.tsx
git commit -m "feat: apply synced preferences on pull"
```

---

### Task 6: Hook 流程改为 pull→push + 同步阶段状态

**Files:**
- Modify: `src/hooks/useCloudSyncAgent.tsx`

**Step 1: 新增 syncStage 状态与 errorRef**

```typescript
import { syncPullThenPush, SyncStage } from "@/services/cloudSyncWorkflow";

const [syncStage, setSyncStage] = useState<SyncStage>("idle");
const errorRef = useRef<string | null>(null);

useEffect(() => {
  errorRef.current = error;
}, [error]);
```

**Step 2: 抽象 pull-only 与 pull+push**

```typescript
const pullLatest = useCallback(async () => {
  setError(null);
  await syncPullThenPush({
    pull: performPull,
    push: async () => ({ status: "skipped", reason: "pull_only" } as const),
    onStage: setSyncStage,
    onError: setError,
    retryOnConflict: false,
  });
}, [performPull]);

const pullThenPush = useCallback(async (allowVaultBackup: boolean) => {
  setError(null);
  await syncPullThenPush({
    pull: performPull,
    push: () => performPush(allowVaultBackup),
    onStage: setSyncStage,
    onError: setError,
    retryOnConflict: true,
  });
}, [performPull, performPush]);
```

**Step 3: 登录/启动时改为 pullLatest**

在登录态 effect 中调用 `pullLatest()`，不再使用 `lastPullUserRef` 阻断。

**Step 4: 自动同步与手动同步改为 pullThenPush**

- 自动同步定时器里调用 `pullThenPush`，并在 `errorRef.current` 非空时跳过。
- `manualSync`、`acceptVaultConsent`、`denyVaultConsent` 中调用 `pullThenPush`。

**Step 5: push 结果处理调整**

`performPush` 返回 `CloudSyncPushResult`，并在 `synced/skipped` 时更新 `lastSyncedAt`；不再设置 `conflict`。

**Step 6: Commit**

```bash
git add src/hooks/useCloudSyncAgent.tsx
git commit -m "feat: pull before push and track sync stage"
```

---

### Task 7: 设置页展示拉取/上传状态 + i18n

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**Step 1: 新增文案**

`cloudSync.pulling`: “正在从云端拉取…” / “Pulling from cloud…”

`cloudSync.pushing`: “正在上传到云端…” / “Uploading to cloud…”

**Step 2: Settings 页面显示同步阶段**

在云同步卡片中新增一行显示：

```tsx
{cloudSync.syncStage === "pulling" && (
  <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
    {t("cloudSync.pulling")}
  </div>
)}
{cloudSync.syncStage === "pushing" && (
  <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
    {t("cloudSync.pushing")}
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/pages/Settings.tsx src/i18n/locales/zh.ts src/i18n/locales/en.ts
git commit -m "feat: show pull/push status in settings"
```

---

### Task 8: 全量验证

**Step 1: Rust tests**

Run: `cd src-tauri && cargo test`

Expected: PASS

**Step 2: Frontend tests**

Run: `node --test --experimental-strip-types src/services/__tests__/cloudSyncWorkflow.test.ts`

Expected: PASS

**Step 3: 总结变更**

记录：
- 启动/登录 pull
- 手动/自动同步 pull→push
- preferences 全量同步
- UI 显示拉取/上传状态

**Step 4: Commit（若有剩余改动）**

```bash
git add -A
git commit -m "chore: finalize cloud sync pull-first workflow"
```
