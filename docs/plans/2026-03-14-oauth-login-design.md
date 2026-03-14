# OAuth 登录接入（GitHub）设计

## 目标

- 在 Skills Manager 客户端增加 OAuth 登录入口。
- GitHub 实接入，Google 仅预留 UI（灰显）。
- 登录成功后左下角显示头像 + 用户名，弹窗展示账号信息与退出入口。

## 范围

- 左下角登录入口与弹窗交互。
- OAuth PKCE 登录流程（start / exchange / refresh / logout / me）。
- 基础登录状态管理（启动检查、退出清理、错误重试）。

## 非目标

- 云同步引擎与冲突处理 UI。
- Google 实际登录能力。
- 多设备管理与后台同步。

## UI / 交互

- 左下角区块替换为可点击登录入口。
- 未登录：显示“登录”字样 + 头像占位。
- 登录后：显示头像 + 用户名。
- 点击后弹出居中 Modal：
  - 未登录态：显示 GitHub 登录按钮（可点），Google 登录按钮（灰显）。
  - 已登录态：显示账号信息（头像、用户名、来源）与“退出登录”。

## 认证流程与数据流

1. 前端触发 `start_github_auth` 命令，后端生成 `state / code_verifier / code_challenge / nonce`，调用 `GET /api/v1/auth/github/start` 获取 `auth_url`。
2. 前端使用系统浏览器打开 `auth_url`。
3. OAuth 回调到 `skills-manager://auth/callback?login_code=...&state=...`，应用捕获后触发 `exchange_github_auth`。
4. 后端携带 `login_code + code_verifier + nonce` 调用 `POST /api/v1/auth/exchange`，获得 `access_token / refresh_token`。
5. 后端调用 `GET /api/v1/auth/me` 拉取头像与用户名，返回给前端。

## 存储策略

- MVP 阶段将 `access_token / refresh_token / provider` 持久化到本地配置（与现有 `github_token` 类似），后续可迁移到安全存储（Keychain/Stronghold）。

## API 端点

- `GET /api/v1/auth/github/start`
- `POST /api/v1/auth/exchange`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## 错误处理

- 登录失败（网络/401/422）提示用户并允许重试。
- `me` 失败时触发 `refresh`，仍失败则退出登录并回到未登录态。

## 测试

- Rust 侧：PKCE/state 生成与缓存、登录状态序列化。
- 前端：手动验证登录弹窗、按钮状态、回调成功、退出登录。
