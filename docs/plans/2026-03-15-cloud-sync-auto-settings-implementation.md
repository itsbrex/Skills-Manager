# Cloud Sync Auto Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增云同步自动同步开关与同步间隔下拉框（默认 10 分钟），并让 CloudSyncProvider 按配置动态调度。

**Architecture:** 在前端新增 `cloudSyncSettingsStore` 保存自动同步偏好并支持订阅；Settings/Welcome 保存配置后更新 store；CloudSyncProvider 订阅 store 并启停/重建定时器。后端配置模型与默认值同步扩展。

**Tech Stack:** Tauri 2 (Rust), React + TypeScript, node:test

---

### Task 1: 扩展配置模型与默认值（Rust + TS）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src-tauri/src/models/config.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/types/index.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Settings.tsx`

**Step 1: Write the failing test**

在 `src-tauri/src/models/config.rs` 的 tests 模块新增：

```rust
#[test]
fn cloud_sync_preferences_persist() {
    let config = AppConfig::default();
    let prefs = config.preferences.as_ref().expect("prefs");
    assert!(prefs.cloud_sync_auto);
    assert_eq!(prefs.cloud_sync_interval_minutes, 10);

    let json = serde_json::to_string(&config).unwrap();
    let restored: AppConfig = serde_json::from_str(&json).unwrap();
    let restored_prefs = restored.preferences.as_ref().expect("prefs");
    assert!(restored_prefs.cloud_sync_auto);
    assert_eq!(restored_prefs.cloud_sync_interval_minutes, 10);
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src-tauri && cargo test cloud_sync_preferences_persist -- --nocapture`  
Expected: FAIL（字段不存在）

**Step 3: Write minimal implementation**

```rust
// src-tauri/src/models/config.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    // ...
    #[serde(default = "default_true")]
    pub cloud_sync_auto: bool,
    #[serde(default = "default_cloud_sync_interval_minutes")]
    pub cloud_sync_interval_minutes: u32,
}

fn default_cloud_sync_interval_minutes() -> u32 {
    10
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            // ...
            cloud_sync_auto: true,
            cloud_sync_interval_minutes: default_cloud_sync_interval_minutes(),
        }
    }
}
```

```ts
// src/types/index.ts
export interface UserPreferences {
  // ...
  cloud_sync_auto: boolean;
  cloud_sync_interval_minutes: number;
}
```

```ts
// src/pages/Settings.tsx
const defaultPreferences: UserPreferences = {
  // ...
  cloud_sync_auto: true,
  cloud_sync_interval_minutes: 10,
};
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src-tauri && cargo test cloud_sync_preferences_persist -- --nocapture`  
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src-tauri/src/models/config.rs \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/types/index.ts \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Settings.tsx
git commit -m "feat: add cloud sync auto preferences"
```

---

### Task 2: 新增云同步自动同步 UI（开关 + 下拉）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Settings.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/i18n/locales/zh.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/i18n/locales/en.ts`

**Step 1: Write the failing test**

新增纯函数用于生成间隔选项并测试（方便 TDD）：

```ts
// src/services/cloudSyncSettingsOptions.ts
export function buildCloudSyncIntervalOptions(minutes: number[]): number[] {
  return [...minutes];
}
```

测试：

```ts
// src/services/cloudSyncSettingsOptions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCloudSyncIntervalOptions } from "./cloudSyncSettingsOptions.ts";

test("buildCloudSyncIntervalOptions preserves order", () => {
  const options = buildCloudSyncIntervalOptions([5, 10, 30]);
  assert.deepEqual(options, [5, 10, 30]);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings && node --test --experimental-strip-types src/services/cloudSyncSettingsOptions.test.ts`  
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

