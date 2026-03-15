# Cloud Sync Client Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Skills Manager 客户端完成云同步闭环：在本地配置中持久化 OAuth token（明文）、构建/应用同步 payload、自动同步与冲突处理。

**Architecture:** 客户端通过 Tauri 命令调用 skills-market-api 的 `/auth/*` 与 `/sync/*` 接口；OAuth token 存入本地 `config.json`（明文持久化）；同步 payload 由本地配置 + skills 扫描生成，并在本地保存 revision/hash 用于去抖与冲突检测。

**Tech Stack:** Tauri 2 (Rust), React + TypeScript, reqwest, serde, mockito

相关技能：@superpowers:executing-plans @superpowers:verification-before-completion

---

### Task 1: 云同步状态模型与配置持久化

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/cloud_sync.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/mod.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src/types/index.ts`

**Step 1: Write the failing test**

在 `src-tauri/src/models/config.rs` 的 tests 模块新增：

```rust
#[test]
fn cloud_sync_state_persists() {
    let config = AppConfig::default();
    let device_id = config
        .cloud_sync
        .as_ref()
        .expect("cloud sync state")
        .device_id
        .clone();
    let json = serde_json::to_string(&config).unwrap();
    let restored: AppConfig = serde_json::from_str(&json).unwrap();
    let state = restored.cloud_sync.expect("cloud sync restored");
    assert_eq!(state.device_id, device_id);
    assert_eq!(state.last_revision, 0);
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test cloud_sync_state_persists -- --nocapture`

Expected: FAIL（`cloud_sync` 字段与模型不存在）

**Step 3: Write minimal implementation**

新增云同步模型与配置字段：

```rust
// src-tauri/src/models/cloud_sync.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncState {
    pub device_id: String,
    pub last_revision: i64,
    #[serde(default)]
    pub last_synced_at: Option<i64>,
    #[serde(default)]
    pub last_payload_hash: Option<String>,
}

