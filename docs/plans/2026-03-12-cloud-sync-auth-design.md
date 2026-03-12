# 云同步与账号系统设计（Tauri + Workers + D1）

## 1. 目标

- 为 Skills Manager 增加 Google / GitHub 登录能力（系统浏览器授权 + 自定义 URL Scheme 回调）。
- 引入账号系统，支持将以下数据同步到云端：
- 已安装 skills 列表（仅元数据与标识，不上传完整文件内容）。
- 各工具启用/禁用状态及每个 tool 的启用 skills 关系。
- 自定义工具列表。
- 同步策略为自动后台同步；冲突时提示用户选择。
- Workers 与现有 API 同部署在 `/Users/yjw/code/projects/skills-market-api`。

## 2. 非目标

- 不在本期上传/同步完整 skills 文件内容（仅同步标识与启用关系）。
- 不在本期解决跨设备自动修复本地路径（仅提示用户确认）。
- 不在本期支持除 Google/GitHub 之外的登录方式。

## 3. 现状与约束

- 客户端为 Tauri 2.0 + React；当前无账号体系。
- 既有配置保存在本地 `config.json`，包含 tools、custom_tools、preferences。
- Workers 使用 Hono + D1，已存在 `/api/v1` 路由体系。
- 桌面端无法使用网页 Cookie Session，需要 PKCE + 深链回调。

## 4. 方案概览

- 采用 OAuth PKCE + 自定义 URL Scheme 回调。
- Workers 作为 OAuth Broker：存 client secret，完成 code 换 token，并签发自有会话 token。
- D1 保存用户、身份绑定、会话与同步快照。
- 客户端安全存储 token（Stronghold/Keychain）。
- 同步使用“单用户单快照 + revision”策略，冲突时提示用户选择。

## 5. 认证流程（方案 A）

1. 客户端生成 `code_verifier`、`code_challenge`、`state`、`nonce`。
2. 客户端调用 `/api/v1/auth/:provider/start` 获取授权 URL。
3. 系统浏览器打开授权 URL，用户完成授权。
4. Provider 回调 `/api/v1/auth/:provider/callback`，Workers 校验 `state`，用 client secret 换取 provider token。
5. Workers 生成一次性 `login_code` 并重定向到 `skills-manager://auth/callback?login_code=...&state=...`。
6. 客户端捕获回调 URL，调用 `/api/v1/auth/exchange` 发送 `login_code + code_verifier`，换取 `access_token + refresh_token`。
7. 后续请求使用 `Authorization: Bearer <access_token>`。

## 6. 数据模型（D1）

- `users`：`id`、`created_at`、`last_login_at`、`status`
- `identities`：`id`、`user_id`、`provider`、`provider_user_id`、`email`、`avatar_url`、`created_at`
- `sessions`：`id`、`user_id`、`token_hash`、`expires_at`、`created_at`、`revoked_at`、`device_id`
- `sync_snapshots`：`user_id`、`revision`、`payload_json`、`updated_at`
- `sync_history`（可选）：`id`、`user_id`、`revision`、`payload_json`、`created_at`

## 7. 同步载荷（payload）

```json
{
  "version": 1,
  "updated_at": 1710000000,
  "device_id": "uuid",
  "skills": [
    {"id": "skill-creator", "name": "skill-creator", "source": "local", "version": "1.0.0"}
  ],
  "tool_states": {
    "codex": {"enabled": true, "enabled_skills": ["skill-creator"]},
    "claude_code": {"enabled": false, "enabled_skills": []}
  },
  "custom_tools": [
    {"id": "mytool", "name": "My Tool", "config_path": "/path", "skills_path": "/path", "enabled": true}
  ]
}
```

注意：`config_path`、`skills_path` 为设备特有字段，跨设备时需要用户确认或重新绑定。

## 8. 同步流程与冲突处理

- 启动后若已登录：`/sync/pull` 拉取快照与 `revision`。
- 本地变更写入 `pending_sync`，10-30 秒内去抖合并后 `/sync/push`。
- `/sync/push` 携带 `base_revision`。若 `base_revision < server_revision`，返回冲突。
- 冲突弹窗展示“本地摘要 vs 云端摘要”，用户选择后调用 `/sync/resolve`。
- 允许幂等：`request_id` 防止重试重复写入。

## 9. API 设计

- `GET /api/v1/auth/:provider/start`
- `GET /api/v1/auth/:provider/callback`
- `POST /api/v1/auth/exchange`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/sync/pull`
- `POST /api/v1/sync/push`
- `POST /api/v1/sync/resolve`

返回统一 `error.code + error.message`，明确区分 `401/409/422`。

## 10. 客户端改动（skills-manager）

- Settings 新增“账号/云同步”区块：登录、登出、同步状态、手动同步入口。
- 处理 `skills-manager://auth/callback` 深链回调。
- 增加安全存储 token（Stronghold 或 OS Keychain）。
- 增加后台同步引擎：检测技能/工具变化并触发 push。
- 冲突弹窗 UI：对比本地/云端摘要并决策。

## 11. Workers 改动（skills-market-api）

- 新增 OAuth 路由与 D1 表结构。
- 新增 `/sync` 路由与冲突处理逻辑。
- 新增 token 管理与刷新逻辑。

## 12. 安全与合规

- 强制 PKCE + `state`，`login_code` 一次性且 5 分钟内有效。
- `access_token` 建议 15-30 分钟，`refresh_token` 30 天。
- 仅保存 token 哈希，支持轮换与注销。
- 防止深链注入：校验 `state` 与 `nonce`。

## 13. 测试计划

- Workers 单测：PKCE 校验、token 交换、过期与复用、冲突逻辑。
- D1 迁移测试：表结构、索引、revision 递增。
- 客户端集成测试：登录回调、token 刷新、断网重试、冲突弹窗。
- 回归测试：不登录功能不受影响。

## 14. 风险与待定问题

- skills 标识稳定性：本地技能可能缺少全局唯一 ID。
- 自定义工具路径跨设备处理策略与 UX。
- 是否保留历史快照数量与清理策略。
- 设备级别管理（是否允许多设备强制登出）。

