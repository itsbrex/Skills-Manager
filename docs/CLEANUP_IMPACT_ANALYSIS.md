# 开源清理影响分析报告

## 📊 需要删除的文件清单

### 后端（Rust）- 7 个命令文件

```
src-tauri/src/commands/
├── ❌ auth.rs                 # OAuth 认证
├── ❌ cloud_sync.rs           # 云同步（pull/push/resolve）
├── ❌ polls.rs                # 投票功能
├── ❌ telemetry.rs            # 遥测上报
├── ❌ vault.rs                # Vault 备份
├── ⚠️  feedback.rs            # 飞书反馈 webhook（可选保留）
└── ⚠️  updater.rs             # 更新检查（依赖 github_token，需改造）
```

### 后端（Rust）- 4 个服务文件

```
src-tauri/src/services/
├── ❌ auth.rs                 # OAuth 服务
├── ❌ cloud_sync.rs           # 云同步服务
├── ❌ telemetry.rs            # 遥测服务
├── ❌ vault.rs                # Vault 服务
└── ⚠️  marketplace.rs         # Marketplace（需改造为只读）
```

### 后端（Rust）- 2 个模型文件

```
src-tauri/src/models/
├── ❌ auth.rs                 # AuthSession, AuthProfile
└── ❌ cloud_sync.rs           # CloudSyncPayload, CloudSyncState
```

### 前端（TypeScript）- 6 个文件

```
src/
├── components/cloud/
│   └── ❌ CloudSyncConflictDialog.tsx
├── hooks/
│   └── ❌ useCloudSyncAgent.tsx
└── services/
    ├── ❌ auth.ts
    ├── ❌ authError.ts
    ├── ❌ authError.test.ts
    ├── ❌ authProfileStore.ts
    └── ❌ authProfileStore.test.ts
```

---

## 🔍 需要修改的文件清单

### 1. 配置模型（高优先级）

**文件：** `src-tauri/src/models/config.rs`

**需要移除的结构体和字段：**

```rust
// ❌ 移除整个枚举
pub enum VaultBackupConsent { ... }
pub enum TelemetryConsent { ... }

// ❌ 移除 UserPreferences 中的字段
pub struct UserPreferences {
    // ... 保留其他字段
    // ❌ pub vault_backup_consent: VaultBackupConsent,
    // ❌ pub telemetry_consent: TelemetryConsent,
    // ❌ pub cloud_sync_auto: bool,
    // ❌ pub cloud_sync_interval_minutes: u32,
}

// ❌ 移除 AppConfig 中的字段
pub struct AppConfig {
    // ... 保留其他字段
    // ❌ pub auth_session: Option<AuthSession>,
    // ❌ pub cloud_sync: Option<CloudSyncState>,
    // ❌ pub poll_client_state: Option<PollClientState>,
}

// ❌ 移除整个结构体
pub struct PollClientState { ... }
pub struct TelemetryConfig { ... }
```

### 2. 命令模块（高优先级）

**文件：** `src-tauri/src/commands/mod.rs`

**需要移除的模块引用：**

```rust
// ❌ 移除
// pub mod auth;
// pub mod cloud_sync;
// pub mod polls;
// pub mod telemetry;
// pub mod vault;
```

### 3. 服务模块（高优先级）

**文件：** `src-tauri/src/services/mod.rs`

**需要移除的模块引用：**

```rust
// ❌ 移除
// pub mod auth;
// pub mod cloud_sync;
// pub mod telemetry;
// pub mod vault;
```

### 4. 主入口文件（高优先级）

**文件：** `src-tauri/src/lib.rs`

**需要移除的 Tauri 命令：**

```rust
.invoke_handler(tauri::generate_handler![
    // ✅ 保留本地功能
    commands::config::get_config,
    commands::config::save_config,
    commands::skills::list_skills,
    commands::sync::enable_skill,
    commands::sync::disable_skill,
    commands::files::read_directory_tree,
    commands::files::read_file,
    commands::files::write_file,
    commands::llm::translate_text,
    commands::marketplace::list_marketplace_skills,
    commands::marketplace::install_marketplace_skill,
    commands::editors::detect_editors,
    commands::editors::open_in_editor,
    commands::tools::detect_tools,
    // ... 其他本地命令
    
    // ❌ 移除所有云功能
    // commands::auth::start_github_auth,
    // commands::auth::complete_github_auth,
    // commands::auth::start_google_auth,
    // commands::auth::logout,
    // commands::cloud_sync::cloud_sync_pull,
    // commands::cloud_sync::cloud_sync_push,
    // commands::cloud_sync::cloud_sync_resolve,
    // commands::cloud_sync::cloud_sync_has_local_changes,
    // commands::polls::list_polls,
    // commands::polls::submit_vote,
    // commands::telemetry::report_event,
    // commands::vault::upload_skill_to_vault,
    // commands::vault::download_skill_from_vault,
])
```