impl CloudSyncState {
    pub fn new() -> Self {
        Self {
            device_id: uuid::Uuid::new_v4().simple().to_string(),
            last_revision: 0,
            last_synced_at: None,
            last_payload_hash: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncSkill {
    pub id: String,
    pub name: String,
    pub source: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncToolState {
    pub enabled: bool,
    pub enabled_skills: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncCustomTool {
    pub id: String,
    pub name: String,
    pub config_path: String,
    pub skills_path: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncPayload {
    pub version: u8,
    pub updated_at: i64,
    pub device_id: String,
    pub skills: Vec<CloudSyncSkill>,
    pub tool_states: HashMap<String, CloudSyncToolState>,
    pub custom_tools: Vec<CloudSyncCustomTool>,
}
```

```rust
// src-tauri/src/models/mod.rs
pub mod cloud_sync;
```

```rust
// src-tauri/src/models/config.rs
use crate::models::cloud_sync::CloudSyncState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    // ...
    #[serde(default)]
    pub cloud_sync: Option<CloudSyncState>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            // ...
            cloud_sync: Some(CloudSyncState::new()),
        }
    }
}
```

```ts
// src/types/index.ts
export interface CloudSyncState {
  device_id: string;
  last_revision: number;
  last_synced_at?: number | null;
  last_payload_hash?: string | null;
}

export interface AppConfig {
  // ...
  cloud_sync?: CloudSyncState | null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test cloud_sync_state_persists -- --nocapture`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/models/cloud_sync.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/models/mod.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs \
  /Users/yjw/code/projects/skills-manager/src/types/index.ts

git commit -m "feat: add cloud sync state model"
```

---

### Task 2: OAuth token 配置存储（明文）

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src/types/index.ts`

**Step 1: Write the failing test**

在 `src-tauri/src/commands/auth.rs` tests 模块新增：

```rust
#[test]
fn auth_tokens_persist_to_config() {
    crate::test_support::with_temp_home(|_| {
        let session = AuthSession {
            provider: "github".to_string(),
            access_token: Some("at".to_string()),
            refresh_token: Some("rt".to_string()),
            profile: AuthProfile {
                username: "octo".to_string(),
                avatar_url: None,
            },
        };
        super::save_auth_session(session).expect("save auth session");

        let restored = ConfigManager::new().load().unwrap();
        let stored = restored.auth_session.expect("auth session exists");
        assert_eq!(stored.access_token.as_deref(), Some("at"));
        assert_eq!(stored.refresh_token.as_deref(), Some("rt"));
    });
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_tokens_persist_to_config -- --nocapture`

Expected: FAIL（token 尚未持久化到 config）

**Step 3: Write minimal implementation**

1) 更新模型与保存逻辑：

```rust
// src-tauri/src/models/auth.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub provider: String,
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    pub profile: AuthProfile,
}
```

```rust
// src-tauri/src/commands/auth.rs (save_auth_session)
pub fn save_auth_session(session: AuthSession) -> Result<(), String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.auth_session = Some(session);
    manager.save(&config)
}
```

2) `src-tauri/src/commands/auth.rs` 的 `get_auth_profile` / `logout_auth` / `exchange_*` 改为从 `config.auth_session` 读取/持久化 token（不使用安全存储）。

3) `src/types/index.ts` 更新 `AuthSession`：

```ts
export interface AuthSession {
  provider: string;
  access_token?: string | null;
  refresh_token?: string | null;
  profile: AuthProfile;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_tokens_persist_to_config -- --nocapture`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/models/auth.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs \
  /Users/yjw/code/projects/skills-manager/src/types/index.ts

git commit -m "feat: store auth tokens in config"
```

---

### Task 3: 云同步 payload 构建

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/cloud_sync.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/mod.rs`

**Step 1: Write the failing test**

在 `src-tauri/src/services/cloud_sync.rs` 新增测试：

```rust
#[test]
fn build_payload_includes_enabled_skills_and_custom_tools() {
    let mut config = AppConfig::default();
    config.tools.insert(
        "codex".to_string(),
        ToolConfig {
            enabled: true,
            detected: true,
            skills_path: std::path::PathBuf::from("/tmp/codex/skills"),
            config_path: std::path::PathBuf::from("/tmp/codex/config"),
        },
    );
    config.custom_tools.insert(
        "custom1".to_string(),
        CustomToolConfig {
            name: "My Tool".to_string(),
            config_path: std::path::PathBuf::from("/tmp/custom/config"),
            skills_path: std::path::PathBuf::from("/tmp/custom/skills"),
            enabled: true,
            icon_path: None,
        },
    );

    let mut skill = Skill::new("s1".to_string(), "Skill 1".to_string(), "/tmp/s1".into());
    skill.enabled.insert("codex".to_string(), true);
    let payload = super::build_payload(&config, &[skill]);

    assert_eq!(payload.device_id, config.cloud_sync.as_ref().unwrap().device_id);
    assert_eq!(payload.tool_states["codex"].enabled_skills, vec!["s1".to_string()]);
    assert_eq!(payload.custom_tools.len(), 1);
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test build_payload_includes_enabled_skills_and_custom_tools -- --nocapture`

Expected: FAIL（`cloud_sync` 服务与 `build_payload` 未实现）

**Step 3: Write minimal implementation**

```rust
// src-tauri/src/services/cloud_sync.rs
use crate::models::cloud_sync::{CloudSyncCustomTool, CloudSyncPayload, CloudSyncSkill, CloudSyncToolState};
use crate::models::{AppConfig, CustomToolConfig, Skill, SkillSource};
use std::collections::HashMap;

pub fn build_payload(config: &AppConfig, skills: &[Skill]) -> CloudSyncPayload {
    let device_id = config.cloud_sync.as_ref().map(|s| s.device_id.clone()).unwrap_or_default();
    let mut tool_states: HashMap<String, CloudSyncToolState> = HashMap::new();

    for (tool_id, tool_config) in config.collect_tool_configs() {
        let enabled_skills: Vec<String> = skills
            .iter()
            .filter(|skill| skill.is_enabled_for(&tool_id))
            .map(|skill| skill.id.clone())
            .collect();
        tool_states.insert(
            tool_id,
            CloudSyncToolState {
                enabled: tool_config.enabled,
                enabled_skills,
            },
        );
    }

    let custom_tools = config
        .custom_tools
        .iter()
        .map(|(id, tool)| CloudSyncCustomTool {
            id: id.clone(),
            name: tool.name.clone(),
            config_path: tool.config_path.to_string_lossy().into_owned(),
            skills_path: tool.skills_path.to_string_lossy().into_owned(),
            enabled: tool.enabled,
        })
        .collect();

    let skills_payload = skills
        .iter()
        .map(|skill| CloudSyncSkill {
            id: skill.id.clone(),
            name: skill.name.clone(),
            source: match skill.source {
                SkillSource::Local => "local".to_string(),
                SkillSource::Imported => "imported".to_string(),
            },
            version: skill.version.clone(),
        })
        .collect();

    CloudSyncPayload {
        version: 1,
        updated_at: chrono::Utc::now().timestamp(),
        device_id,
        skills: skills_payload,
        tool_states,
        custom_tools,
    }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test build_payload_includes_enabled_skills_and_custom_tools -- --nocapture`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/services/cloud_sync.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/services/mod.rs

git commit -m "feat: add cloud sync payload builder"
```

---

### Task 4: 云同步 API 客户端与命令

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/cloud_sync.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/cloud_sync.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src/types/index.ts`

**Step 1: Write the failing test**

在 `src-tauri/src/commands/cloud_sync.rs` 新增测试：

```rust
#[test]
fn cloud_sync_push_returns_conflict_payload() {
    crate::test_support::with_temp_home(|_| {
        let mut server = mockito::Server::new();
        std::env::set_var(
            "SKILLS_MARKET_API_BASE",
            format!("{}/api/v1", server.url()),
        );

        let _mock = server
            .mock("POST", "/api/v1/sync/push")
            .with_status(409)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"error":{"code":"SYNC_CONFLICT","message":"conflict"},"revision":2,"payload":{"version":1,"updated_at":1,"device_id":"d1","skills":[],"tool_states":{},"custom_tools":[]}}"#,
            )
            .create();

        let manager = ConfigManager::new();
        let mut config = manager.load().unwrap();
        config.auth_session = Some(AuthSession {
            provider: "github".to_string(),
            access_token: Some("at".to_string()),
            refresh_token: Some("rt".to_string()),
            profile: AuthProfile {
                username: "octo".to_string(),
                avatar_url: None,
            },
        });
        manager.save(&config).unwrap();

        tauri::async_runtime::block_on(async {
            let result = cloud_sync_push().await.expect("push");
            match result {
                CloudSyncPushResult::Conflict { revision, payload } => {
                    assert_eq!(revision, 2);
                    assert_eq!(payload.device_id, "d1");
                }
                _ => panic!("expected conflict"),
            }
        });
    });
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test cloud_sync_push_returns_conflict_payload -- --nocapture`

Expected: FAIL（命令与服务未实现）

**Step 3: Write minimal implementation**

1) 在 `src-tauri/src/services/cloud_sync.rs` 增加 HTTP 客户端：

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncSnapshot {
    pub revision: i64,
    pub payload: Option<CloudSyncPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum CloudSyncPushResult {
    Synced { revision: i64 },
    Skipped { reason: String },
    Conflict { revision: i64, payload: CloudSyncPayload },
}

pub async fn sync_pull(base_url: &str, access_token: &str) -> Result<CloudSyncSnapshot, String> { /* ... */ }
pub async fn sync_push(
    base_url: &str,
    access_token: &str,
    base_revision: i64,
    payload: &CloudSyncPayload,
    request_id: &str,
) -> Result<CloudSyncPushResult, String> { /* ... */ }
pub async fn sync_resolve(
    base_url: &str,
    access_token: &str,
    payload: &CloudSyncPayload,
) -> Result<i64, String> { /* ... */ }
```

2) 新增命令（含刷新 token 逻辑与本地 revision 更新）：

```rust
// src-tauri/src/commands/cloud_sync.rs
use crate::models::cloud_sync::CloudSyncPayload;
use crate::services::cloud_sync::{build_payload, sync_pull, sync_push, sync_resolve, CloudSyncPushResult};
use crate::services::{ConfigManager, ScannerService};

#[tauri::command]
pub async fn cloud_sync_pull() -> Result<CloudSyncSnapshot, String> { /* 使用 config.auth_session + sync_pull */ }

#[tauri::command]
pub async fn cloud_sync_push() -> Result<CloudSyncPushResult, String> { /* 计算 hash 去抖 */ }

#[tauri::command]
pub async fn cloud_sync_resolve(payload: CloudSyncPayload) -> Result<i64, String> { /* 强制覆盖 */ }
```

3) `commands/mod.rs` 与 `lib.rs` 注册命令；`types/index.ts` 增加 `CloudSyncPushResult` 联合类型。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test cloud_sync_push_returns_conflict_payload -- --nocapture`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/cloud_sync.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/services/cloud_sync.rs \
  /Users/yjw/code/projects/skills-manager/src/types/index.ts

git commit -m "feat: add cloud sync commands"
```

---

### Task 5: 前端同步代理 + 账号/云同步 UI + 冲突处理

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/src/services/cloudSync.ts`
- Create: `/Users/yjw/code/projects/skills-manager/src/hooks/useCloudSyncAgent.ts`
- Create: `/Users/yjw/code/projects/skills-manager/src/components/cloud/CloudSyncConflictDialog.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src/App.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src/pages/Settings.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/zh.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/en.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/types/index.ts`

**Step 1: Write the failing test**

前端无现成测试框架，使用手工验证作为 RED：
1) 设置页无账号/云同步区块（现状）
2) 登录后无自动 pull/push（现状）
3) 冲突响应没有 UI（现状）

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`

Expected: PASS（类型基线正常），手工验证失败场景成立。

**Step 3: Write minimal implementation**

1) `cloudSync.ts`（封装 Tauri commands）：

```ts
import { invoke } from "@tauri-apps/api/core";
import type { CloudSyncPushResult, CloudSyncSnapshot, CloudSyncPayload } from "@/types";

export async function cloudSyncPull(): Promise<CloudSyncSnapshot> {
  return invoke("cloud_sync_pull");
}

export async function cloudSyncPush(): Promise<CloudSyncPushResult> {
  return invoke("cloud_sync_push");
}

export async function cloudSyncResolve(payload: CloudSyncPayload): Promise<number> {
  return invoke("cloud_sync_resolve", { payload });
}
```

2) `useCloudSyncAgent`：登录态时执行 `pull`，并用 `setInterval` 每 30s 调 `cloudSyncPush()`，遇到 `Conflict` 时打开冲突对话框。

3) `Settings.tsx` 增加“账号/云同步”区块：显示登录状态、最后同步时间、手动“立即同步”按钮。

