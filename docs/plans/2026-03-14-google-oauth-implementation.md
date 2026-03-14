# Google OAuth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 skills-market-api 打通 Google OAuth API，并在 skills-manager 中启用 Google 登录按钮完成完整登录闭环。

**Architecture:** 后端复用现有 `/api/v1/auth/:provider/*` PKCE 流程，通过 Google token + userinfo 获取 profile 并签发自有 access/refresh token；客户端新增 Google 登录命令与 UI 入口，回调后完成 exchange 与状态更新。

**Tech Stack:** Cloudflare Workers (Hono) + D1 + Vitest；Tauri 2 (Rust) + React + TypeScript

---

### Task 1: skills-market-api 增加 Google start 覆盖

**Files:**
- Modify: `/Users/yjw/code/projects/skills-market-api/test/auth.test.ts`

**Step 1: Write the failing test**

在 `test/auth.test.ts` 的 auth exchange describe 中新增：

```ts
it('GET /api/v1/auth/google/start returns auth_url with state and code_challenge', async () => {
  const res = await SELF.fetch(
    'https://example.com/api/v1/auth/google/start?state=gs1&code_challenge=gcc1&nonce=gn1'
  );
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.auth_url).toContain('state=gs1');
  expect(data.auth_url).toContain('code_challenge=gcc1');
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-market-api && npx vitest run test/auth.test.ts`
Expected: FAIL（Google client 配置未注入，返回 INVALID_PROVIDER）

**Step 3: Write minimal implementation**

在测试文件顶部补齐 Google 测试环境变量（与 GitHub 同风格）：

```ts
testEnv.GOOGLE_CLIENT_ID = testEnv.GOOGLE_CLIENT_ID ?? 'test-google-client';
testEnv.GOOGLE_CLIENT_SECRET = testEnv.GOOGLE_CLIENT_SECRET ?? 'test-google-secret';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'test-google-client';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 'test-google-secret';
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-market-api && npx vitest run test/auth.test.ts`
Expected: PASS（该用例通过）

**Step 5: Commit**

```bash
git -C /Users/yjw/code/projects/skills-market-api add /Users/yjw/code/projects/skills-market-api/test/auth.test.ts
git -C /Users/yjw/code/projects/skills-market-api commit -m "test: add google auth start coverage"
```

---

### Task 2: skills-market-api 增加 Google exchange + userinfo 覆盖

**Files:**
- Modify: `/Users/yjw/code/projects/skills-market-api/test/auth.test.ts`

**Step 1: Write the failing test**

在 `test/auth.test.ts` 的 auth exchange describe 中新增：

```ts
it('POST /api/v1/auth/exchange creates google identity from userinfo', async () => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'g-token', token_type: 'bearer' });
    }
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return jsonResponse({ sub: 'g123', email: 'g@example.com', picture: 'https://g-img', name: 'GUser' });
    }
    return jsonResponse({ error: 'unexpected fetch' }, 500);
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + 3600;
  const verifier = 'g-verifier';
  const challenge = await pkceChallenge(verifier);
  await testEnv.DB
    .prepare(
      `INSERT INTO auth_login_codes (login_code, provider, auth_code, state, code_challenge, nonce, created_at, expires_at)
       VALUES ('gcode1', 'google', 'authcode', 'gs1', ?1, 'gn1', ?2, ?3)`
    )
    .bind(challenge, nowSec, expiresAt)
    .run();

  const res = await SELF.fetch('https://example.com/api/v1/auth/exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login_code: 'gcode1', code_verifier: verifier, nonce: 'gn1' })
  });

  expect(res.status).toBe(200);
  const identity = await testEnv.DB
    .prepare('SELECT provider, provider_user_id, email FROM identities LIMIT 1')
    .first<{ provider: string; provider_user_id: string; email: string }>();
  expect(identity?.provider).toBe('google');
  expect(identity?.provider_user_id).toBe('g123');
  expect(identity?.email).toBe('g@example.com');
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-market-api && npx vitest run test/auth.test.ts`
Expected: FAIL（尚未 stub Google 端点 / 或 mock 覆盖不完整）

**Step 3: Write minimal implementation**

