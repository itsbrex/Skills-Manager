# Goal Prompt: Skills Manager 开源清理 - Phase 1（后端清理）

## 目标

删除 Skills Manager 项目中所有依赖后端服务的云功能代码，为开源做准备。

## 背景

Skills Manager 是一个基于 Tauri 2.0 的桌面应用，目前包含云同步、OAuth 认证等依赖私有后端的功能。现在需要将这些功能移除，只保留本地核心功能，准备开源 Community Edition。

## 详细任务清单

### Phase 1: 准备工作（预计 10 分钟）

**任务 1.1：创建备份分支**
```bash
git checkout -b feat/opensource-cleanup
```

**任务 1.2：备份云功能代码**
```bash
mkdir -p .private-features/cloud-sync
cp src-tauri/src/commands/auth.rs .private-features/cloud-sync/
cp src-tauri/src/commands/cloud_sync.rs .private-features/cloud-sync/
cp src-tauri/src/commands/telemetry.rs .private-features/cloud-sync/
cp src-tauri/src/commands/polls.rs .private-features/cloud-sync/
cp src-tauri/src/commands/vault.rs .private-features/cloud-sync/
cp src-tauri/src/services/auth.rs .private-features/cloud-sync/
cp src-tauri/src/services/cloud_sync.rs .private-features/cloud-sync/
cp src-tauri/src/services/telemetry.rs .private-features/cloud-sync/
cp src-tauri/src/services/vault.rs .private-features/cloud-sync/
cp src-tauri/src/models/auth.rs .private-features/cloud-sync/
cp src-tauri/src/models/cloud_sync.rs .private-features/cloud-sync/
```

**任务 1.3：更新 .gitignore**
```bash
echo ".private-features/" >> .gitignore
```

**任务 1.4：提交备份**
```bash
git add .private-features/ .gitignore
git commit -m "chore: backup cloud features before cleanup"
```

---

### Phase 2: 后端文件删除（预计 15 分钟）

**任务 2.1：删除命令文件**
```bash
rm src-tauri/src/commands/auth.rs
rm src-tauri/src/commands/cloud_sync.rs
rm src-tauri/src/commands/polls.rs
rm src-tauri/src/commands/telemetry.rs
rm src-tauri/src/commands/vault.rs
```

验证：
```bash
# 应该报 "No such file"
ls src-tauri/src/commands/auth.rs 2>&1
```

**任务 2.2：删除服务文件**
```bash
rm src-tauri/src/services/auth.rs
rm src-tauri/src/services/cloud_sync.rs
rm src-tauri/src/services/telemetry.rs
rm src-tauri/src/services/vault.rs
```

验证：
```bash
# 应该报 "No such file"
ls src-tauri/src/services/auth.rs 2>&1
```

**任务 2.3：删除模型文件**
```bash
rm src-tauri/src/models/auth.rs
rm src-tauri/src/models/cloud_sync.rs
```

验证：
```bash
# 应该报 "No such file"
ls src-tauri/src/models/auth.rs 2>&1
```

---

### Phase 3: 模块引用清理（预计 30 分钟）

**任务 3.1：修改 src-tauri/src/commands/mod.rs**

从文件中删除以下行：
- `pub mod auth;`
- `pub mod cloud_sync;`
- `pub mod polls;`
- `pub mod telemetry;`
- `pub mod vault;`

删除以下 `pub use` 导出块：
- `pub use auth::{...};`
- `pub use cloud_sync::{...};`
- `pub use polls::{...};`
- `pub use telemetry::{...};`
- `pub use vault::{...};`

验证：
```bash
# 不应该有这些模块引用
grep -E "pub mod (auth|cloud_sync|polls|telemetry|vault)" src-tauri/src/commands/mod.rs
# 应该返回空
```

**任务 3.2：修改 src-tauri/src/services/mod.rs**

从文件中删除以下行：
- `pub mod auth;`
- `pub mod cloud_sync;`
- `pub mod telemetry;`
- `pub mod vault;`

删除相应的 `pub use` 导出（如果有）。

验证：
```bash
grep -E "pub mod (auth|cloud_sync|telemetry|vault)" src-tauri/src/services/mod.rs
# 应该返回空
```

**任务 3.3：修改 src-tauri/src/models/mod.rs**

从文件中删除以下行：
- `pub mod auth;`
- `pub mod cloud_sync;`

删除相应的 `pub use` 导出（如果有）。

验证：
```bash
grep -E "pub mod (auth|cloud_sync)" src-tauri/src/models/mod.rs
# 应该返回空
```

---

### Phase 4: 主入口文件清理（预计 30 分钟）

**任务 4.1：修改 src-tauri/src/lib.rs**

**步骤 A：清理导入列表（第 7-37 行）**

