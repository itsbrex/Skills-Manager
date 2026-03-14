# OAuth 登录接入（GitHub）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Skills Manager 客户端完成 GitHub OAuth 登录闭环与基础账号状态展示，Google 仅预留灰显入口。

**Architecture:** 后端 Tauri 命令层负责 PKCE 生成、调用 skills-market-api OAuth 端点与本地配置持久化；前端通过 invoke 调用命令并驱动 UI。登录回调通过自定义 URL Scheme 捕获并触发 exchange。

**Tech Stack:** Tauri 2 (Rust), React + TypeScript, reqwest, serde, 本地 config.json 持久化

---

### Task 1: OAuth 会话模型与配置持久化

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/mod.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src/types/index.ts`

**Step 1: Write the failing test**

在 `src-tauri/src/models/config.rs` 增加测试，验证 `auth_session` 能序列化/反序列化：

```rust
#[test]
fn auth_config_persists_session() {
    use crate::models::auth::{AuthProfile, AuthSession};
    let mut config = crate::models::AppConfig::default();
    config.auth_session = Some(AuthSession {
        provider: "github".to_string(),
        access_token: "a".to_string(),
        refresh_token: "r".to_string(),
        profile: AuthProfile {
            username: "octo".to_string(),
            avatar_url: Some("https://example.com/a.png".to_string()),
        },
    });
    let json = serde_json::to_string(&config).unwrap();
    let restored: crate::models::AppConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(restored.auth_session.unwrap().provider, "github");
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_config_persists_session -- --nocapture`
Expected: FAIL（`auth_session` 字段与模型尚未定义）

**Step 3: Write minimal implementation**

- 新增 `AuthProfile` / `AuthSession` 模型：

```rust
// src-tauri/src/models/auth.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthProfile {
    pub username: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub provider: String,
    pub access_token: String,
    pub refresh_token: String,
    pub profile: AuthProfile,
}
```

- `models/mod.rs` 导出 `auth` 模型。
- `models/config.rs` 在 `AppConfig` 中新增：

```rust
#[serde(default)]
pub auth_session: Option<AuthSession>,
```

并在 `Default` 实现中初始化为 `None`。
- `src/types/index.ts` 增加 `AuthProfile` / `AuthSession` 接口并扩展 `AppConfig`：

```ts
export interface AuthProfile {
  username: string;
  avatar_url?: string | null;
}

export interface AuthSession {
  provider: string;
  access_token: string;
  refresh_token: string;
  profile: AuthProfile;
}

