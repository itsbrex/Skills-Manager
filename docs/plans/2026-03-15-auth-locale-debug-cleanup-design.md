# OAuth 登录中间页多语言与调试清理设计

## 目标

- 登录回调中间页根据客户端传入的 `locale` 展示对应语言文案，未传时默认 `en`。
- 移除 Skills Manager 客户端内的 OAuth 调试 UI 与 auth-debug 日志相关代码。
- 保留 `state` 前缀为 `debug-` 的 JSON 分支，用于必要调试。

## 范围

- `skills-market-api` 的 `/api/v1/auth/:provider/start` 与 `/api/v1/auth/:provider/callback`。
- `skills-manager` 客户端 OAuth 登录流程参数与 Sidebar 调试区块。
- 相关测试更新。

## 非目标

- 改动 OAuth 基础流程、PKCE/nonce 校验逻辑。
- 引入新的语言体系或 i18n 框架。

## 方案概述

- 客户端在 `start_*_auth` 时携带 `locale` 参数到 `skills-market-api`。
- API 将 `locale` 存入 `auth_states`，回调页读取并渲染对应语言文案。
- `locale` 非法或缺失时回退 `en`。
- 保留 `state` 以 `debug-` 开头时的 JSON 返回逻辑。
- Skills Manager 移除“OAuth 回调调试（临时）”面板、测试按钮与 auth-debug 日志写入。

## 数据流

1. 客户端发起 `start_github_auth` / `start_google_auth`，传递 `locale`。
2. API `/auth/start` 写入 `auth_states(locale)` 并返回第三方 `auth_url`。
3. OAuth 回调 `/auth/callback` 读取 `auth_states.locale`，渲染中间页 HTML。
4. 用户点击按钮唤起应用完成登录；`debug-` state 仍返回 JSON。

## 数据与迁移

- `auth_states` 新增可空列 `locale`。
- 旧数据无 `locale` 时，回调页默认 `en`。

## 服务端改动（skills-market-api）

- `GET /api/v1/auth/:provider/start`：
  - 读取 `locale` query，落库到 `auth_states.locale`。
  - 使用 `DEFAULT_AUTH_LOCALE = 'en'` 作为默认值。
- `GET /api/v1/auth/:provider/callback`：
  - 读取 `auth_states.locale`。
  - HTML 文案按 `locale` 映射（`en` / `zh`），不匹配回退 `en`。
- 测试：新增/调整对 `locale` 入库与 HTML 文案的断言。

## 客户端改动（skills-manager）

- `start_github_auth` / `start_google_auth` 传 `locale`（来源：`useTranslation().language`）。
- 删除 Sidebar 中 OAuth 调试面板、测试按钮、调试状态字段与 `append_auth_debug_log` 调用。
- Rust 侧移除 auth-debug 日志写入命令与 `lib.rs` 中的相关调用。
- 深链路处理与手动粘贴回调的正常兜底保留。

## 错误处理

- `locale` 缺失或异常：回退 `en`。
- 其他认证失败逻辑不变。

## 测试

- `skills-market-api`：
  - `/auth/start` 入库 `locale`。
  - `/auth/callback` 返回 HTML 文案与 `locale` 匹配。
- `skills-manager`：
  - 更新 `build_auth_start_url` 测试，验证 `locale` query。