从 `use commands::{...}` 中删除以下导入：
- `cloud_sync_has_local_changes`
- `cloud_sync_pull`
- `cloud_sync_push`
- `cloud_sync_resolve`
- `exchange_github_auth`
- `exchange_google_auth`
- `fetch_poll_results`
- `fetch_polls`
- `get_auth_profile`
- `get_poll_client_state`
- `logout_auth`
- `save_poll_client_state`
- `start_github_auth`
- `start_google_auth`
- `submit_poll_vote`
- `telemetry_clear_local_data`
- `telemetry_end_session`
- `telemetry_flush_pending`
- `telemetry_initialize`
- `telemetry_record_heartbeat`
- `telemetry_track_event`
- `vault_backup`
- `vault_download`

**步骤 B：清理命令注册（约第 120-175 行）**

从 `.invoke_handler(tauri::generate_handler![...])` 中删除以下命令：
- `cloud_sync_has_local_changes`
- `cloud_sync_pull`
- `cloud_sync_push`
- `cloud_sync_resolve`
- `fetch_polls`
- `fetch_poll_results`
- `submit_poll_vote`
- `get_poll_client_state`
- `save_poll_client_state`
- `start_github_auth`
- `exchange_github_auth`
- `start_google_auth`
- `exchange_google_auth`
- `get_auth_profile`
- `logout_auth`
- `telemetry_initialize`
- `telemetry_record_heartbeat`
- `telemetry_end_session`
- `telemetry_flush_pending`
- `telemetry_track_event`
- `telemetry_clear_local_data`
- `vault_backup`
- `vault_download`

验证：
```bash
# 不应该有这些命令
grep -E "(cloud_sync|auth|poll|telemetry|vault)" src-tauri/src/lib.rs | grep -v "github_token"
# 应该返回空或只有注释
```

---

### Phase 5: 配置模型清理（预计 45 分钟）⚠️ 最复杂

**任务 5.1：修改 src-tauri/src/models/config.rs**

这是最复杂的改动，需要删除约 100 行代码。

**步骤 A：删除枚举类型（第 8-22 行）**
```rust
// 删除整个 VaultBackupConsent 枚举定义
// 删除整个 TelemetryConsent 枚举定义
```

**步骤 B：修改 UserPreferences 结构体（第 24-54 行）**

删除以下字段：
- `pub cloud_sync_auto: bool,`
- `pub cloud_sync_interval_minutes: u32,`
- `pub vault_backup_consent: VaultBackupConsent,`
- `pub telemetry_consent: TelemetryConsent,`

**步骤 C：删除 TelemetryConfig 结构体（第 76-93 行）**
```rust
// 删除整个 TelemetryConfig 结构体定义
```

**步骤 D：删除相关默认值函数**

删除以下函数：
- `fn default_telemetry_ingest_path()`
- `fn default_telemetry_heartbeat_interval_secs()`
- `fn default_telemetry_flush_interval_secs()`
- `fn default_telemetry_startup_flush_delay_secs()`
- `fn default_telemetry_batch_size()`
- `fn default_cloud_sync_interval_minutes()`
- `fn default_vault_backup_consent()`
- `fn default_telemetry_consent()`

**步骤 E：修改 UserPreferences::default() 实现（第 168-187 行）**

删除以下字段初始化：
- `cloud_sync_auto: true,`
- `cloud_sync_interval_minutes: default_cloud_sync_interval_minutes(),`
- `vault_backup_consent: default_vault_backup_consent(),`
- `telemetry_consent: default_telemetry_consent(),`

**步骤 F：删除 TelemetryConfig::default() 实现（第 189-200 行）**
```rust
// 删除整个 impl Default for TelemetryConfig 块
```

**步骤 G：修改 AppConfig 结构体（第 263-290 行）**

删除以下字段：
- `pub poll_client_state: Option<PollClientState>,`
- `pub auth_session: Option<AuthSession>,`
- `pub cloud_sync: Option<CloudSyncState>,`

**步骤 H：删除 PollClientState 结构体（第 292-298 行）**
```rust
// 删除整个 PollClientState 结构体定义
```

**步骤 I：修改 AppConfig::default() 实现（第 319-338 行）**

删除以下字段初始化：
- `poll_client_state: Some(PollClientState::default()),`
- `auth_session: None,`
- `cloud_sync: Some(CloudSyncState::new()),`

**步骤 J：删除文件顶部的导入**

删除以下导入（如果存在）：
- `use crate::models::auth::AuthSession;`
- `use crate::models::cloud_sync::CloudSyncState;`

验证：
```bash
# 不应该有这些类型
grep -E "(VaultBackupConsent|TelemetryConsent|TelemetryConfig|PollClientState|AuthSession|CloudSyncState)" src-tauri/src/models/config.rs
# 应该返回空
```