export interface AppConfig {
  // ...
  auth_session?: AuthSession | null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_config_persists_session -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/models/auth.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/models/mod.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/models/config.rs \
  /Users/yjw/code/projects/skills-manager/src/types/index.ts

git commit -m "feat: add auth session model"
```

---

### Task 2: OAuth PKCE 生成与 Auth Start URL 构建

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/Cargo.toml`
- Create: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/mod.rs`

**Step 1: Write the failing test**

在 `services/auth.rs` 添加单测，验证 `build_auth_start_url` 生成的 query 包含 `state/code_challenge/nonce`：

```rust
#[test]
fn auth_start_url_contains_pkce_params() {
    let url = super::build_auth_start_url(
        "https://skills-market-api.guardssl.info/api/v1",
        "github",
        "s1",
        "cc1",
        "n1",
    )
    .unwrap();
    let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
    assert_eq!(query.get("state"), Some(&"s1".to_string()));
    assert_eq!(query.get("code_challenge"), Some(&"cc1".to_string()));
    assert_eq!(query.get("nonce"), Some(&"n1".to_string()));
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_start_url_contains_pkce_params -- --nocapture`
Expected: FAIL（auth 服务与函数尚未存在）

**Step 3: Write minimal implementation**

- Cargo.toml 添加依赖：

```toml
sha2 = "0.10"
```

- 新增 `services/auth.rs`，包含：
  - `generate_code_verifier()`：拼接两个 `Uuid::new_v4().simple()` 生成 64 位 verifier。
  - `pkce_challenge(verifier)`：`SHA256` + `base64::URL_SAFE_NO_PAD`。
  - `build_auth_start_url(base, provider, state, code_challenge, nonce)`：构造 `/auth/{provider}/start` URL。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_start_url_contains_pkce_params -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/Cargo.toml \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/services/auth.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/services/mod.rs

git commit -m "feat: add oauth pkce helpers"
```

---

### Task 3: OAuth 命令层与会话持久化

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/services/config_manager.rs`

**Step 1: Write the failing test**

在 `commands/auth.rs` 添加单测，验证 `save_auth_session` 写入配置后能被 `get_config` 读取：

```rust
#[test]
fn auth_session_persists_to_config() {
    use crate::services::ConfigManager;
    use crate::models::auth::{AuthProfile, AuthSession};
    crate::test_support::with_temp_home(|_| {
        let manager = ConfigManager::new();
        let mut config = manager.load().unwrap();
        config.auth_session = Some(AuthSession {
            provider: "github".to_string(),
            access_token: "a".to_string(),
            refresh_token: "r".to_string(),
            profile: AuthProfile {
                username: "octo".to_string(),
                avatar_url: None,
            },
        });
        manager.save(&config).unwrap();
        let restored = manager.load().unwrap();
        assert_eq!(restored.auth_session.unwrap().provider, "github");
    });
}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_session_persists_to_config -- --nocapture`
Expected: FAIL（auth 命令与模型尚未接入）

**Step 3: Write minimal implementation**

- 新增 `commands/auth.rs`：
  - `start_github_auth()`：生成 state/verifier/challenge/nonce，调用 `/auth/github/start`，返回 `auth_url`。
  - `exchange_github_auth(login_code, state)`：使用保存的 verifier/nonce 调用 `/auth/exchange`，拉取 `/auth/me`，并保存 `AuthSession` 到 config。
  - `get_auth_profile()`：读取 config 中 `auth_session`，若有则调用 `/auth/me`，失败时尝试 `/auth/refresh`。
  - `logout_auth()`：调用 `/auth/logout` 并清空 config 中的 `auth_session`。
- 将新命令加入 `commands/mod.rs` 与 `lib.rs` 的 `invoke_handler`。
- 在 `ConfigManager` 增加 `save(&AppConfig)` 公开方法（如已有则复用）。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test auth_session_persists_to_config -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/services/config_manager.rs

git commit -m "feat: add oauth commands and session persistence"
```

---

### Task 4: 前端接入与 UI 弹窗

**Files:**
- Create: `/Users/yjw/code/projects/skills-manager/src/services/auth.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx`
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/zh.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/i18n/locales/en.ts`

**Step 1: Write the failing test**

本任务使用手工验证作为 RED：
1) 左下角显示“登录”但点击无弹窗（现状）
2) 未登录态看不到 GitHub/Google 选择（现状）

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`
Expected: PASS（类型基线正常），随后手工验证失败场景成立。

**Step 3: Write minimal implementation**

- 新增 `services/auth.ts`：封装 `invoke` 调用 `start_github_auth / exchange_github_auth / get_auth_profile / logout_auth`。
- Sidebar：
  - 使用 `get_auth_profile` 初始化状态。
  - 增加登录入口点击，打开 Modal。
  - GitHub 登录按钮触发 `start_github_auth` 并使用 `openUrl`。
  - 监听深链回调（使用 `@tauri-apps/plugin-deep-link` 或 `tauri://open-url` 事件），解析 `login_code/state` 后调用 `exchange_github_auth`。
  - 登录成功后更新头像+用户名；退出则清空。
- i18n：新增登录、退出、按钮文案与“即将支持”。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`
Expected: PASS；手工验证登录弹窗与状态切换正确。

**Step 5: Commit**

```bash
git add /Users/yjw/code/projects/skills-manager/src/services/auth.ts \
  /Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx \
  /Users/yjw/code/projects/skills-manager/src/i18n/locales/zh.ts \
  /Users/yjw/code/projects/skills-manager/src/i18n/locales/en.ts

git commit -m "feat: add oauth login ui"
```

---

### Task 5: 全量验证

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
git commit -m "test: stabilize oauth login"
```