4) `CloudSyncConflictDialog`：展示“本地覆盖 / 采用云端”按钮；选择本地则调用 `cloudSyncResolve(localPayload)`，选择云端则调用 `cloudSyncPull()` 再应用远端 payload。

5) i18n 增加文本：`settings.account`, `settings.cloudSync`, `cloudSync.*` 等。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`

Expected: PASS；手工验证登录后自动拉取/推送、冲突弹窗与手动同步正常。

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src/services/cloudSync.ts \
  /Users/yjw/code/projects/skills-manager/src/hooks/useCloudSyncAgent.ts \
  /Users/yjw/code/projects/skills-manager/src/components/cloud/CloudSyncConflictDialog.tsx \
  /Users/yjw/code/projects/skills-manager/src/App.tsx \
  /Users/yjw/code/projects/skills-manager/src/pages/Settings.tsx \
  /Users/yjw/code/projects/skills-manager/src/i18n/locales/zh.ts \
  /Users/yjw/code/projects/skills-manager/src/i18n/locales/en.ts \
  /Users/yjw/code/projects/skills-manager/src/types/index.ts

git commit -m "feat: add cloud sync ui and agent"
```

---

### Task 6: 全量验证

**Files:**
- Test: `/Users/yjw/code/projects/skills-manager/src-tauri/src/**`
- Test: `/Users/yjw/code/projects/skills-manager/src/**`

**Step 1: Run full test suite**

Run:
1. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test`
2. `cd /Users/yjw/code/projects/skills-manager && npm run build`

Expected: 全部 PASS。

**Step 2: Commit (if any adjustments)**

```bash
git add -A
git commit -m "test: stabilize cloud sync client"
```
