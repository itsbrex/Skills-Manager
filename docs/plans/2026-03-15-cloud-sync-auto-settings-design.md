# 云同步自动同步设置设计

## 目标
- 在“账号与云同步”区域新增独立的“自动云同步”开关与“同步间隔”下拉框。
- 默认开启自动云同步，默认间隔 10 分钟。
- 关闭自动云同步后，仅保留手动同步能力。

## 配置与数据模型
- 在 `UserPreferences` 中新增字段：
  - `cloud_sync_auto: boolean`（默认 `true`）
  - `cloud_sync_interval_minutes: number`（默认 `10`）
- Rust 与 TypeScript 的配置模型同步增加字段，并在默认配置中落地。
- 与现有 `auto_sync`（编辑 Skill 自动同步到工具）完全独立，避免语义混淆。

## UI/交互
- 在“云同步”区域增加两行：
  - 自动云同步开关（独立于现有自动同步）
  - 同步间隔下拉框（候选 5/10/15/30/60 分钟，默认 10）
- 当开关关闭时，下拉框置灰但保留选中值；手动同步按钮仍可用。
- 新增 i18n 文案，避免复用现有“自动同步（工具）”描述。

## 数据流与调度
- 新增轻量 `cloudSyncSettingsStore` 用于在前端广播偏好变更：
  - App/CloudSyncProvider 启动时读取 `get_config` 并初始化 store。
  - Settings/Welcome 成功 `save_config` 后更新 store。
  - CloudSyncProvider 订阅 store，动态更新 `auto` 与 `interval` 状态。
- 调度逻辑：
  - `auto` 开启时启用定时器；间隔变化时重建定时器。
  - `auto` 关闭时清理定时器，仅保留手动同步。
  - 发生冲突时跳过自动同步，避免覆盖。
- 登录后仍执行一次 pull 更新云端 revision（即使自动同步关闭）。

## 错误处理
- 自动同步失败保持静默或仅记录错误状态，不强弹窗。
- 手动同步失败继续提示错误，便于用户感知。

## 测试与验证
- 新增 store 单测（`node --test --experimental-strip-types`）。
- 手工验证：
  - 登录后设置页与侧边栏状态同步。
  - 关闭自动同步后不再触发定时推送。
  - 调整间隔后下一次触发时间符合选择值。
