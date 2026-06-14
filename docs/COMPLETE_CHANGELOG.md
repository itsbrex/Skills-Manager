# Skills Manager 开源清理 - 完整改动清单

生成时间：2026-06-14
版本：基于当前 main 分支

---

## 📋 改动总览

| 类别 | 删除文件 | 修改文件 | 新增文件 |
|------|---------|---------|---------|
| Rust 后端 | 13 个 | 6 个 | 0 个 |
| TypeScript 前端 | 14 个 | 4 个 | 1 个 |
| 文档 | 0 个 | 0 个 | 5 个 |
| **总计** | **27 个** | **10 个** | **6 个** |

---

## 🗂️ PART 1: 后端文件删除清单（13 个文件）

### 命令层（5 个文件）

```bash
# 删除这些文件
rm src-tauri/src/commands/auth.rs
rm src-tauri/src/commands/cloud_sync.rs
rm src-tauri/src/commands/polls.rs
rm src-tauri/src/commands/telemetry.rs
rm src-tauri/src/commands/vault.rs
```

**删除原因：**
- `auth.rs` - OAuth 认证，依赖后端 API
- `cloud_sync.rs` - 云同步核心，依赖后端 API
- `polls.rs` - 投票功能，依赖后端 API
- `telemetry.rs` - 遥测上报，依赖后端 API
- `vault.rs` - Vault 备份，依赖后端 API

### 服务层（4 个文件）

```bash
# 删除这些文件
rm src-tauri/src/services/auth.rs
rm src-tauri/src/services/cloud_sync.rs
rm src-tauri/src/services/telemetry.rs
rm src-tauri/src/services/vault.rs
```

### 模型层（2 个文件）

```bash
# 删除这些文件
rm src-tauri/src/models/auth.rs
rm src-tauri/src/models/cloud_sync.rs
```

### 测试文件（2 个相关测试会自动消失）

注：删除主文件后，其 `#[cfg(test)]` 内的测试自动消失

---

## 📝 PART 2: 后端文件修改清单（6 个文件）

### 2.1 src-tauri/src/commands/mod.rs

**当前内容（部分）：**
```rust
pub mod auth;                    // ← 第 1 行
pub mod cloud_sync;              // ← 第 2 行
pub mod config;
pub mod editors;
pub mod feedback;
pub mod files;
pub mod llm;
pub mod marketplace;
pub mod polls;                   // ← 第 9 行
pub mod skill_packages;
pub mod skills;
pub mod sync;
pub mod telemetry;              // ← 第 13 行
pub mod tools;
pub mod updater;
pub mod vault;                  // ← 第 16 行

pub use auth::{
    exchange_github_auth, exchange_google_auth, get_auth_profile, logout_auth, start_github_auth,
    start_google_auth,
};
pub use cloud_sync::{
    cloud_sync_has_local_changes, cloud_sync_pull, cloud_sync_push, cloud_sync_resolve,
};
// ... 更多导出
pub use polls::{
    fetch_poll_results, fetch_polls, get_poll_client_state, save_poll_client_state,
    submit_poll_vote,
};
// ...
pub use telemetry::{
    telemetry_clear_local_data, telemetry_end_session, telemetry_flush_pending,
    telemetry_initialize, telemetry_record_heartbeat, telemetry_track_event,
};
// ...
pub use vault::{vault_backup, vault_download};
```

**需要删除的行：**
```diff
- pub mod auth;                    // 删除第 1 行
- pub mod cloud_sync;              // 删除第 2 行
- pub mod polls;                   // 删除第 9 行
- pub mod telemetry;              // 删除第 13 行
- pub mod vault;                  // 删除第 16 行

- pub use auth::{                 // 删除整个 auth 导出块（约 18-21 行）
-     exchange_github_auth, exchange_google_auth, get_auth_profile, logout_auth, start_github_auth,
-     start_google_auth,
- };
- pub use cloud_sync::{           // 删除整个 cloud_sync 导出块（约 22-24 行）
-     cloud_sync_has_local_changes, cloud_sync_pull, cloud_sync_push, cloud_sync_resolve,
- };
- pub use polls::{                // 删除整个 polls 导出块（约 43-47 行）
-     fetch_poll_results, fetch_polls, get_poll_client_state, save_poll_client_state,
-     submit_poll_vote,
- };
- pub use telemetry::{            // 删除整个 telemetry 导出块（约 57-61 行）
-     telemetry_clear_local_data, telemetry_end_session, telemetry_flush_pending,
-     telemetry_initialize, telemetry_record_heartbeat, telemetry_track_event,
- };
- pub use vault::{vault_backup, vault_download};  // 删除 vault 导出（约 67 行）
```

**保留的模块：**
- ✅ config
- ✅ editors
- ✅ feedback（需改造）
- ✅ files
- ✅ llm
- ✅ marketplace
- ✅ skill_packages
- ✅ skills
- ✅ sync
- ✅ tools
- ✅ updater（需改造）

---

### 2.2 src-tauri/src/lib.rs