如测试仍失败，补齐缺失的 Google fetch stub 或确保测试前已设置 `GOOGLE_CLIENT_ID/SECRET`（来自 Task 1）。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-market-api && npx vitest run test/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git -C /Users/yjw/code/projects/skills-market-api add /Users/yjw/code/projects/skills-market-api/test/auth.test.ts
git -C /Users/yjw/code/projects/skills-market-api commit -m "test: add google oauth exchange coverage"
```

---

### Task 3: skills-manager Tauri 命令新增 Google OAuth

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs`
- Modify: `/Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs`

**Step 1: Write the failing tests**

在 `src-tauri/src/commands/auth.rs` 的 tests 模块新增：

```rust
#[test]
fn start_google_auth_returns_state_and_stores_pending() {
    crate::test_support::with_temp_home(|_| {
        let mut server = mockito::Server::new();
        std::env::set_var(
            "SKILLS_MARKET_API_BASE",
            format!("{}/api/v1", server.url()),
        );
        let _mock = server
            .mock("GET", "/api/v1/auth/google/start")
            .match_query(Matcher::Any)
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"auth_url":"https://example.com/google"}"#)
            .create();

        tauri::async_runtime::block_on(async {
            let result = start_google_auth(Some(true)).await.expect("start google auth");
            assert_eq!(result.auth_url, "https://example.com/google");
            assert!(result.state.starts_with("debug-"));
            assert!(has_pending_state(&result.state));
        });
    });
}

#[test]
fn exchange_google_auth_saves_session_and_returns_profile() {
    crate::test_support::with_temp_home(|_| {
        let mut server = mockito::Server::new();
        std::env::set_var(
            "SKILLS_MARKET_API_BASE",
            format!("{}/api/v1", server.url()),
        );

        let _exchange_mock = server
            .mock("POST", "/api/v1/auth/exchange")
            .match_header("content-type", "application/json")
            .match_body(Matcher::Json(serde_json::json!({
                "login_code": "gcode1",
                "code_verifier": "verifier",
                "nonce": "nonce",
            })))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"access_token":"gat1","refresh_token":"grt1","access_expires_at":1,"refresh_expires_at":2}"#,
            )
            .create();

        let _me_mock = server
            .mock("GET", "/api/v1/auth/me")
            .match_header("authorization", "Bearer gat1")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"user_id":"u2","provider":"google","username":"guser","avatar_url":"https://img","email":"g@example.com"}"#,
            )
            .create();

        set_pending_state("gs1", "verifier", "nonce");

        tauri::async_runtime::block_on(async {
            let profile = exchange_google_auth("gcode1".to_string(), "gs1".to_string())
                .await
                .expect("exchange google auth");
            assert_eq!(profile.user_id, "u2");
            assert_eq!(profile.username.as_deref(), Some("guser"));
        });

        let restored = ConfigManager::new().load().unwrap();
        let session = restored.auth_session.expect("auth session saved");
        assert_eq!(session.provider, "google");
        assert_eq!(session.access_token, "gat1");
        assert_eq!(session.refresh_token, "grt1");
        assert_eq!(session.profile.username, "guser");
    });
}
```

**Step 2: Run test to verify it fails**

Run:
1. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test start_google_auth_returns_state_and_stores_pending -- --nocapture`
2. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test exchange_google_auth_saves_session_and_returns_profile -- --nocapture`
Expected: FAIL（命令未实现/未注册）

**Step 3: Write minimal implementation**

在 `src-tauri/src/commands/auth.rs` 中新增通用 helper，并为 GitHub/Google 分别调用，确保 google 走 `/auth/google/start`：

```rust
async fn start_oauth_auth(provider: &str, debug: Option<bool>) -> Result<AuthStartResult, String> {
    let state = if debug.unwrap_or(false) {
        format!("debug-{}", Uuid::new_v4().simple())
    } else {
        Uuid::new_v4().simple().to_string()
    };
    let code_verifier = generate_code_verifier();
    let code_challenge = pkce_challenge(&code_verifier);
    let nonce = Uuid::new_v4().simple().to_string();
    let base_url = auth_api_base_url();
    let url = build_auth_start_url(&base_url, provider, &state, &code_challenge, &nonce)?;

    let client = Client::new();
    let response = client
        .get(url)
        .header(ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to start auth: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Auth start failed: HTTP {}", response.status()));
    }

    let payload = response
        .json::<AuthStartResponse>()
        .await
        .map_err(|e| format!("Failed to parse auth start response: {e}"))?;

    store_pending_state(state.clone(), code_verifier, nonce);

    Ok(AuthStartResult {
        auth_url: payload.auth_url,
        state,
    })
}

#[tauri::command]
pub async fn start_github_auth(debug: Option<bool>) -> Result<AuthStartResult, String> {
    start_oauth_auth("github", debug).await
}

#[tauri::command]
pub async fn start_google_auth(debug: Option<bool>) -> Result<AuthStartResult, String> {
    start_oauth_auth("google", debug).await
}

#[tauri::command]
pub async fn exchange_google_auth(login_code: String, state: String) -> Result<AuthMeResponse, String> {
    exchange_github_auth(login_code, state).await
}
```