### 5. Marketplace 服务（需改造）

**文件：** `src-tauri/src/services/marketplace.rs`

**当前问题：** 调用了后端 API `https://skills-market-api.guardssl.info/api/v1`

**改造方案：**

选项 A：完全本地化（推荐）
```rust
// 从配置的公开源抓取（GitHub、skills.sh）
// 不依赖你的后端服务
pub async fn list_marketplace_skills() -> Result<Vec<MarketplaceSkill>> {
    let config = ConfigManager::new().load()?;
    let sources = config.marketplace_sources.unwrap_or_default();
    
    for source in sources {
        match source.source_type {
            SourceType::GitHub => fetch_from_github(&source.url).await?,
            SourceType::Crawler => fetch_from_web(&source.url).await?,
        }
    }
}
```

选项 B：保留 API 调用，但标记为可选
```rust
// 如果用户配置了自己的 Marketplace API，则使用
// 否则从本地源抓取
```

### 6. Updater 命令（需改造）

**文件：** `src-tauri/src/commands/updater.rs`

**当前问题：** 依赖 `github_token` 检查更新

**改造方案：**

```rust
// 移除 github_token 依赖，使用 GitHub 公开 API
pub async fn check_for_updates() -> Result<UpdateInfo> {
    // 调用 GitHub Releases API（公开，无需 token）
    let response = reqwest::get(
        "https://api.github.com/repos/jiweiyeah/Skills-Manager/releases/latest"
    ).await?;
    
    // 解析版本信息
    let release: GithubRelease = response.json().await?;
    
    // 与当前版本比较
    if is_newer_version(&release.tag_name, &current_version()) {
        Ok(UpdateInfo {
            available: true,
            version: release.tag_name,
            download_url: release.assets[0].browser_download_url,
        })
    } else {
        Ok(UpdateInfo { available: false, ... })
    }
}
```

### 7. Feedback 命令（可选保留）

**文件：** `src-tauri/src/commands/feedback.rs`

**当前实现：** 发送到飞书 webhook

**选项 A：** 保留（开源版也能收到反馈）
**选项 B：** 删除（让用户通过 GitHub Issues 反馈）
**选项 C：** 改为打开 GitHub Issues 页面

**推荐：选项 C**
```rust
pub async fn submit_feedback(feedback: String) -> Result<()> {
    // 构造 GitHub Issue URL
    let issue_url = format!(
        "https://github.com/jiweiyeah/Skills-Manager/issues/new?title=User+Feedback&body={}",
        urlencoding::encode(&feedback)
    );
    
    // 在浏览器中打开
    open::that(issue_url)?;
    Ok(())
}
```

---

## 🔗 依赖关系分析

### marketplace.rs 依赖检查

```bash
# 检查 marketplace.rs 是否依赖云功能
grep -n "auth\|cloud_sync\|telemetry" src-tauri/src/services/marketplace.rs
```

如果有依赖，需要移除相关代码。

### config.rs 序列化兼容性

**问题：** 删除字段后，旧的配置文件加载会失败吗？

**答案：** 不会，Serde 会忽略未知字段（前提是使用了 `#[serde(default)]`）

**验证：**
```rust
// 确保所有被删除的字段都有 #[serde(default)]
#[serde(default)]
pub auth_session: Option<AuthSession>,  // ← 有 default，删除后安全
```

---

## 📦 前端影响分析

### 需要检查的组件

```bash
# 查找所有引用 auth 或 cloudSync 的文件
grep -r "useAuth\|AuthContext\|CloudSync" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```

**预期结果：**
- Settings.tsx（设置页面可能有云同步选项）
- 顶部导航栏（可能有用户头像/登录按钮）
- Skills.tsx（可能有云同步按钮）