**需要删除的导入（第 7-37 行）：**
```diff
use commands::{
    batch_set_skill_tools, check_marketplace_updates_if_stale, check_sync_status, check_update,
-   clear_llm_provider, clear_translation_cache, cloud_sync_has_local_changes, cloud_sync_pull,
+   clear_llm_provider, clear_translation_cache, 
-   cloud_sync_push, cloud_sync_resolve, create_custom_tool, create_skill, delete_custom_tool,
+   create_custom_tool, create_skill, delete_custom_tool,
    delete_skill, detect_available_editors, detect_tools, disable_skill, enable_skill,
-   exchange_github_auth, exchange_google_auth, fetch_marketplace_skill_descriptions,
+   fetch_marketplace_skill_descriptions,
-   fetch_marketplace_skills, fetch_poll_results, fetch_polls, fetch_skill_file_content,
+   fetch_marketplace_skills, fetch_skill_file_content,
-   fetch_skill_files, fix_sync_issues, get_auth_profile, get_available_editors,
+   fetch_skill_files, fix_sync_issues, get_available_editors,
    get_cached_marketplace_translations, get_cached_skill_translations,
-   get_cached_text_translation, get_config, get_llm_provider, get_marketplace_sources,
-   get_poll_client_state, get_tool_status,
+   get_cached_text_translation, get_config, get_llm_provider, get_marketplace_sources, get_tool_status,
    import_skills_to_hub, install_marketplace_skill, install_marketplace_skill_by_ref,
    install_skill_package_from_path, is_initialized, list_skill_packages, list_skills,
-   logout_auth, mark_initialized, open_in_editor, read_directory_tree, read_file,
+   mark_initialized, open_in_editor, read_directory_tree, read_file,
-   refresh_editors, refresh_skills, refresh_tools, remove_skill_package, save_config,
-   save_llm_provider, save_poll_client_state, scan_existing_skills, set_tool_enabled,
-   start_github_auth, start_google_auth, submit_feedback, submit_poll_vote,
+   refresh_editors, refresh_skills, refresh_tools, remove_skill_package, save_config,
+   save_llm_provider, scan_existing_skills, set_tool_enabled,
+   submit_feedback,
-   sync_marketplace_installed_skills, telemetry_clear_local_data, telemetry_end_session,
-   telemetry_flush_pending, telemetry_initialize, telemetry_record_heartbeat,
-   telemetry_track_event, test_llm_provider, toggle_marketplace_source,
+   sync_marketplace_installed_skills, test_llm_provider, toggle_marketplace_source,
    translate_marketplace_skill, translate_skill, translate_skills_batch,
-   translate_text_content, update_custom_tool,
-   update_tool_paths, vault_backup, vault_download, write_file,
+   translate_text_content, update_custom_tool, update_tool_paths, write_file,
};
```

**需要删除的命令注册（约第 120-175 行）：**
```diff
.invoke_handler(tauri::generate_handler![
    // ... 保留的命令
-   cloud_sync_has_local_changes,    // 删除
-   cloud_sync_pull,                 // 删除
-   cloud_sync_push,                 // 删除
-   cloud_sync_resolve,              // 删除
-   submit_feedback,                 // 保留但需改造
-   fetch_polls,                     // 删除
-   fetch_poll_results,              // 删除
-   submit_poll_vote,                // 删除
-   get_poll_client_state,           // 删除
-   save_poll_client_state,          // 删除
-   start_github_auth,               // 删除
-   exchange_github_auth,            // 删除
-   start_google_auth,               // 删除
-   exchange_google_auth,            // 删除
-   get_auth_profile,                // 删除
-   logout_auth,                     // 删除
-   telemetry_initialize,            // 删除
-   telemetry_record_heartbeat,      // 删除
-   telemetry_end_session,           // 删除
-   telemetry_flush_pending,         // 删除
-   telemetry_track_event,           // 删除
-   telemetry_clear_local_data,      // 删除
-   vault_backup,                    // 删除
-   vault_download,                  // 删除
])
```

**统计：删除约 28 个命令注册**

---

### 2.3 src-tauri/src/models/config.rs

这个文件需要较多修改，删除所有云相关的类型和字段。

#### 删除的枚举类型（第 8-22 行）

```diff
- #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
- #[serde(rename_all = "snake_case")]
- pub enum VaultBackupConsent {
-     Unknown,
-     Granted,
-     Denied,
- }
- 
- #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
- #[serde(rename_all = "snake_case")]
- pub enum TelemetryConsent {
-     Unknown,
-     Granted,
-     Denied,
- }
```

#### 修改 UserPreferences 结构体（第 24-54 行）

```diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_true")]
    pub auto_sync: bool,
    #[serde(default = "default_true")]
    pub sync_on_save: bool,
-   #[serde(default = "default_true")]
-   pub cloud_sync_auto: bool,                        // ← 删除
-   #[serde(default = "default_cloud_sync_interval_minutes")]
-   pub cloud_sync_interval_minutes: u32,             // ← 删除
    #[serde(default = "default_editor")]
    pub default_editor: String,
    #[serde(default = "default_tab_size")]
    pub tab_size: u8,
    #[serde(default = "default_true")]
    pub show_sync_notifications: bool,
    #[serde(default = "default_false")]
    pub remove_links_when_disabling_tool: bool,
-   #[serde(default = "default_vault_backup_consent")]
-   pub vault_backup_consent: VaultBackupConsent,     // ← 删除
-   #[serde(default = "default_telemetry_consent")]
-   pub telemetry_consent: TelemetryConsent,          // ← 删除
    #[serde(default)]
    pub github_token: Option<String>,
}
```

