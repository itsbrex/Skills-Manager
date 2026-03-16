# 云同步拉取策略与设置全量同步设计

## 1. 目标

- 启动应用后与登录成功后都立刻从云端拉取一次最新内容。
- 所有“同步”动作统一为 `pull → 应用远端 → push`。
- 拉取/上传有明确状态展示（拉取中、上传中、失败）。
- 设置项全量云同步（包含 `github_token` 等敏感配置）。
- 多端同时修改时，采用“远端优先”（pull 覆盖本地）并避免静默丢失远端更新。

## 2. 非目标

- 不做冲突三方合并或逐项合并（保持远端优先）。
- 不改变云端 API 协议（仅扩展 payload 字段）。
- 不引入新的定时拉取策略（只在启动/登录/同步动作触发）。

## 3. 现状与问题

- 当前只在登录态变化时 pull 一次；之后不会再 pull。
- 自动同步定时器仅做 push，默认间隔 10 分钟。
- 多端同时修改时会出现 conflict，但不会自动拉取；易造成“看不到对端更新”。
- payload 不包含 preferences，设置无法跨设备同步。

## 4. 新同步流程（远端优先）

### 4.1 触发点

- 启动应用且已登录：立即 pull。
- 登录成功回调：立即 pull（不受 lastPullUserRef 影响）。
- 手动点击“同步”：先 pull，再 push。
- 自动同步定时器触发：先 pull，再 push。

### 4.2 统一流程

1. `syncStage = pulling`，调用 `cloud_sync_pull`。
2. 成功后应用远端 payload（覆盖本地配置、工具状态、技能启用关系）。
3. `syncStage = pushing`，执行 push：
   - 先按“是否允许备份”决定是否先做 vault backup。
   - 再调用 `cloud_sync_push`。
4. 若 push 返回 conflict：
   - 自动再 pull 一次并重试 push 一次。
   - 仍冲突或 pull 失败则报错并停止自动同步。

### 4.3 错误处理

- pull 失败：不改变本地状态，不进行 push。
- applyCloudPayload 失败（如 restore 失败）：不进行 push，提示错误。
- push 失败：提示错误，保留本地状态；自动同步会跳过后续回合直到错误被清理或用户手动触发。

## 5. Payload 扩展（全量 preferences）

在 `CloudSyncPayload` 中新增 `preferences` 字段，内容为完整 `UserPreferences`：

```json
{
  "version": 1,
  "updated_at": 1710000000,
  "device_id": "uuid",
  "skills": [],
  "tool_states": {},
  "custom_tools": [],
  "preferences": {
    "theme": "system",
    "language": "zh",
    "auto_sync": true,
    "sync_on_save": true,
    "cloud_sync_auto": true,
    "cloud_sync_interval_minutes": 10,
    "default_editor": "system",
    "tab_size": 2,
    "show_sync_notifications": true,
    "remove_links_when_disabling_tool": false,
    "vault_backup_consent": "unknown",
    "github_token": "..."
  }
}
```

### 5.1 应用策略

- 远端优先：`preferences` 直接覆盖本地 `config.preferences`。
- 应用后调用 `save_config` 并同步到前端 store（使 UI 即时更新）。

### 5.2 Hash 规则

- `payload_hash` 必须包含 `preferences`，否则设置变化无法触发 push。

## 6. 状态展示

新增同步阶段状态 `syncStage`：

- `idle` | `pulling` | `pushing` | `error`

UI 展示：

- 设置页“云同步”卡片显示：
  - `pulling`：正在从云端拉取…
  - `pushing`：正在上传…
  - `error`：同步失败（展示 error 文案）
- 按钮禁用逻辑仍以 `syncing` 为主（避免多次触发）。

## 7. 多端并发与一致性

- 所有同步动作先 pull，确保本地以远端为准。
- push 冲突时自动再 pull 并重试一次，最大化吸收远端最新状态。
- 避免弹窗打断；如多次冲突则进入错误状态，交由用户手动同步或重新登录。

## 8. 测试计划

### 8.1 Rust 侧

- `build_payload` 应包含 `preferences`。
- `payload_hash` 包含 `preferences`，设置变更会改变 hash。
- `CloudSyncPayload` 序列化/反序列化新增字段兼容性测试。

### 8.2 前端

- 手动同步：顺序为 pull → apply → push。
- 自动同步：定时触发时先 pull 再 push。
- pull 失败不会触发 push。
- push 冲突会触发“pull + 重试 push”且仅重试一次。
- `syncStage` 状态切换正确并驱动 UI 文案更新。

## 9. 风险与权衡

- 全量同步 `github_token` 带来安全风险，但符合产品需求。
- 远端优先可能覆盖本地未同步改动；这是显式决策。
- 跨平台 `default_editor` 等字段可能不可用：保持远端值，必要时提示或回退系统默认。

## 10. 交付清单

- payload 扩展（preferences）。
- 同步流程改为 pull→push。
- 启动/登录立即 pull。
- 新增同步阶段状态与 UI 提示。
- 测试覆盖新增行为。
