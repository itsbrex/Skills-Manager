# Skills Manager 开源准备计划 - 清理版

## 📋 策略调整

### ✅ 新策略
1. **私有仓库准备** - 在 `skills-manager-private` 完成所有开源准备
2. **功能清理** - 移除云同步、遥测等后端依赖功能
3. **同步到公共仓库** - 准备完毕后推送到 `Skills-Manager`
4. **后续接入** - 后端服务完善后再添加 Pro 功能

### 移除的功能模块
以下功能将在开源版本中**完全移除**，等后端准备好再作为 Pro 功能接入：

- ❌ 云同步（`cloud_sync.rs`）
- ❌ OAuth 认证（`auth.rs`）
- ❌ 遥测上报（`telemetry.rs`）
- ❌ 投票功能（`polls.rs`）
- ❌ Vault 备份（`vault.rs`）

### 保留的功能模块
这些功能是核心价值，完全开源：

- ✅ Skills 管理（`scanner.rs`, `skills.rs`）
- ✅ 软链接同步（`sync.rs`）
- ✅ 工具检测（`tools.rs`）
- ✅ 本地配置（`config.rs`）
- ✅ 编辑器功能（`editor.rs`）
- ✅ AI 翻译（`llm.rs` - 用户自带 API Key）
- ✅ Marketplace 浏览（`marketplace.rs` - 只读模式）

---

## 🗂️ 代码清理清单

### Phase 1: 识别需要移除的模块

**Rust 后端（src-tauri/src/）：**

```bash
# 需要完全删除的文件
src-tauri/src/commands/cloud_sync.rs
src-tauri/src/commands/auth.rs
src-tauri/src/commands/telemetry.rs
src-tauri/src/commands/polls.rs
src-tauri/src/commands/vault.rs

src-tauri/src/services/cloud_sync.rs
src-tauri/src/services/auth.rs
src-tauri/src/services/telemetry.rs

src-tauri/src/models/auth.rs
src-tauri/src/models/cloud_sync.rs
```

**TypeScript 前端（src/）：**

```bash
# 需要删除或简化的文件
src/contexts/AuthContext.tsx          # 删除
src/contexts/CloudSyncContext.tsx      # 删除
src/pages/CloudSync.tsx                # 删除（或改为功能介绍页）
src/components/CloudSyncButton.tsx     # 删除
```

### Phase 2: 清理配置模型

**`src-tauri/src/models/config.rs` 需要移除的字段：**

```rust
// 移除这些字段
pub struct AppConfig {
    // ... 保留的字段
    
    // ❌ 移除
    // pub auth_session: Option<AuthSession>,
    // pub cloud_sync: Option<CloudSyncState>,
    // pub poll_client_state: Option<PollClientState>,
}

// ❌ 移除这些偏好设置
pub struct UserPreferences {
    // ❌ 移除
    // pub cloud_sync_auto: bool,
    // pub cloud_sync_interval_minutes: u32,
    // pub vault_backup_consent: VaultBackupConsent,
    // pub telemetry_consent: TelemetryConsent,
}
```

### Phase 3: 清理命令注册

**`src-tauri/src/commands/mod.rs` 清理：**

```rust
// ❌ 移除这些模块引用
// pub mod auth;
// pub mod cloud_sync;
// pub mod polls;
// pub mod telemetry;
// pub mod vault;
```

**`src-tauri/src/lib.rs` 清理 Tauri 命令：**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // 保留
            commands::config::get_config,
            commands::config::save_config,
            commands::skills::list_skills,
            commands::editor::read_file,
            commands::llm::translate_text,
            commands::marketplace::list_marketplace_skills,
            // ... 其他本地功能
            
            // ❌ 移除所有云功能
            // commands::auth::start_github_auth,
            // commands::cloud_sync::cloud_sync_pull,
            // commands::cloud_sync::cloud_sync_push,
            // commands::telemetry::report_event,
            // commands::polls::submit_vote,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Phase 4: 清理前端调用

**需要删除的 Context Providers：**

```typescript
// src/App.tsx - 移除这些 Provider
<AuthProvider>           // ❌ 删除
  <CloudSyncProvider>    // ❌ 删除
    <App />
  </CloudSyncProvider>
</AuthProvider>
```

**需要清理的页面导航：**

```typescript
// src/routes.tsx
const routes = [
  { path: '/', element: <Skills /> },
  { path: '/marketplace', element: <Marketplace /> },
  { path: '/settings', element: <Settings /> },
  // ❌ 移除
  // { path: '/cloud-sync', element: <CloudSync /> },
];
```

### Phase 5: Marketplace 只读模式

**保留 Marketplace 浏览功能，但移除投票、云端数据：**

```rust
// src-tauri/src/services/marketplace.rs

// ✅ 保留：列出 Skills（从配置的源抓取）
pub async fn list_skills() -> Result<Vec<MarketplaceSkill>> {
    // 从 skills.sh、GitHub 等公开源抓取
}

// ✅ 保留：下载 Skill 到本地
pub async fn install_skill(id: &str) -> Result<()> {
    // 下载到本地 skills 目录
}

// ❌ 移除：投票功能
// pub async fn submit_vote() -> Result<()> { }

// ❌ 移除：从云端拉取投票数据
// pub async fn fetch_poll_results() -> Result<()> { }
```

### Phase 6: 清理 Cargo.toml 依赖

**移除不再需要的依赖：**

```toml
[dependencies]
# ❌ 可以移除（如果只用于云功能）
# oauth2 = "..."  # 如果只用于云认证
# jsonwebtoken = "..."  # 如果只用于云 token

# ✅ 保留
reqwest = { version = "0.11", features = ["json"] }  # Marketplace 抓取仍需要
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "2.0", features = ["..." ] }
# ... 其他本地功能依赖
```