#### 删除 TelemetryConfig 结构体（第 76-93 行）

```diff
- #[derive(Debug, Clone, Serialize, Deserialize)]
- pub struct TelemetryConfig {
-     #[serde(default)]
-     pub enabled: bool,
-     #[serde(default)]
-     pub base_url: Option<String>,
-     #[serde(default = "default_telemetry_ingest_path")]
-     pub ingest_path: String,
-     #[serde(default)]
-     pub ingest_key: Option<String>,
-     #[serde(default = "default_telemetry_heartbeat_interval_secs")]
-     pub heartbeat_interval_secs: u32,
-     #[serde(default = "default_telemetry_flush_interval_secs")]
-     pub flush_interval_secs: u32,
-     #[serde(default = "default_telemetry_startup_flush_delay_secs")]
-     pub startup_flush_delay_secs: u32,
-     #[serde(default = "default_telemetry_batch_size")]
-     pub batch_size: u32,
- }
```

#### 删除相关的默认值函数（第 95-113 行）

```diff
- fn default_telemetry_ingest_path() -> String {
-     "/api/v1/telemetry/ingest".to_string()
- }
- 
- fn default_telemetry_heartbeat_interval_secs() -> u32 {
-     60
- }
- 
- fn default_telemetry_flush_interval_secs() -> u32 {
-     600
- }
- 
- fn default_telemetry_startup_flush_delay_secs() -> u32 {
-     45
- }
- 
- fn default_telemetry_batch_size() -> u32 {
-     20
- }

- fn default_cloud_sync_interval_minutes() -> u32 {    // ← 删除（第 130-132 行）
-     10
- }

- fn default_vault_backup_consent() -> VaultBackupConsent {  // ← 删除（第 139-141 行）
-     VaultBackupConsent::Unknown
- }

- fn default_telemetry_consent() -> TelemetryConsent {      // ← 删除（第 142-144 行）
-     TelemetryConsent::Unknown
- }
```

#### 修改 UserPreferences::default() 实现（第 168-187 行）

```diff
impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            font_family: default_font_family(),
            language: default_language(),
            auto_sync: true,
            sync_on_save: true,
-           cloud_sync_auto: true,                           // ← 删除
-           cloud_sync_interval_minutes: default_cloud_sync_interval_minutes(),  // ← 删除
            default_editor: default_editor(),
            tab_size: default_tab_size(),
            show_sync_notifications: true,
            remove_links_when_disabling_tool: false,
-           vault_backup_consent: default_vault_backup_consent(),  // ← 删除
-           telemetry_consent: default_telemetry_consent(),        // ← 删除
            github_token: None,
        }
    }
}
```

#### 删除 TelemetryConfig::default() 实现（第 189-200 行）

```diff
- impl Default for TelemetryConfig {
-     fn default() -> Self {
-         Self {
-             enabled: false,
-             base_url: None,
-             ingest_path: default_telemetry_ingest_path(),
-             ingest_key: None,
-             heartbeat_interval_secs: default_telemetry_heartbeat_interval_secs(),
-             flush_interval_secs: default_telemetry_flush_interval_secs(),
-             startup_flush_delay_secs: default_telemetry_startup_flush_delay_secs(),
-             batch_size: default_telemetry_batch_size(),
-         }
-     }
- }
```

#### 修改 AppConfig 结构体（第 263-290 行）

```diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub skills_dir: PathBuf,
    pub tools: HashMap<String, ToolConfig>,
    #[serde(default)]
    pub custom_tools: HashMap<String, CustomToolConfig>,
    #[serde(default)]
    pub skill_metadata: HashMap<String, SkillMetadata>,
    #[serde(default)]
    pub preferences: Option<UserPreferences>,
    #[serde(default)]
    pub marketplace_sources: Option<Vec<MarketplaceSource>>,
-   #[serde(default)]
-   pub poll_client_state: Option<PollClientState>,        // ← 删除
-   #[serde(default)]
-   pub auth_session: Option<AuthSession>,                 // ← 删除
-   #[serde(default)]
-   pub cloud_sync: Option<CloudSyncState>,                // ← 删除
    #[serde(default)]
    pub projects: Vec<ProjectBinding>,
    #[serde(default)]
    pub active_project_id: Option<String>,
    #[serde(default)]
    pub llm_provider: Option<LlmProvider>,
    #[serde(default)]
    pub initialized: bool,
}
```

#### 删除 PollClientState 结构体（第 292-298 行）

```diff
- #[derive(Debug, Clone, Serialize, Deserialize, Default)]
- pub struct PollClientState {
-     #[serde(default)]
-     pub voter_id: Option<String>,
-     #[serde(default)]
-     pub voted_options: HashMap<String, String>,
- }
```