### UI 改造清单

1. **删除登录/用户头像**
   - 移除顶部导航栏的认证相关 UI

2. **删除云同步按钮**
   - Skills 页面的同步按钮
   - 设置页面的云同步配置

3. **添加 Pro 功能占位**
   - 在设置页面添加"即将推出"的 Pro 功能卡片

---

## ⚠️ 潜在风险与应对

### 风险 1：配置文件兼容性

**问题：** 用户升级后，旧配置文件包含已删除的字段

**应对：** 
```rust
// 使用 #[serde(default)] 和 Option<T>
// Serde 会自动忽略未知字段
```

### 风险 2：前端 TypeScript 类型错误

**问题：** 删除后端命令后，前端调用会报类型错误

**应对：**
```bash
# 搜索所有 invoke 调用
grep -r "invoke(" src/ --include="*.tsx" --include="*.ts" | grep -E "(auth|cloud_sync|telemetry|polls|vault)"
```

然后逐个删除或注释掉。

### 风险 3：Marketplace 功能降级

**问题：** 移除后端 API 后，Marketplace 数据从哪来？

**应对：**
- 从配置的公开源抓取（skills.sh、GitHub）
- 用户可以添加自定义源
- 数据缓存在本地

---

## ✅ 验证清单

清理完成后，运行以下检查：

### 1. 编译检查
```bash
cd src-tauri
cargo clean
cargo build --release
```

### 2. 测试检查
```bash
cargo test
```

### 3. 前端检查
```bash
npm run typecheck
npm run build
```

### 4. 完整构建
```bash
npm run tauri build
```

### 5. 手动测试
- [ ] 启动应用
- [ ] 扫描 Skills
- [ ] 启用/禁用 Skill
- [ ] 打开编辑器
- [ ] 使用 AI 翻译（自带 Key）
- [ ] 浏览 Marketplace
- [ ] 安装 Skill
- [ ] 检测工具
- [ ] 设置页面无云功能选项

---

## 📝 建议的执行顺序

### Phase 1: 准备（10 分钟）
1. 创建新分支 `feat/opensource-cleanup`
2. 备份云功能代码到 `.private-features/`
3. 更新 `.gitignore`

### Phase 2: 后端清理（1 小时）
1. 删除命令文件（auth, cloud_sync, polls, telemetry, vault）
2. 删除服务文件（auth, cloud_sync, telemetry, vault）
3. 删除模型文件（auth, cloud_sync）
4. 修改 `commands/mod.rs`
5. 修改 `services/mod.rs`
6. 修改 `models/mod.rs`
7. 修改 `lib.rs`（移除命令注册）
8. 修改 `config.rs`（移除字段）

### Phase 3: 功能改造（1 小时）
1. 改造 `marketplace.rs`（移除后端 API 依赖）
2. 改造 `updater.rs`（移除 github_token 依赖）
3. 改造 `feedback.rs`（改为打开 GitHub Issues）

### Phase 4: 前端清理（30 分钟）
1. 删除 auth 相关文件
2. 删除 cloud sync 相关文件
3. 更新路由
4. 更新 UI（移除登录、云同步按钮）
5. 添加 Pro 功能占位

### Phase 5: 测试与修复（1 小时）
1. 编译测试
2. 单元测试
3. 手动测试
4. 修复发现的问题

### Phase 6: 文档（2 小时）
1. README.md
2. LICENSE
3. CONTRIBUTING.md
4. SECURITY.md
5. CHANGELOG.md

---

## 🎯 预期成果

完成后的开源版本应该：

✅ **功能完整性**
- 所有本地功能正常工作
- 无云功能残留 UI
- Marketplace 可以浏览和安装

✅ **代码质量**
- 编译无错误无警告
- 所有测试通过
- 无未使用的导入

✅ **文档完善**
- README 清晰说明这是 Community Edition
- 说明 Pro 功能计划

✅ **用户体验**
- 不会看到报错或残缺功能
- Pro 功能有清晰的"即将推出"提示

---

现在我可以帮你：

1. **开始执行清理** - 逐步删除和修改文件
2. **先做影响分析** - 搜索所有引用，生成完整的改动清单
3. **先改造关键文件** - 从 marketplace.rs 和 updater.rs 开始

你想从哪一步开始？