---

### Phase 6: 编译验证（预计 15 分钟）

**任务 6.1：编译 Rust 后端**
```bash
cd src-tauri
cargo build --release
```

**预期结果：** ✅ 编译成功，无错误

如果有错误：
1. 检查错误信息中的类型/函数名
2. 搜索该类型/函数在哪里被引用
3. 删除或注释掉相关引用
4. 重新编译

**任务 6.2：运行测试**
```bash
cargo test
```

**预期结果：** ✅ 所有测试通过（某些云功能测试会被删除）

**任务 6.3：检查 Clippy**
```bash
cargo clippy -- -D warnings
```

**预期结果：** ✅ 无警告

---

### Phase 7: 提交代码（预计 5 分钟）

**任务 7.1：查看改动**
```bash
cd ..  # 回到项目根目录
git status
git diff --stat
```

**预期改动：**
- 删除 11 个 Rust 文件
- 修改 5 个 Rust 文件

**任务 7.2：提交**
```bash
git add -A
git commit -m "refactor: remove cloud features for open source

- Remove auth commands (GitHub/Google OAuth)
- Remove cloud sync commands (pull/push/resolve)
- Remove polls commands
- Remove telemetry commands
- Remove vault commands
- Update config model (remove cloud-related fields)
- Update module exports

All local features remain functional.
"
```

---

## 成功标准

### 必须满足

- [ ] 所有列出的文件已删除（11 个）
- [ ] 所有模块引用已清理（3 个 mod.rs）
- [ ] lib.rs 命令注册已清理（约 24 个命令）
- [ ] config.rs 已完整修改（约 100 行删除）
- [ ] `cargo build --release` 编译成功
- [ ] `cargo test` 测试通过
- [ ] `cargo clippy` 无警告
- [ ] Git 提交完成

### 验证命令

执行以下命令，全部应该返回空或成功：

```bash
# 1. 确认文件已删除
ls src-tauri/src/commands/auth.rs 2>&1 | grep "No such file"
ls src-tauri/src/commands/cloud_sync.rs 2>&1 | grep "No such file"
ls src-tauri/src/commands/polls.rs 2>&1 | grep "No such file"
ls src-tauri/src/commands/telemetry.rs 2>&1 | grep "No such file"
ls src-tauri/src/commands/vault.rs 2>&1 | grep "No such file"

# 2. 确认无残留引用
cd src-tauri
grep -r "AuthSession\|CloudSyncState\|PollClientState" src/ --include="*.rs" | grep -v "^src/models/"
# 应该返回空

# 3. 确认编译成功
cargo build --release 2>&1 | grep "Finished release"
# 应该看到 "Finished release"

# 4. 确认测试通过
cargo test 2>&1 | tail -5 | grep "test result: ok"
# 应该看到 "test result: ok"
```

---

## 时间估算

- Phase 1（准备）：10 分钟
- Phase 2（删除文件）：15 分钟
- Phase 3（模块引用）：30 分钟
- Phase 4（lib.rs）：30 分钟
- Phase 5（config.rs）：45 分钟 ⚠️
- Phase 6（编译验证）：15 分钟
- Phase 7（提交）：5 分钟

**总计：约 2.5 小时**

---

## 参考文档

完整改动清单：`docs/COMPLETE_CHANGELOG.md`
执行指南：`docs/CLEANUP_EXECUTION_GUIDE.md`

---

## 注意事项

1. **不要跳过备份步骤** - Phase 1 的备份很重要
2. **config.rs 最复杂** - Phase 5 需要仔细操作
3. **边做边测试** - 每个 Phase 完成后运行编译验证
4. **遇到错误不要慌** - 参考错误信息，搜索引用位置
5. **保持专注** - 一次只做一个 Phase

---

## 如果遇到问题

### 编译错误："cannot find type X"

**原因：** 某个地方还在引用已删除的类型

**解决：**
```bash
# 搜索该类型的所有引用
grep -rn "X" src-tauri/src/ --include="*.rs"
# 删除或注释掉相关代码
```

### 编译错误："unresolved import"

**原因：** 某个地方还在导入已删除的模块

**解决：**
```bash
# 搜索 use 语句
grep -rn "use.*X" src-tauri/src/ --include="*.rs"
# 删除相关导入
```

### 测试失败

**原因：** 某些测试依赖云功能

**解决：**
- 检查失败的测试名称
- 如果是云功能相关测试，这是正常的（因为功能已删除）
- 如果是本地功能测试失败，需要修复

---

## 完成后下一步

Phase 1（后端清理）完成后：
- Phase 2：前端清理（约 2 小时）
- Phase 3：文档创建（约 2-3 小时）

或者休息一下，明天继续 😊
