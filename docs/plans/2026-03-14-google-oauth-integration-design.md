# Google OAuth 接入设计（最小参数）

## 目标

- 在 skills-market-api 增加 Google OAuth 能力，与 GitHub 现有流程对齐。
- 在 skills-manager 中将 Google 登录按钮改为可用并完成完整登录闭环。
- 继续使用 PKCE + state + nonce，回调到 `skills-manager://auth/callback`。

## 范围

- 后端 `/api/v1/auth/:provider/*` 体系内新增 Google 支持与测试覆盖。
- 客户端 Tauri 命令与前端 UI 接入 Google 登录流程。

## 非目标

- 获取/使用 Google refresh_token（不添加 `access_type=offline` / `prompt=consent`）。
- 云同步引擎与冲突处理。

## 认证流程

1. 客户端生成 `state/code_verifier/code_challenge/nonce`。
2. 调用 `/api/v1/auth/google/start` 获取授权 URL。
3. 系统浏览器完成授权，Google 回调 `/api/v1/auth/google/callback`。
4. 服务端生成 `login_code` 并重定向到 `skills-manager://auth/callback`。
5. 客户端调用 `/api/v1/auth/exchange`，服务端校验 PKCE/nonce 并完成 token 交换。
6. 服务端调用 Google userinfo 获取 profile，创建/更新 identity，签发自有 access/refresh token。
7. 客户端调用 `/api/v1/auth/me` 拉取头像与用户名。

## 后端改动（skills-market-api）

- 复用 `resolveOAuthProvider` 中的 Google 配置（最小参数：`client_id/redirect_uri/response_type/scope/state/code_challenge/nonce`）。
- 补齐 Google 的测试用例：`google/start`、`google/callback`、`exchange` 走 Google token + userinfo。
- mock `https://oauth2.googleapis.com/token` 与 `https://openidconnect.googleapis.com/v1/userinfo`。

## 客户端改动（skills-manager）

- Tauri 命令层新增 `start_google_auth` 与 `exchange_google_auth`（或复用通用方法）。
- 前端 `services/auth.ts` 增加 `startGoogleAuth` / `exchangeGoogleAuth`。
- Sidebar：Google 按钮改为可点击，点击后 `openUrl(auth_url)`；回调解析后调用 Google exchange；成功后更新 UI。

## 错误处理

- 与 GitHub 相同：start/exchange/me/refresh/logout 失败均提示可重试。

## 测试

- skills-market-api：Vitest 增加 Google OAuth 流程测试。
- skills-manager：手工验证深链回调与 UI 状态切换。

## 配置

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 由 Google Cloud Console 获取。
- `Authorized redirect URIs` 包含：
  - `https://<API域名>/api/v1/auth/google/callback`
  - `http://localhost:8787/api/v1/auth/google/callback`