注册命令：
- `src-tauri/src/commands/mod.rs` 导出 `start_google_auth` / `exchange_google_auth`
- `src-tauri/src/lib.rs` 加入 `invoke_handler`

**Step 4: Run test to verify it passes**

Run:
1. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test start_google_auth_returns_state_and_stores_pending -- --nocapture`
2. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test exchange_google_auth_saves_session_and_returns_profile -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git -C /Users/yjw/code/projects/skills-manager add \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/commands/mod.rs \
  /Users/yjw/code/projects/skills-manager/src-tauri/src/lib.rs

git -C /Users/yjw/code/projects/skills-manager commit -m "feat: add google oauth commands"
```

---

### Task 4: skills-manager 前端接入 Google 登录

**Files:**
- Modify: `/Users/yjw/code/projects/skills-manager/src/services/auth.ts`
- Modify: `/Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx`

**Step 1: Confirm frontend test exception**

确认可使用手工验证替代自动化测试（当前无测试框架）。

**Step 2: Write the failing test**

无现有前端测试框架，使用手工验证作为 RED：
1) Google 按钮点击后无跳转（现状）
2) 回调后仍显示未登录（现状）

**Step 3: Write minimal implementation**

- `src/services/auth.ts` 增加：

```ts
export async function startGoogleAuth(): Promise<AuthStartResult> {
  return invoke<AuthStartResult>('start_google_auth', { debug: import.meta.env.DEV });
}

export async function exchangeGoogleAuth(loginCode: string, state: string): Promise<AuthMeResponse> {
  return invoke<AuthMeResponse>('exchange_google_auth', { loginCode, state });
}
```

- `Sidebar.tsx`：
  - 增加 `pendingProvider` 状态（'github' | 'google' | null）。
  - `handleStartGoogleAuth` 调用 `startGoogleAuth()`，成功后 `openUrl`，并设置 `pendingProvider = 'google'`。
  - `handleAuthCallback` 根据 `pendingProvider` 选择 `exchangeGoogleAuth`，缺省回退到 `exchangeGithubAuth`。
  - Google 按钮去掉 `disabled` 与 “comingSoon” 文案。

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`
Expected: PASS；手工验证 Google 登录流程可用。

**Step 5: Commit**

```bash
git -C /Users/yjw/code/projects/skills-manager add \
  /Users/yjw/code/projects/skills-manager/src/services/auth.ts \
  /Users/yjw/code/projects/skills-manager/src/components/layout/Sidebar.tsx

git -C /Users/yjw/code/projects/skills-manager commit -m "feat: enable google oauth login"
```

---

### Task 5: Full verification

**Files:**
- Test: `/Users/yjw/code/projects/skills-market-api/test/auth.test.ts`
- Test: `/Users/yjw/code/projects/skills-manager/src-tauri/src/commands/auth.rs`
- Test: `/Users/yjw/code/projects/skills-manager/src/**`

**Step 1: Run full test suite**

Run:
1. `cd /Users/yjw/code/projects/skills-market-api && npx vitest run test/auth.test.ts`
2. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test start_google_auth_returns_state_and_stores_pending -- --nocapture`
3. `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test exchange_google_auth_saves_session_and_returns_profile -- --nocapture`
3. `cd /Users/yjw/code/projects/skills-manager && npm run build`

Expected: 全部 PASS。

**Step 2: Commit (if any adjustments)**

```bash
git -C /Users/yjw/code/projects/skills-market-api add -A
git -C /Users/yjw/code/projects/skills-market-api commit -m "test: stabilize google oauth"

git -C /Users/yjw/code/projects/skills-manager add -A
git -C /Users/yjw/code/projects/skills-manager commit -m "test: stabilize google oauth"
```
