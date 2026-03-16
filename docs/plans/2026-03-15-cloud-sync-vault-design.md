# 云同步：Marketplace 识别 + Vault 非市场技能无感备份设计

## 背景
当前云同步仅同步配置与状态（工具启用、技能启用），不包含技能文件内容；登录后自动 pull 也不会应用远端配置。用户跨设备时容易出现缺失技能，尤其是非市场技能。

## 目标
- 登录后跨设备自动恢复缺失技能并应用配置。
- 对 Marketplace 技能：自动补装。
- 对非市场技能：无感备份到私有 GitHub 仓库并自动恢复。
- 不要求用户手动导出/导入。

## 非目标
- 不引入 S3/OSS（本阶段仅使用 GitHub 私有仓库）。
- 不在客户端直接读写 GitHub 仓库（避免越权与凭证泄露）。

## 方案概述
- 扩展云同步 payload，携带技能来源与恢复信息。
- pull 后应用远端 payload：先补缺失技能，再应用 tool_states。
- 增加 Vault 服务：服务端代管 GitHub 私有仓库，提供 upload/download（list 预留）。
- 客户端在 push 前自动备份非市场技能到 Vault。

## 数据模型
- CloudSyncSkill 增加来源与恢复字段：
- source: "marketplace" | "vault" | "local" | "imported"
- marketplace: { marketplace_source_id, marketplace_skill_id, marketplace_skill_slug, repo_url, skill_path, remote_revision }
- vault: { provider: "github", user_id, skill_id, version, hash, size, updated_at }

示例（节选）:
{
  "skills": [
    {
      "id": "my-skill",
      "name": "My Skill",
      "source": "vault",
      "version": "1.0",
      "vault": {
        "provider": "github",
        "user_id": "u_123",
        "skill_id": "my-skill",
        "version": "1.0",
        "hash": "sha256:...",
        "size": 12345,
        "updated_at": 1700000000
      }
    }
  ]
}

## 客户端流程
1. 登录后 cloud_sync_pull：拿到 payload 后立即应用。
2. 应用顺序：
- 补装缺失技能（Marketplace 或 Vault）
- 应用 tool_states（启用/禁用）
- refresh_tools / refresh_skills
3. Marketplace 补装：基于 payload.marketplace 直接安装（新增指令按 repo_url + skill_path 安装）。
4. Vault 补装：调用 vault/download，解包到 skills_dir。
5. 自动备份：
- 触发点：每次 cloud_sync_push 前（手动同步 / 定时同步）
- 不维护本地 vault_index.json，服务端按 hash/size 去重
- 备份失败会中断本次 push，并在同步状态中提示错误

## 服务端流程（Vault）
- 仓库结构：
- users/<user_id>/manifest.json
- users/<user_id>/<skill_id>.zip
- API（当前实现）：
- POST /vault/upload (skill_id, hash, size, zip)
- GET /vault/download?skill_id=...
- GET /vault/list（返回 manifest，预留）
- 服务端代管 GitHub 仓库写入（GitHub App 或专用 PAT），客户端无仓库凭证。
- 上传前安全校验：zip 解包路径校验、最大文件数/总大小限制。

## 配额与限制
- 单技能大小限制（建议 5–20MB）。
- 每用户总配额（建议 200MB，可配置）。
- 上传去重：hash 相同直接跳过。
- 批量提交：合并多次上传为一次 commit，减少 API 压力。

## 冲突与一致性
- 当 push 返回冲突时保持现有 UI；选择“使用远端”时先补装缺失技能再应用配置。
- payload_hash 需纳入 marketplace/vault 字段，保证变更可触发同步。

## 安全与隐私
- 客户端只通过后端访问 Vault，不接触 GitHub 凭证。
- 首次登录提示一次性授权“备份非市场技能以跨设备恢复”。

## 兼容与迁移
- 旧客户端仍可使用现有云同步（不感知新字段）。
- 新字段为可选，服务端返回时对旧客户端兼容。

## 测试计划
- 单测：
- payload_hash 包含 marketplace/vault 字段
- 缺失技能补装流程（Marketplace/Vault）
- Vault 上传去重逻辑（vault_upload/vault_backup）
- 集成：
- 登录后 pull + 应用 payload
- 冲突“使用远端”流程

## 风险与对策
- GitHub 仓库膨胀：通过大小/配额限制与去重控制。
- 上传失败：本地保留失败队列并提示；下次同步自动重试。
- 非市场技能隐私：明确授权提示 + 可关闭备份开关。

## 里程碑
1. 客户端读取 marketplace/vault 元信息并扩展 payload。
2. pull 后应用 payload，补装缺失技能。
3. Vault API 与 GitHub 代管写入。
4. 无感上传与设置项提示。

## 开放问题
- 单技能大小与用户配额的默认值。
- Vault 上传失败的重试策略与上限。