#### 修改 AppConfig::default() 实现（第 319-338 行）

```diff
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: "2.0.3".to_string(),
            skills_dir: Self::default_skills_dir(),
            tools: HashMap::new(),
            custom_tools: HashMap::new(),
            skill_metadata: HashMap::new(),
            preferences: Some(UserPreferences::default()),
            marketplace_sources: Some(default_marketplace_sources()),
-           poll_client_state: Some(PollClientState::default()),  // ← 删除
-           auth_session: None,                                   // ← 删除
-           cloud_sync: Some(CloudSyncState::new()),              // ← 删除
            projects: Vec::new(),
            active_project_id: None,
            llm_provider: None,
            initialized: false,
        }
    }
}
```

#### 删除的导入（文件开头）

```diff
- use crate::models::auth::AuthSession;                    // ← 需要删除
- use crate::models::cloud_sync::CloudSyncState;           // ← 需要删除
```

**预计删除行数：约 100-120 行**

---

### 2.4 src-tauri/src/models/mod.rs

```diff
- pub mod auth;              // ← 删除
- pub mod cloud_sync;        // ← 删除

- pub use auth::*;           // ← 删除（如果有）
- pub use cloud_sync::*;     // ← 删除（如果有）
```

---

### 2.5 src-tauri/src/services/mod.rs

```diff
- pub mod auth;              // ← 删除
- pub mod cloud_sync;        // ← 删除
- pub mod telemetry;         // ← 删除
- pub mod vault;             // ← 删除

- pub use auth::*;           // ← 删除（如果有）
- pub use cloud_sync::*;     // ← 删除（如果有）
- pub use telemetry::*;      // ← 删除（如果有）
- pub use vault::*;          // ← 删除（如果有）
```

---

### 2.6 需要改造的文件

#### 2.6.1 src-tauri/src/commands/feedback.rs

**当前实现：** 发送到飞书 webhook

**改造方案：** 改为在浏览器打开 GitHub Issues 页面

```rust
// 原代码
const FEISHU_WEBHOOK_URL: &str =
    "https://open.feishu.cn/open-apis/bot/v2/hook/31a9a8c2-64a7-4e40-a854-16b2dfb458c1";

#[tauri::command]
pub async fn submit_feedback(content: String, contact: Option<String>) -> Result<(), String> {
    // 发送到飞书...
}
```

**修改为：**

```rust
#[tauri::command]
pub async fn submit_feedback(content: String, contact: Option<String>) -> Result<(), String> {
    // 构造 GitHub Issue URL
    let title = "User Feedback";
    let mut body = content;
    
    if let Some(email) = contact {
        body.push_str(&format!("\n\n---\nContact: {}", email));
    }
    
    let issue_url = format!(
        "https://github.com/jiweiyeah/Skills-Manager/issues/new?title={}&body={}",
        urlencoding::encode(title),
        urlencoding::encode(&body)
    );
    
    // 在浏览器中打开
    open::that(issue_url).map_err(|e| format!("Failed to open browser: {}", e))?;
    
    Ok(())
}
```

**需要添加依赖（Cargo.toml）：**
```toml
open = "5.0"          # 用于打开浏览器
urlencoding = "2.1"   # 用于 URL 编码
```

#### 2.6.2 src-tauri/src/commands/updater.rs

**当前问题：** 依赖 `github_token` 从配置中读取

**需要检查：**
```bash
grep -n "github_token" src-tauri/src/commands/updater.rs
```

**如果有依赖，修改为：**

```rust
// 原代码（依赖 github_token）
pub async fn check_update() -> Result<UpdateInfo, String> {
    let github_token = ConfigManager::new()
        .load()?
        .preferences
        .and_then(|prefs| prefs.github_token);
    
    // 使用 token 调用 GitHub API...
}
```

**修改为（使用公开 API，无需 token）：**

```rust
pub async fn check_update() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::new();
    
    // GitHub Releases API（公开，无需认证）
    let response = client
        .get("https://api.github.com/repos/jiweiyeah/Skills-Manager/releases/latest")
        .header("User-Agent", "Skills-Manager")
        .send()
        .await
        .map_err(|e| format!("Failed to check update: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API returned: {}", response.status()));
    }
    
    let release: GithubRelease = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let current_version = env!("CARGO_PKG_VERSION");
    
    Ok(UpdateInfo {
        available: is_newer_version(&release.tag_name, current_version),
        latest_version: release.tag_name,
        download_url: release.assets.first()
            .map(|a| a.browser_download_url.clone()),
        release_notes: release.body,
    })
}

#[derive(serde::Deserialize)]
struct GithubRelease {
    tag_name: String,
    body: Option<String>,
    assets: Vec<GithubAsset>,
}

#[derive(serde::Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

fn is_newer_version(remote: &str, local: &str) -> bool {
    // 简单的版本比较（可以用 semver crate 更严谨）
    let remote_ver = remote.trim_start_matches('v');
    let local_ver = local.trim_start_matches('v');
    
    remote_ver > local_ver
}
```

**注意：** 这个改造可选，如果 updater.rs 不依赖云功能，可以保持不变。