---

## 🔧 实施步骤

### Step 1: 创建清理分支

```bash
git checkout -b feat/opensource-cleanup
```

### Step 2: 备份云功能代码

```bash
# 将云功能代码备份到单独的目录
mkdir -p .private-features/cloud-sync
cp -r src-tauri/src/commands/cloud_sync.rs .private-features/cloud-sync/
cp -r src-tauri/src/commands/auth.rs .private-features/cloud-sync/
cp -r src-tauri/src/commands/telemetry.rs .private-features/cloud-sync/
cp -r src-tauri/src/commands/polls.rs .private-features/cloud-sync/
cp -r src-tauri/src/commands/vault.rs .private-features/cloud-sync/
cp -r src-tauri/src/services/cloud_sync.rs .private-features/cloud-sync/
cp -r src-tauri/src/services/auth.rs .private-features/cloud-sync/
cp -r src-tauri/src/services/telemetry.rs .private-features/cloud-sync/

# 加入 .gitignore
echo ".private-features/" >> .gitignore
```

### Step 3: 删除后端云功能

```bash
# 删除命令文件
rm src-tauri/src/commands/cloud_sync.rs
rm src-tauri/src/commands/auth.rs
rm src-tauri/src/commands/telemetry.rs
rm src-tauri/src/commands/polls.rs
rm src-tauri/src/commands/vault.rs

# 删除服务文件
rm src-tauri/src/services/cloud_sync.rs
rm src-tauri/src/services/auth.rs
rm src-tauri/src/services/telemetry.rs

# 删除模型文件
rm src-tauri/src/models/auth.rs
rm src-tauri/src/models/cloud_sync.rs
```

### Step 4: 清理模块引用

我会帮你修改这些文件：
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/services/mod.rs`
- `src-tauri/src/models/mod.rs`
- `src-tauri/src/lib.rs`

### Step 5: 清理配置模型

修改 `src-tauri/src/models/config.rs`，移除云相关字段。

### Step 6: 删除前端云功能

```bash
# 删除 Context
rm src/contexts/AuthContext.tsx
rm src/contexts/CloudSyncContext.tsx

# 删除页面
rm src/pages/CloudSync.tsx

# 删除组件
rm src/components/CloudSyncButton.tsx
```

### Step 7: 更新前端路由和 UI

修改相关导入和路由配置。

### Step 8: 测试构建

```bash
# 测试 Rust 编译
cd src-tauri
cargo build
cargo test

# 测试前端
cd ..
npm run build
npm run tauri build
```

### Step 9: 创建 Pro 功能占位页

在设置页面添加 Pro 功能介绍：

```typescript
// src/pages/Settings.tsx
<Card>
  <CardHeader>
    <CardTitle>☁️ 云同步（Pro 功能）</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground mb-4">
      多设备无缝同步您的 Skills 配置
    </p>
    <Button disabled>
      即将推出
    </Button>
  </CardContent>
</Card>
```

---

## 📝 开源文档准备

### 创建文档清单

- [ ] README.md（说明这是 Community Edition）
- [ ] LICENSE（MIT）
- [ ] CONTRIBUTING.md
- [ ] SECURITY.md
- [ ] docs/ROADMAP.md（说明 Pro 功能计划）
- [ ] docs/ARCHITECTURE.md（技术架构）

### README.md 关键部分

```markdown
## 版本说明

这是 **Skills Manager Community Edition**，包含所有核心本地功能。

### 当前功能
- ✅ Skills 统一管理
- ✅ 软链接自动同步
- ✅ 内置编辑器
- ✅ AI 翻译（自带 API Key）
- ✅ 工具检测
- ✅ Marketplace 浏览

### 计划中的 Pro 功能
- ⏳ 云同步（开发中）
- ⏳ 团队协作（开发中）
- ⏳ 使用分析（开发中）

Pro 版本将在后端服务完善后推出，敬请期待！
```

---

## ⏱️ 时间估算

| 任务 | 预计时间 |
|-----|---------|
| 备份云功能代码 | 10 分钟 |
| 删除后端文件 | 5 分钟 |
| 清理模块引用 | 30 分钟 |
| 清理配置模型 | 20 分钟 |
| 删除前端文件 | 10 分钟 |
| 更新前端路由 | 20 分钟 |
| 测试构建 | 30 分钟 |
| 创建文档 | 2 小时 |
| **总计** | **约 4 小时** |

---

## ✅ 验收标准

完成后应该满足：

1. **编译通过**
   ```bash
   cargo build --release  # ✅ 无错误
   npm run build          # ✅ 无错误
   ```

2. **功能正常**
   - ✅ 可以扫描和管理本地 Skills
   - ✅ 可以创建软链接
   - ✅ 可以使用编辑器
   - ✅ 可以使用 AI 翻译（用户提供 Key）
   - ✅ 可以浏览 Marketplace
   - ❌ 没有云同步相关 UI
   - ❌ 没有认证功能
   - ❌ 没有遥测上报

3. **代码干净**
   - ✅ 无未使用的导入
   - ✅ 无编译警告
   - ✅ 所有测试通过

4. **文档完整**
   - ✅ README 说明清晰
   - ✅ LICENSE 存在
   - ✅ 贡献指南完整

---

## 🎯 下一步

现在我可以帮你：

1. **立即开始清理** - 按步骤执行代码删除
2. **先看具体影响** - 分析哪些文件会受影响
3. **生成文档** - 先准备 README、LICENSE 等

你想从哪一步开始？