创建 `cloudSyncSettingsOptions.ts` 并保持实现最简。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings && node --test --experimental-strip-types src/services/cloudSyncSettingsOptions.test.ts`  
Expected: PASS

**Step 5: Implement UI + 文案**

在 Settings “云同步”区域新增两行：
- `cloudSyncAuto` 开关（独立开关）
- `cloudSyncInterval` 下拉框（选项 5/10/15/30/60 分钟，默认 10）

下拉框在 `cloudSyncAuto` 关闭时置灰但保留值。

新增 i18n：
```ts
// zh.ts
cloudSyncAuto: "自动云同步",
cloudSyncAutoDesc: "定时将本地配置推送到云端",
cloudSyncInterval: "同步间隔",
cloudSyncIntervalDesc: "设置自动同步的时间间隔",
cloudSyncIntervalOption: "{minutes} 分钟",

// en.ts
cloudSyncAuto: "Auto Cloud Sync",
cloudSyncAutoDesc: "Periodically push local config to cloud",
cloudSyncInterval: "Sync interval",
cloudSyncIntervalDesc: "Set the interval for automatic sync",
cloudSyncIntervalOption: "{minutes} min",
```

**Step 6: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/services/cloudSyncSettingsOptions.ts \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/services/cloudSyncSettingsOptions.test.ts \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Settings.tsx \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/i18n/locales/zh.ts \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/i18n/locales/en.ts
git commit -m "feat: add cloud sync auto settings UI"
```

---

### Task 3: 云同步设置 Store 与动态调度

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/services/cloudSyncSettingsStore.ts`
- Create: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/services/cloudSyncSettingsStore.test.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/hooks/useCloudSyncAgent.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Settings.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Welcome.tsx`

**Step 1: Write the failing test**

```ts
// src/services/cloudSyncSettingsStore.test.ts
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  getCloudSyncSettingsSnapshot,
  setCloudSyncSettingsSnapshot,
  subscribeCloudSyncSettings,
} from "./cloudSyncSettingsStore.ts";

beforeEach(() => {
  setCloudSyncSettingsSnapshot({ auto: true, intervalMinutes: 10 });
});

test("cloud sync settings store notifies subscribers", () => {
  const seen: Array<{ auto: boolean; intervalMinutes: number }> = [];
  const unsubscribe = subscribeCloudSyncSettings((settings) => seen.push(settings));
  setCloudSyncSettingsSnapshot({ auto: false, intervalMinutes: 30 });
  assert.deepEqual(seen[seen.length - 1], { auto: false, intervalMinutes: 30 });
  unsubscribe();
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings && node --test --experimental-strip-types src/services/cloudSyncSettingsStore.test.ts`  
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
// src/services/cloudSyncSettingsStore.ts
export type CloudSyncSettings = { auto: boolean; intervalMinutes: number };
// get/set/subscribe（与 authProfileStore 相同模式）
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings && node --test --experimental-strip-types src/services/cloudSyncSettingsStore.test.ts`  
Expected: PASS

**Step 5: Wire store with Settings/Welcome**

- Settings 保存成功后调用 `setCloudSyncSettingsSnapshot`.
- Welcome 保存初始配置后同样更新 snapshot。

**Step 6: Update CloudSyncProvider scheduling**

- 启动时读取 `get_config` 初始化 snapshot。
- 订阅 snapshot，维护 `autoSyncEnabled` 与 `intervalMs`。
- 当 `auto` 关闭时清理定时器；开启或间隔变化时重建定时器。
- 保留“登录后执行一次 pull”的行为。

**Step 7: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/services/cloudSyncSettingsStore.ts \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/services/cloudSyncSettingsStore.test.ts \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/hooks/useCloudSyncAgent.tsx \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Settings.tsx \
  /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src/pages/Welcome.tsx
git commit -m "feat: sync auto settings store and scheduling"
```

---

### Task 4: 验证与回归检查

**Step 1: Run frontend store tests**

```bash
cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings
node --test --experimental-strip-types src/services/cloudSyncSettingsOptions.test.ts
node --test --experimental-strip-types src/services/cloudSyncSettingsStore.test.ts
```

**Step 2: Run Rust tests (spot-check)**

```bash
cd /Users/yjw/code/projects/skills-manager/.worktrees/cloud-sync-auto-settings/src-tauri
cargo test cloud_sync_preferences_persist -- --nocapture
```

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "test: verify cloud sync auto settings"
```