#### 2.6.3 src-tauri/src/services/marketplace.rs

**当前问题：** 调用后端 API `https://skills-market-api.guardssl.info/api/v1`

**需要检查依赖：**
```bash
grep -n "skills-market-api\|guardssl" src-tauri/src/services/marketplace.rs
```

**如果调用了后端 API，需要改造为本地抓取：**

选项 A：从配置的公开源抓取（推荐）
```rust
// 只保留从 marketplace_sources 配置的源抓取
// 移除所有对 skills-market-api.guardssl.info 的调用

pub async fn fetch_marketplace_skills(
    config: &AppConfig,
) -> Result<Vec<MarketplaceSkill>, String> {
    let sources = config
        .marketplace_sources
        .as_ref()
        .ok_or("No marketplace sources configured")?;
    
    let mut all_skills = Vec::new();
    
    for source in sources {
        if !source.enabled {
            continue;
        }
        
        match source.source_type {
            SourceType::Crawler => {
                // 从 skills.sh 或 GitHub 爬取
                let skills = fetch_from_web(&source.url).await?;
                all_skills.extend(skills);
            }
        }
    }
    
    Ok(all_skills)
}

async fn fetch_from_web(url: &str) -> Result<Vec<MarketplaceSkill>, String> {
    // 实现网页抓取逻辑
    // 或者从 GitHub Awesome 列表解析
}
```

选项 B：完全移除 Marketplace（如果改造复杂）
```rust
// 返回空列表或错误提示
pub async fn fetch_marketplace_skills(
    _config: &AppConfig,
) -> Result<Vec<MarketplaceSkill>, String> {
    Err("Marketplace feature is being rebuilt. Please check back later.".to_string())
}
```

**推荐：选项 A**，保留 Marketplace 浏览功能，但改为从公开源抓取。

---

## 🗂️ PART 3: 前端文件删除清单（14 个文件）

### 云同步相关（9 个文件）

```bash
# 云同步组件
rm src/components/cloud/CloudSyncConflictDialog.tsx
rm src/components/cloud/VaultConsentDialog.tsx

# 云同步 Hook
rm src/hooks/useCloudSyncAgent.tsx

# 云同步服务
rm src/services/cloudSync.ts
rm src/services/cloudSyncSettingsOptions.ts
rm src/services/cloudSyncSettingsOptions.test.ts
rm src/services/cloudSyncSettingsStore.ts
rm src/services/cloudSyncSettingsStore.test.ts
rm src/services/cloudSyncUtils.ts
rm src/services/cloudSyncWorkflow.ts

# 云同步测试
rm src/services/__tests__/cloudSyncUtils.test.ts
```

### 认证相关（5 个文件）

```bash
# 认证服务
rm src/services/auth.ts
rm src/services/authError.ts
rm src/services/authError.test.ts
rm src/services/authProfileStore.ts
rm src/services/authProfileStore.test.ts
```

**总计删除：14 个前端文件**

---

## 📝 PART 4: 前端文件修改清单（4 个文件）

### 4.1 src/App.tsx

**需要删除的代码：**

#### 删除遥测初始化（第 102-107 行）

```diff
-       void invoke("telemetry_initialize").catch(() => {
-           // Silent fail
-       });
-       void invoke("telemetry_clear_local_data").catch(() => {
-           // Silent fail
-       });
```

#### 删除遥测 effect（第 138-169 行）

```diff
-   useEffect(() => {
-       void invoke("telemetry_initialize").catch(() => {
-           // Silent fail
-       });
-       
-       const heartbeatInterval = setInterval(() => {
-           void invoke("telemetry_flush_pending").catch(() => {});
-       }, 600_000);
-       
-       const recordHeartbeat = setInterval(() => {
-           void invoke("telemetry_record_heartbeat").catch(() => {});
-       }, 60_000);
-       
-       const flushOnUnload = () => {
-           void invoke("telemetry_flush_pending").catch(() => {});
-       };
-       
-       const endSessionOnUnload = async (reason: string) => {
-           try {
-               await invoke("telemetry_end_session", { reason });
-           } catch {
-               // Silent fail
-           }
-       };
-       
-       window.addEventListener("beforeunload", flushOnUnload);
-       
-       return () => {
-           clearInterval(heartbeatInterval);
-           clearInterval(recordHeartbeat);
-           window.removeEventListener("beforeunload", flushOnUnload);
-           void endSessionOnUnload("app_close");
-       };
-   }, []);
```

#### 删除深度链接相关（OAuth 回调）

查找是否有 `auth:deep-link-argv` 相关的监听器，如果有则删除。

---

### 4.2 src/pages/Settings.tsx

**需要删除的代码：**

#### 删除遥测设置部分（约第 170-176 行）

```diff
-       void invoke("telemetry_initialize").catch((err) => {
-           console.error("Failed to initialize telemetry:", err);
-       });
-       void invoke("telemetry_clear_local_data").catch((err) => {
-           console.error("Failed to clear telemetry data:", err);
-       });
```

#### 删除云同步设置卡片

查找包含 "云同步" 或 "Cloud Sync" 的 UI 部分，删除整个卡片组件。

#### 删除 Vault 同意对话框

查找 `VaultConsentDialog` 组件引用，删除。

#### 删除认证相关 UI

查找用户头像、登录按钮等，删除。

#### 添加 Pro 功能占位（新增代码）

```tsx
{/* Pro 功能占位 */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <CloudIcon className="h-5 w-5" />
      {t("settings.pro_features")}
    </CardTitle>
    <CardDescription>
      {t("settings.pro_features_desc")}
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
      <h3 className="font-semibold mb-2">☁️ {t("settings.cloud_sync")}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t("settings.cloud_sync_desc")}
      </p>
      <Badge variant="secondary">{t("settings.coming_soon")}</Badge>
    </div>
    
    <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
      <h3 className="font-semibold mb-2">👥 {t("settings.team_collaboration")}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t("settings.team_collaboration_desc")}
      </p>
      <Badge variant="secondary">{t("settings.coming_soon")}</Badge>
    </div>
  </CardContent>
</Card>
```

---

### 4.3 src/components/layout/Sidebar.tsx

**需要删除的代码：**

#### 删除用户头像/认证按钮

查找 `AuthContext`、`useAuth`、用户头像等相关代码，删除。

#### 删除云同步状态指示器

查找云同步相关的状态指示（如同步中、已同步等），删除。

---

### 4.4 src/types/index.ts

**需要删除的类型定义：**

```diff
- // 认证相关类型
- export interface AuthSession { ... }
- export interface AuthProfile { ... }
- export interface AuthStartResult { ... }
- export interface AuthMeResponse { ... }

- // 云同步相关类型
- export interface CloudSyncPayload { ... }
- export interface CloudSyncSnapshot { ... }
- export interface CloudSyncPushResult { ... }
- export interface CloudSyncState { ... }

- // 投票相关类型
- export interface Poll { ... }
- export interface PollOption { ... }
- export interface PollClientState { ... }

- // Vault 相关类型
- export interface VaultBackupResult { ... }

- // 遥测相关类型（如果有）
```

**保留的类型：**
- ✅ Config
- ✅ Skill
- ✅ Tool
- ✅ MarketplaceSkill
- ✅ LlmProvider
- 等所有本地功能类型

---

## 📦 PART 5: 依赖清理（Cargo.toml）

### 检查可以删除的依赖

```bash
# 检查这些依赖是否只用于云功能
grep -rn "oauth2\|jsonwebtoken" src-tauri/src/ --include="*.rs" | grep -v "^src-tauri/src/commands/auth" | grep -v "^src-tauri/src/services/auth"
```

**如果只在已删除的文件中使用，可以删除：**

```diff
[dependencies]
- oauth2 = "4.4"           # 如果只用于 OAuth 认证
- jsonwebtoken = "9.2"     # 如果只用于 token 验证
```

**保留的依赖：**
- ✅ reqwest（Marketplace 抓取仍需要）
- ✅ serde, serde_json
- ✅ tauri
- ✅ tokio
- 等所有本地功能依赖

---

## 📚 PART 6: 开源文档创建（5 个新文件）

### 6.1 README.md

**位置：** 项目根目录

**内容框架：**

```markdown
<div align="center">
  <h1>Skills Manager</h1>
  <p><strong>统一管理多个 AI 编程助手的 Skills</strong></p>
  <p>Community Edition</p>
  
  <img src="https://img.shields.io/github/stars/jiweiyeah/Skills-Manager?style=social" />
  <img src="https://img.shields.io/github/license/jiweiyeah/Skills-Manager" />
  <img src="https://img.shields.io/github/v/release/jiweiyeah/Skills-Manager" />
</div>

## ✨ 特性

### 核心功能（永久免费）

- 🔗 **统一管理** - 一处编写 Skills，多处使用
- 🔄 **软链接同步** - 自动同步到 Claude Code、Codex 等
- 📝 **内置编辑器** - Monaco Editor 支持
- 🌐 **AI 翻译** - 支持 OpenAI 兼容 API（用户自带 Key）
- 🛠️ **工具检测** - 自动检测已安装的 AI 助手
- 🛍️ **Marketplace** - 浏览和安装社区 Skills
- 🎨 **主题切换** - 亮色/暗色主题
- 🌍 **多语言** - 中文/英文

### Pro 功能（开发中）

以下功能计划在后端服务完善后推出：

- ⏳ **云同步** - 多设备无缝同步
- ⏳ **团队协作** - Skills 共享与权限管理
- ⏳ **无限翻译** - AI 翻译无速率限制
- ⏳ **使用分析** - 深度洞察

> Pro 版本将提供开箱即用的云服务，无需自己搭建后端。

## 🚀 安装

### macOS
```bash
# Homebrew (即将支持)
brew install skills-manager

# 或下载 DMG
# https://github.com/jiweiyeah/Skills-Manager/releases
```

### Windows
```bash
# Scoop (即将支持)
scoop install skills-manager

# 或下载 MSI 安装包
# https://github.com/jiweiyeah/Skills-Manager/releases
```

### Linux
```bash
# 下载 AppImage
# https://github.com/jiweiyeah/Skills-Manager/releases
chmod +x skills-manager.AppImage
./skills-manager.AppImage
```

## 📖 快速开始

1. **首次启动**
   - 选择公共 Skills 目录（推荐 `~/.skills-manager/skills`）
   - 检测已安装的 AI 工具

2. **管理 Skills**
   - 在公共目录创建或导入 Skills
   - 为每个工具启用/禁用 Skills
   - Skills Manager 自动创建软链接

3. **浏览 Marketplace**
   - 发现社区分享的 Skills
   - 一键安装到本地

## 🏗️ 架构

```
┌─────────────────────────────────────┐
│  ~/.skills-manager/skills/          │  公共 Skills 目录
│  ├── skill-a/                       │
│  ├── skill-b/                       │
│  └── skill-c/                       │
└─────────────────────────────────────┘
              │
              │ 软链接
              ▼
┌─────────────────────────────────────┐
│  ~/.claude/skills/                  │  Claude Code
│  ├── skill-a → (软链接)             │
│  └── skill-b → (软链接)             │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ~/.codex/skills/                   │  Codex
│  ├── skill-b → (软链接)             │
│  └── skill-c → (软链接)             │
└─────────────────────────────────────┘
```

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/jiweiyeah/Skills-Manager.git
cd Skills-Manager

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建
npm run tauri build
```

### 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4
- **桌面**: Tauri 2.0
- **编辑器**: Monaco Editor
- **路由**: React Router 7

## 🤝 贡献

我们欢迎所有形式的贡献！

- 🐛 [报告 Bug](https://github.com/jiweiyeah/Skills-Manager/issues)
- 💡 [功能建议](https://github.com/jiweiyeah/Skills-Manager/issues)
- 🔧 [提交代码](https://github.com/jiweiyeah/Skills-Manager/pulls)

详细指南请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 许可证

本项目采用 [MIT License](LICENSE)。

核心功能永久免费开源，Pro 功能需要有效许可证。

## 🙏 致谢

感谢以下开源项目：
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/jiweiyeah">@jiweiyeah</a>
</div>
```

---

### 6.2 LICENSE

**位置：** 项目根目录

**内容：** MIT License

```
MIT License

Copyright (c) 2024-present jiweiyeah

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 6.3 CONTRIBUTING.md

**位置：** 项目根目录

**内容：** 参考 `docs/OPEN_SOURCE_STRATEGY.md` 中的贡献指南模板

**关键部分：**
- 开发流程（Fork → Clone → 创建分支 → 开发 → 测试 → PR）
- 代码规范（Rust: rustfmt + clippy, TypeScript: ESLint + Prettier）
- 提交规范（Conventional Commits）
- PR 模板

---

### 6.4 SECURITY.md

**位置：** 项目根目录

**内容：**

```markdown
# 安全政策

## 报告安全漏洞

如果你发现了安全漏洞，请 **不要** 公开提交 Issue。

请发送邮件到：security@skills-manager.com（或你的个人邮箱）

包含以下信息：
- 漏洞描述
- 重现步骤
- 影响范围
- 可能的修复方案（如果有）

我们会在 **48 小时内** 回复你，并在 **7 天内** 发布修复。

## 支持的版本

| 版本 | 支持状态 |
|------|---------|
| 2.x  | ✅ 支持  |
| 1.x  | ⚠️ 安全更新 |
| < 1.0 | ❌ 不支持 |

## 安全最佳实践

使用 Skills Manager 时：
- ✅ 从官方源下载二进制文件
- ✅ 验证签名（macOS/Windows）
- ✅ 定期更新到最新版本
- ✅ 不要共享 API Keys
- ✅ 使用强密码保护配置文件
```

---

### 6.5 CHANGELOG.md

**位置：** 项目根目录

**内容：**

```markdown
# Changelog

所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/)，
版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### 开源发布准备中

- 准备开源 Community Edition
- Pro 功能开发中

## [2.0.3] - 2024-XX-XX

### Added
- 内部版本，准备开源

## [2.0.0] - 2024-XX-XX

### Added
- 完整重写，基于 Tauri 2.0
- React 19 前端
- Monaco Editor 集成
- AI 翻译功能
- Marketplace 支持

[Unreleased]: https://github.com/jiweiyeah/Skills-Manager/compare/v2.0.3...HEAD
[2.0.3]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.3
[2.0.0]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.0
```

---

## ✅ PART 7: 验证清单

完成所有修改后，按以下顺序验证：

### 7.1 编译验证

```bash
# 1. 清理构建缓存
cd src-tauri
cargo clean

# 2. 编译 Rust 后端
cargo build --release

# 预期结果：✅ 编译成功，无错误

# 3. 运行 Rust 测试
cargo test

# 预期结果：✅ 所有测试通过

# 4. 检查 Clippy 警告
cargo clippy -- -D warnings

# 预期结果：✅ 无警告
```

### 7.2 前端验证

```bash
cd ..  # 回到项目根目录

# 1. 类型检查
npm run typecheck

# 预期结果：✅ 无类型错误

# 2. 编译前端
npm run build

# 预期结果：✅ 构建成功

# 3. Lint 检查
npm run lint

# 预期结果：✅ 无 lint 错误
```

### 7.3 完整构建

```bash
# 构建完整的桌面应用
npm run tauri build

# 预期结果：✅ 生成安装包
# macOS: target/release/bundle/dmg/
# Windows: target/release/bundle/msi/
# Linux: target/release/bundle/appimage/
```

### 7.4 手动功能测试

启动应用并测试：

```bash
npm run tauri dev
```

**测试清单：**

- [ ] 应用启动成功
- [ ] 欢迎流程正常（首次启动）
- [ ] 扫描 Skills 正常
- [ ] 启用/禁用 Skill 正常
- [ ] 软链接创建成功
- [ ] 内置编辑器打开正常
- [ ] AI 翻译功能正常（用户提供 API Key）
- [ ] Marketplace 浏览正常
- [ ] Marketplace 安装 Skill 正常
- [ ] 工具检测正常
- [ ] 设置页面正常
- [ ] 无云同步相关 UI
- [ ] 无认证相关 UI
- [ ] 无遥测相关 UI
- [ ] Pro 功能占位显示正常

### 7.5 搜索残留引用

```bash
# 搜索是否有遗漏的云功能引用
grep -rn "auth\|cloud_sync\|telemetry\|poll\|vault" src/ src-tauri/src/ \
  --include="*.rs" --include="*.ts" --include="*.tsx" \
  | grep -v "// " \
  | grep -v "github_token" \
  | grep -v "authenticate" \
  | head -50

# 预期结果：✅ 无残留引用（或只有注释）
```

### 7.6 Git 提交检查

```bash
# 查看所有改动
git status
git diff --stat

# 预期改动统计：
# - 删除约 27 个文件
# - 修改约 10 个文件
# - 新增约 5 个文档
```

---

## 📊 改动统计总结

| 类别 | 删除 | 修改 | 新增 | 总计 |
|------|------|------|------|------|
| **Rust 后端** |
| 命令文件 | 5 | 1 | 0 | 6 |
| 服务文件 | 4 | 1 | 0 | 5 |
| 模型文件 | 2 | 2 | 0 | 4 |
| 入口文件 | 0 | 1 | 0 | 1 |
| **TypeScript 前端** |
| 组件 | 2 | 0 | 0 | 2 |
| Hooks | 1 | 0 | 0 | 1 |
| 服务 | 10 | 0 | 0 | 10 |
| 页面 | 0 | 2 | 0 | 2 |
| 类型 | 0 | 1 | 0 | 1 |
| 应用入口 | 0 | 1 | 0 | 1 |
| **文档** |
| 开源文档 | 0 | 0 | 5 | 5 |
| **配置** |
| Cargo.toml | 0 | 1 | 0 | 1 |
| **总计** | **27** | **10** | **5** | **42** |

**代码行数变化：**
- 删除：约 3,000-4,000 行
- 修改：约 200-300 行
- 新增：约 500-600 行（文档）

---

## 🎯 执行建议

### 建议的执行顺序

**Phase 1: 备份（10 分钟）**
1. 创建新分支 `feat/opensource-cleanup`
2. 备份云功能代码到 `.private-features/`
3. 提交备份到 git

**Phase 2: 后端清理（1.5 小时）**
1. 删除命令文件（auth, cloud_sync, polls, telemetry, vault）
2. 删除服务文件
3. 删除模型文件
4. 修改 `commands/mod.rs`
5. 修改 `services/mod.rs`
6. 修改 `models/mod.rs`
7. 修改 `lib.rs`
8. 修改 `config.rs`
9. 编译测试

**Phase 3: 功能改造（1 小时）**
1. 改造 `feedback.rs`
2. 改造 `updater.rs`（如果需要）
3. 改造 `marketplace.rs`（如果需要）
4. 编译测试

**Phase 4: 前端清理（1 小时）**
1. 删除云同步文件
2. 删除认证文件
3. 修改 `App.tsx`
4. 修改 `Settings.tsx`
5. 修改 `Sidebar.tsx`
6. 修改 `types/index.ts`
7. 添加 Pro 功能占位
8. 编译测试

**Phase 5: 文档创建（1.5 小时）**
1. 创建 README.md
2. 创建 LICENSE
3. 创建 CONTRIBUTING.md
4. 创建 SECURITY.md
5. 创建 CHANGELOG.md

**Phase 6: 完整验证（1 小时）**
1. 编译验证
2. 测试验证
3. 手动功能测试
4. 搜索残留引用
5. Git 提交

**总预计时间：约 6-7 小时**

---

## 📝 下一步

现在你有两个选择：

**选项 A：立即开始执行**
- 我可以帮你逐步执行每个阶段
- 每完成一个阶段就提交一次
- 边做边测试

**选项 B：先审阅清单**
- 你先仔细审阅这份完整清单
- 确认所有改动都符合预期
- 确定执行时间后再开始

**选项 C：分阶段执行**
- 今天只做后端清理
- 明天做前端清理
- 后天做文档和验证

我推荐**选项 C**：分 3 天执行，每天 2-3 小时，不会太累，而且每个阶段都可以充分测试。

你想选择哪个方案？
