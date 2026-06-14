# Skills Manager 开源策略与实施计划

## 📊 当前情况评估

### ✅ 已完成
- 公共仓库已有 **797 stars**，市场验证良好
- `.gitignore` 已排除用户配置 (`.claude/`)
- 代码中无硬编码密钥（都是配置字段）
- 有安全测试保证敏感信息不泄露（`build_payload_excludes_llm_provider`）

### ⚠️ 需要处理的问题

**1. 后端服务 API 地址暴露**

当前硬编码的服务：
```
https://skills-market-api.guardssl.info/api/v1
```

涉及模块：
- `auth.rs` - GitHub/Google OAuth 认证
- `cloud_sync.rs` - 云同步 (pull/push/resolve)
- `polls.rs` - 投票功能
- `telemetry.rs` - 使用统计
- `marketplace.rs` - Skill 市场
- `vault.rs` - Skill 存储

**2. 云同步逻辑完全可见**

开源后任何人都能看到云同步的实现细节，可能被修改绕过付费检查。

---

## 🎯 解决方案：三层防护架构

### 参考成功案例

| 项目 | 策略 | 借鉴点 |
|------|------|--------|
| **GitLab** | 开源核心 + `ee/` 企业版目录 | 代码分层清晰 |
| **n8n** | Feature Flag 控制 | 同一代码库，许可证控制 |
| **Supabase** | 客户端开源 + 服务端闭源 | 安全边界明确 |
| **Plausible** | AGPL-3.0 防云服务商白嫖 | 自托管免费 |

### 推荐架构

```
┌─────────────────────────────────────────┐
│   Community Edition (开源)               │
├─────────────────────────────────────────┤
│ ✅ Skills 管理（完全开源）               │
│ ✅ 软链接同步（完全开源）               │
│ ✅ 内置编辑器（完全开源）               │
│ ✅ AI 翻译（用户自带 API Key）          │
│ ✅ 工具检测（完全开源）                 │
│ ✅ 本地配置管理（完全开源）             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   Pro Edition (付费功能)                 │
├─────────────────────────────────────────┤
│ 🔒 云同步服务端（你的后端，闭源）       │
│ 🔒 License 验证（客户端模块，开源但需激活）│
│ 🔒 团队协作功能（Feature Flag 控制）    │
│ 🔒 高级 AI 功能（无限翻译等）           │
└─────────────────────────────────────────┘
```

---

## 📋 实施计划

### Phase 1: 代码重构（开源前准备）✅

#### 1.1 添加 License 模型到 AppConfig

需要在 `src-tauri/src/models/config.rs` 中添加：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub edition: Edition,
    pub license_key: Option<String>,
    pub expires_at: Option<i64>,
    pub features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Edition {
    Community,
    Pro,
}

impl LicenseInfo {
    pub fn is_valid(&self) -> bool {
        match self.expires_at {
            None => true, // 永久许可
            Some(ts) => {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                ts > now
            }
        }
    }
}
```

然后在 `AppConfig` 中添加字段：
```rust
pub struct AppConfig {
    // ... 现有字段
    #[serde(default)]
    pub license: Option<LicenseInfo>,
}
```

#### 1.2 创建 Feature Flag 系统 ✅

已创建 `src-tauri/src/features.rs`，提供：
- `Feature` 枚举（定义所有付费功能）
- `is_feature_enabled()` 函数（检查功能是否可用）

#### 1.3 保护云同步功能

**策略：客户端开源 + 服务端闭源 + License 验证**

**修改 `cloud_sync.rs` 命令层：**

```rust
#[tauri::command]
pub async fn cloud_sync_pull() -> Result<CloudSyncSnapshot, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    
    // ✅ 检查 License（开源代码，但需要有效许可证）
    if !crate::features::is_feature_enabled(
        crate::features::Feature::CloudSync,
        config.license.as_ref()
    ) {
        return Err("Cloud sync requires Pro license".to_string());
    }
    
    // ... 其余逻辑保持不变
}
```

**关键点**：
- ✅ **客户端逻辑开源**：代码可见，增强信任
- 🔒 **服务端验证**：你的后端 API 再次验证 License
- 🔒 **License Key 验证**：通过你的服务器验证

#### 1.4 保护后端 API 地址

**当前问题**：
```rust
const DEFAULT_AUTH_API_BASE: &str = "https://skills-market-api.guardssl.info/api/v1";
```

**解决方案 A：环境变量 + 编译时配置（推荐）**

```rust
// 开源版本使用占位符
#[cfg(not(feature = "production"))]
const DEFAULT_AUTH_API_BASE: &str = "https://api.example.com/v1";

// 生产构建时注入真实地址
#[cfg(feature = "production")]
const DEFAULT_AUTH_API_BASE: &str = env!("SKILLS_API_BASE");
```

然后在 CI 构建时：
```bash
SKILLS_API_BASE=https://skills-market-api.guardssl.info/api/v1 \
  cargo build --release --features production
```

**解决方案 B：动态配置（更灵活）**

将 API 地址移到配置文件，允许用户自定义：
```rust
fn api_base_url(config: &AppConfig) -> String {
    config.preferences
        .as_ref()
        .and_then(|p| p.cloud_sync_api_url.clone())
        .unwrap_or_else(|| DEFAULT_AUTH_API_BASE.to_string())
}
```

**推荐：方案 A + 方案 B 结合**
- 开源代码使用示例 URL
- 官方构建时注入真实 URL
- 用户可通过配置覆盖（支持自托管）

---

### Phase 2: 后端 API 保护机制

#### 2.1 API 访问控制

**在你的后端实现：**

```typescript
// 伪代码示例
async function handleCloudSyncRequest(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  
  // 1. 验证 OAuth token
  const user = await verifyOAuthToken(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  // 2. 检查 License
  const license = await getLicense(user.id);
  if (!license || !license.has_feature('cloud_sync')) {
    return Response.json({ 
      error: 'Pro license required',
      upgrade_url: 'https://skills-manager.com/pricing'
    }, { status: 403 });
  }
  
  // 3. 速率限制
  const rateLimit = await checkRateLimit(user.id, 'cloud_sync');
  if (rateLimit.exceeded) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  // 4. 执行实际操作
  return handleSync(user, req.body);
}
```

#### 2.2 License 验证服务

**新增 License 验证端点：**

```
POST /api/v1/licenses/verify
{
  "license_key": "SM-PRO-XXXXX"
}

Response:
{
  "valid": true,
  "edition": "pro",
  "expires_at": 1735689600,
  "features": ["cloud_sync", "unlimited_translation", "team_collaboration"]
}
```

#### 2.3 防止 API 滥用

**策略清单：**
- ✅ OAuth 认证（已实现）
- ✅ License 验证（需添加）
- ✅ 速率限制（IP + 用户双重限制）
- ✅ Cloudflare 保护（DDoS 防护）
- ✅ API Key 签名（防篡改）
- ✅ 请求日志审计

---

### Phase 3: 开源准备

#### 3.1 创建开源文档

需要创建的文件：

**1. README.md**（见下方）
**2. LICENSE**（推荐 MIT）
**3. CONTRIBUTING.md**（贡献指南）
**4. CODE_OF_CONDUCT.md**（行为准则）
**5. SECURITY.md**（安全政策）

#### 3.2 创建 README.md

**推荐结构（参考 n8n, Supabase）：**

```markdown
<div align="center">
  <img src="assets/logo.png" alt="Skills Manager" width="200"/>
  <h1>Skills Manager</h1>
  <p>
    <strong>统一管理多个 AI 编程助手的 Skills</strong>
  </p>
  <p>
    <a href="#特性">特性</a> •
    <a href="#安装">安装</a> •
    <a href="#使用">使用</a> •
    <a href="#贡献">贡献</a> •
    <a href="#pro-版本">Pro 版本</a>
  </p>
  
  <img src="https://img.shields.io/github/stars/jiweiyeah/skills-manager-private?style=social" />
  <img src="https://img.shields.io/github/license/jiweiyeah/skills-manager-private" />
  <img src="https://img.shields.io/github/v/release/jiweiyeah/skills-manager-private" />
</div>

## 特性

✨ **核心功能（永久免费）**

- 🔗 **统一管理** - 一处编写 Skills，多处使用
- 🔄 **软链接同步** - 自动同步到 Claude Code、Codex 等
- 📝 **内置编辑器** - Monaco Editor 支持
- 🌐 **AI 翻译** - 支持 OpenAI 兼容 API
- 🛠️ **工具检测** - 自动检测已安装的 AI 助手
- 🎨 **主题切换** - 亮色/暗色主题
- 🌍 **多语言** - 中文/英文

💎 **Pro 功能（付费）**

- ☁️ **云同步** - 多设备无缝同步
- 👥 **团队协作** - Skills 共享与权限管理
- 🚀 **无限翻译** - 无速率限制
- 📊 **使用分析** - 深度洞察
- 🏅 **优先支持** - 技术支持优先响应

## 安装

### macOS / Linux

```bash
# Homebrew (推荐)
brew install skills-manager

# 或下载二进制文件
curl -fsSL https://get.skills-manager.com | sh
```

### Windows

```powershell
# Scoop
scoop install skills-manager

# 或下载安装包
# https://github.com/jiweiyeah/Skills-Manager/releases
```

## 快速开始

1. **首次启动**
   ```bash
   skills-manager
   ```

2. **选择公共 Skills 目录**
   推荐：`~/.skills-manager/skills`

3. **导入现有 Skills**（可选）
   从 Claude Code、Codex 等工具导入

## 架构

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

## 贡献

我们欢迎所有形式的贡献！

- 🐛 **报告 Bug** - [提交 Issue](https://github.com/jiweiyeah/Skills-Manager/issues)
- 💡 **功能建议** - [提交 Feature Request](https://github.com/jiweiyeah/Skills-Manager/issues)
- 🔧 **提交代码** - 查看 [CONTRIBUTING.md](CONTRIBUTING.md)

## 开发

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

## Pro 版本

Skills Manager Pro 提供企业级功能：

- ☁️ **云同步** - 无需配置后端，开箱即用
- 👥 **团队协作** - Skills 共享、权限管理
- 🚀 **无限配额** - AI 翻译、批量操作无限制
- 📊 **使用分析** - 团队效率洞察
- 🏅 **优先支持** - 24/7 技术支持

**定价：**
- 个人版：$9/月 或 $79/年
- 团队版：$29/月 或 $249/年（5 人）

[了解更多 →](https://skills-manager.com/pricing)

## 自托管 Pro 功能

想要自托管云同步服务？查看 [自托管指南](docs/SELF_HOSTING.md)。

> **注意**：自托管需要你自己搭建后端服务，适合有技术能力的团队。

## 许可证

- **Community Edition**: [MIT License](LICENSE)
- **Pro Edition**: 商业许可证

核心功能永久免费开源，Pro 功能需要有效许可证。

## 致谢

感谢以下开源项目：
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/jiweiyeah">@jiweiyeah</a>
</div>
```

#### 3.3 许可证选择

**推荐：MIT License**

**理由：**
- ✅ 最宽松，利于社区采用和贡献
- ✅ 允许商业使用和闭源修改
- ✅ 与 Tauri 生态一致
- ✅ 你可以在此基础上构建 Pro 版本
- ✅ 不限制云服务商（但你可以通过 License 控制）

**MIT License 文本：**

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

**如果担心云服务商白嫖，可选 AGPL-3.0：**
- ⚠️ 要求云服务提供者也开源修改
- ⚠️ 可能限制企业采用
- ✅ 更强的 Copyleft 保护

#### 3.4 贡献指南 CONTRIBUTING.md

```markdown
# 贡献指南

感谢你对 Skills Manager 的关注！

## 开发流程

### 1. Fork 仓库

点击右上角的 Fork 按钮。

### 2. 克隆到本地

\`\`\`bash
git clone https://github.com/YOUR_USERNAME/Skills-Manager.git
cd Skills-Manager
\`\`\`

### 3. 创建分支

\`\`\`bash
git checkout -b feat/your-feature-name
\`\`\`

分支命名规范：
- `feat/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关

### 4. 安装依赖

\`\`\`bash
npm install
cd src-tauri
cargo build
\`\`\`

### 5. 开发

\`\`\`bash
npm run tauri dev
\`\`\`

### 6. 测试

\`\`\`bash
# 前端测试
npm test

# Rust 测试
cd src-tauri
cargo test
\`\`\`

### 7. 提交代码

遵循 Conventional Commits 规范：

\`\`\`bash
git commit -m "feat: add skill export feature"
git commit -m "fix: resolve symlink creation on Windows"
\`\`\`

提交类型：
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档
- `style` - 格式（不影响代码逻辑）
- `refactor` - 重构
- `test` - 测试
- `chore` - 构建/工具链

### 8. 推送并创建 PR

\`\`\`bash
git push origin feat/your-feature-name
\`\`\`

然后在 GitHub 上创建 Pull Request。

## PR 规范

**标题格式：**
\`\`\`
feat: add AI translation caching
fix: resolve skill sync race condition
\`\`\`

**描述模板：**
\`\`\`markdown
## 变更说明
简要描述这个 PR 做了什么。

## 测试
- [ ] 本地测试通过
- [ ] 添加了单元测试
- [ ] 在 macOS 测试通过
- [ ] 在 Windows 测试通过（如适用）

## Screenshots（如果是 UI 变更）
![before](...)
![after](...)

## Checklist
- [ ] 遵循代码风格
- [ ] 更新了文档
- [ ] 通过了所有测试
- [ ] 没有引入新的警告
\`\`\`

## 代码风格

### TypeScript/React
- 使用 2 空格缩进
- 使用函数组件和 Hooks
- 遵循 ESLint 规则

### Rust
- 遵循 `rustfmt` 格式
- 运行 `cargo clippy` 检查
- 添加必要的注释

## 提问与讨论

- 💬 [Discussions](https://github.com/jiweiyeah/Skills-Manager/discussions)
- 🐛 [Issues](https://github.com/jiweiyeah/Skills-Manager/issues)

## 行为准则

请阅读 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
\`\`\`

#### 3.5 安全政策 SECURITY.md

```markdown
# 安全政策

## 报告安全漏洞

如果你发现了安全漏洞，请 **不要** 公开提交 Issue。

请发送邮件到：security@skills-manager.com

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

## 致谢

感谢以下安全研究人员的贡献：
- (将在此列出贡献者)
```

---

### Phase 4: 仓库迁移

#### 4.1 仓库策略：直接公开私有仓库（推荐）

**步骤：**

1. **备份当前代码**
   ```bash
   git clone --mirror https://github.com/jiweiyeah/skills-manager-private.git
   ```

2. **清理历史（可选，如果历史包含敏感信息）**
   ```bash
   # 使用 BFG Repo-Cleaner
   brew install bfg
   
   # 删除特定文件
   bfg --delete-files config.local.json
   
   # 或使用 git-filter-repo
   pip install git-filter-repo
   git filter-repo --path-glob '*.secret' --invert-paths
   ```

3. **公开仓库**
   ```bash
   # 方式 1：GitHub 网页端
   Settings → Danger Zone → Change visibility → Make public
   
   # 方式 2：GitHub CLI
   gh repo edit jiweiyeah/skills-manager-private --visibility public
   ```

4. **处理旧的公共仓库**
   ```bash
   # 归档旧仓库
   gh repo archive jiweiyeah/Skills-Manager
   
   # 添加 README 说明迁移
   echo "This repository has been merged into skills-manager-private" > README.md
   ```

5. **重定向 Stars（可选）**
   
   GitHub 没有直接的 Star 迁移功能，但可以：
   - 在旧仓库 README 添加醒目的迁移通知
   - 使用 GitHub Actions 定期提醒 Watchers
   - 社交媒体公告迁移

#### 4.2 更新所有引用

**需要更新的位置：**
- 所有文档中的仓库链接
- `Cargo.toml` 中的 repository 字段
- `package.json` 中的 repository 字段
- CI/CD 配置
- 下载链接

**批量替换：**
```bash
# 查找所有引用
grep -r "Skills-Manager" . --include="*.md" --include="*.json" --include="*.toml"

# 替换
find . -type f \( -name "*.md" -o -name "*.json" -o -name "*.toml" \) \
  -exec sed -i '' 's|jiweiyeah/Skills-Manager|jiweiyeah/skills-manager-private|g' {} +
```

---

### Phase 5: Pro 版本技术实现

#### 5.1 License 验证流程

**客户端检查（开源）：**

```rust
// src-tauri/src/services/license.rs
use crate::models::config::LicenseInfo;
use chrono::Utc;

pub async fn verify_license(key: &str) -> Result<LicenseInfo, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/licenses/verify", api_base_url()))
        .json(&serde_json::json!({ "license_key": key }))
        .send()
        .await
        .map_err(|e| format!("License verification failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err("Invalid license key".to_string());
    }
    
    response.json::<LicenseInfo>().await
        .map_err(|e| format!("Failed to parse license response: {}", e))
}

pub fn is_license_valid(license: &LicenseInfo) -> bool {
    match license.expires_at {
        None => true, // 永久许可
        Some(ts) => ts > Utc::now().timestamp(),
    }
}
```

**服务端验证（你的后端，闭源）：**

```typescript
// 伪代码
export async function POST(request: Request) {
  const { license_key } = await request.json();
  
  // 1. 查询数据库
  const license = await db.licenses.findUnique({
    where: { key: license_key },
    include: { user: true }
  });
  
  if (!license) {
    return Response.json({ error: 'Invalid license' }, { status: 404 });
  }
  
  // 2. 检查过期时间
  if (license.expiresAt && license.expiresAt < new Date()) {
    return Response.json({ error: 'License expired' }, { status: 403 });
  }
  
  // 3. 检查是否被禁用
  if (license.status === 'revoked') {
    return Response.json({ error: 'License revoked' }, { status: 403 });
  }
  
  // 4. 返回 License 信息
  return Response.json({
    valid: true,
    edition: 'pro',
    expires_at: license.expiresAt?.getTime() / 1000,
    features: license.features,
    user: {
      id: license.user.id,
      email: license.user.email
    }
  });
}
```

#### 5.2 付费基础设施

**必需组件：**

**1. License 管理系统**
- 数据库表设计：
  ```sql
  CREATE TABLE licenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    license_key TEXT UNIQUE NOT NULL,
    edition TEXT NOT NULL, -- 'pro' | 'team' | 'enterprise'
    status TEXT NOT NULL,  -- 'active' | 'expired' | 'revoked'
    features JSON NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    oauth_provider TEXT,
    oauth_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```

**2. 支付集成**

推荐使用 **Lemon Squeezy**（一体化方案）：
- ✅ 支持全球支付
- ✅ 自动处理税务
- ✅ Webhook 通知
- ✅ 订阅管理
- ✅ 发票生成

集成示例：
```typescript
import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js';

// Webhook 处理
export async function POST(request: Request) {
  const payload = await request.json();
  const signature = request.headers.get('X-Signature');
  
  // 验证 Webhook 签名
  if (!verifySignature(payload, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  switch (payload.meta.event_name) {
    case 'subscription_created':
      await createLicense(payload.data);
      break;
    case 'subscription_updated':
      await updateLicense(payload.data);
      break;
    case 'subscription_cancelled':
      await revokeLicense(payload.data);
      break;
  }
  
  return new Response('OK');
}
```

**3. 用户仪表盘**

功能需求：
- 查看订阅状态
- 管理 License Key
- 下载发票
- 使用统计
- 升级/降级订阅

技术栈推荐：
- Next.js + React
- Tailwind CSS
- shadcn/ui
- 部署到 Vercel/Cloudflare Pages

#### 5.3 定价策略

**参考成功案例：**

| 项目 | 个人版 | 团队版 | 企业版 |
|------|--------|--------|--------|
| n8n | $20/月 | $50/月 | 定制 |
| Plausible | $9/月 | $19/月 | 定制 |
| Linear | $8/用户/月 | 同左 | 定制 |

**推荐定价：**

```
┌─────────────────────────────────────────────────┐
│  Community (免费)                                │
│  - 所有本地功能                                  │
│  - 无限 Skills                                   │
│  - AI 翻译（自带 API Key）                       │
│  - 社区支持                                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Pro ($9/月 或 $79/年) 💎                        │
│  - Community 的所有功能                          │
│  + 云同步（无需配置）                            │
│  + 无限 AI 翻译                                  │
│  + 使用分析                                      │
│  + 优先支持（邮件 24h 响应）                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Team ($29/月 或 $249/年，5 人)                  │
│  - Pro 的所有功能                                │
│  + 团队工作区                                    │
│  + Skills 共享                                   │
│  + 权限管理                                      │
│  + 团队分析                                      │
│  + 优先支持（Slack 连接）                        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Enterprise (定制)                               │
│  - Team 的所有功能                               │
│  + SSO（SAML/OAuth）                            │
│  + 审计日志                                      │
│  + 自托管支持                                    │
│  + SLA 保证                                      │
│  + 专属客户经理                                  │
│  + 定制开发                                      │
└─────────────────────────────────────────────────┘
```

**定价心理学：**
- ✅ 年付打折（约 8.3 折）鼓励长期订阅
- ✅ Team 版性价比高（$29/5人 vs $9*5=$45）
- ✅ Enterprise 不显示价格（引导联系销售）

---

### Phase 6: 开源发布流程

#### 6.1 发布前检查清单

**代码审查：**
- [ ] 移除所有 TODO/FIXME 注释（或转成 Issues）
- [ ] 移除测试用的硬编码数据
- [ ] 检查敏感信息（路径、邮箱等）
- [ ] 运行完整测试套件
- [ ] 运行 `cargo clippy` 和 `cargo audit`
- [ ] 运行 `npm audit`

**文档检查：**
- [ ] README.md 完整
- [ ] LICENSE 文件存在
- [ ] CONTRIBUTING.md 完整
- [ ] SECURITY.md 完整
- [ ] CODE_OF_CONDUCT.md 完整
- [ ] 安装文档完整
- [ ] API 文档完整

**配置检查：**
- [ ] .gitignore 正确
- [ ] CI/CD 配置正确
- [ ] 环境变量文档化
- [ ] 示例配置文件

#### 6.2 发布公告

**发布渠道：**

1. **GitHub Release**
   ```markdown
   ## 🎉 Skills Manager 开源发布！
   
   经过 6 个月的开发和 800+ 用户的验证，我们决定将 Skills Manager 完全开源！
   
   ### ✨ 亮点
   - 🔓 MIT License，永久免费
   - 🚀 所有核心功能开源
   - 💎 Pro 版本提供云同步等高级功能
   - 🌍 支持中英双语
   
   ### 📦 下载
   - macOS: [下载 DMG](...)
   - Windows: [下载 MSI](...)
   - Linux: [下载 AppImage](...)
   
   ### 🤝 贡献
   欢迎提交 PR！查看 [CONTRIBUTING.md](...)
   
   ---
   
   **完整变更日志**：[CHANGELOG.md](...)
   ```

2. **Twitter/X**
   ```
   🎉 Skills Manager 现已开源！
   
   统一管理 Claude Code、Codex 等 AI 助手的 Skills
   
   ✅ MIT License
   ✅ Tauri + React + Rust
   ✅ 跨平台（Mac/Win/Linux）
   ✅ 已有 800+ 用户
   
   GitHub: https://github.com/jiweiyeah/skills-manager-private
   
   #opensource #rust #tauri #ai #devtools
   ```

3. **Hacker News**（Show HN）
   标题：`Show HN: Skills Manager – Unified management for AI coding assistants`
   
   ```markdown
   Hi HN!
   
   I've been building Skills Manager for the past 6 months, and today I'm open-sourcing it under MIT license.
   
   **What is it?**
   Skills Manager helps you manage "skills" (custom prompts/tools) across multiple AI coding assistants like Claude Code, Codex, etc. Write once, use everywhere.
   
   **Tech Stack:**
   - Tauri 2.0 (Rust backend)
   - React 19 + TypeScript
   - Monaco Editor
   
   **Why open source now?**
   After 800+ users and lots of feedback, I realized the core value is in the ecosystem, not the code. I'm planning a Pro version with cloud sync while keeping all local features free forever.
   
   **Try it:**
   - Download: https://github.com/jiweiyeah/skills-manager-private/releases
   - Source: https://github.com/jiweiyeah/skills-manager-private
   
   Would love your feedback!
   ```

4. **Reddit**
   - r/opensource
   - r/rust
   - r/tauri
   - r/programming (Saturday)

5. **中文社区**
   - V2EX
   - RustCC
   - 掘金
   - 知乎

---

## 🗓️ 实施时间线

### Week 1-2: 代码重构（关键）

**目标：** 保护云同步功能，添加 Feature Flag

**任务清单：**
- [ ] 添加 `LicenseInfo` 模型到 `config.rs`
- [ ] 集成 `features.rs` 到主代码库
- [ ] 修改所有云同步命令添加 License 检查
- [ ] 实现 License 验证接口调用
- [ ] 保护后端 API 地址（环境变量 + 编译时配置）
- [ ] 完整测试所有功能

**验收标准：**
- Community 版本无法使用云同步
- Pro 版本（开发模式）可以正常云同步
- 所有单元测试通过

### Week 3: 创建开源文档

**任务清单：**
- [ ] README.md（中英双语）
- [ ] LICENSE（MIT）
- [ ] CONTRIBUTING.md
- [ ] CODE_OF_CONDUCT.md
- [ ] SECURITY.md
- [ ] docs/SELF_HOSTING.md（自托管指南）
- [ ] docs/API.md（API 文档）

### Week 4: 后端准备

**任务清单：**
- [ ] 实现 License 验证 API
- [ ] 添加云同步 API 的 License 检查
- [ ] 添加速率限制
- [ ] 集成 Lemon Squeezy
- [ ] 创建用户仪表盘（基础版）

### Week 5: 测试与修复

**任务清单：**
- [ ] 完整安全审计
- [ ] 性能测试
- [ ] 跨平台测试（Mac/Win/Linux）
- [ ] Beta 测试（邀请 10-20 个用户）
- [ ] 修复发现的问题

### Week 6: 开源发布

**任务清单：**
- [ ] 公开仓库
- [ ] 发布 GitHub Release
- [ ] 发布公告（Twitter/HN/Reddit/中文社区）
- [ ] 监控社区反馈
- [ ] 快速响应 Issues

### Week 7-8: 社区建设

**任务清单：**
- [ ] 设置 GitHub Discussions
- [ ] 添加 Issue 模板
- [ ] 添加 PR 模板
- [ ] 设置 GitHub Actions（CI/CD）
- [ ] 欢迎首次贡献者

### Week 9-12: Pro 版本开发

**任务清单：**
- [ ] 完善 License 管理系统
- [ ] 完善支付流程
- [ ] 完善用户仪表盘
- [ ] 添加团队功能
- [ ] Beta 测试 Pro 版本

### Month 4: Pro 版本正式发布

**任务清单：**
- [ ] 发布定价页面
- [ ] 发布 Pro 版本
- [ ] 营销推广
- [ ] 收集用户反馈

---

## 🚨 风险与应对

### 风险 1：后端 API 被滥用

**可能性：** 高
**影响：** 中等

**应对措施：**
- ✅ OAuth 认证（已实现）
- ✅ License 验证（需添加）
- ✅ 速率限制（IP + 用户）
- ✅ Cloudflare DDoS 防护
- ✅ 监控异常流量
- ✅ 成本告警

### 风险 2：云同步代码被修改绕过付费

**可能性：** 中等
**影响：** 高

**应对措施：**
- ✅ 客户端 + 服务端双重验证
- ✅ License Key 加密签名
- ✅ 服务端拒绝无效请求
- ✅ 定期轮换 API 密钥
- ⚠️ 接受部分用户会破解（开源的代价）

**关键理念：**
> 不要试图 100% 防止破解，而是让正版体验足够好，破解成本足够高。

### 风险 3：开源后难以维护

**可能性：** 中等
**影响：** 高

**应对措施：**
- ✅ 明确贡献指南
- ✅ Issue/PR 模板
- ✅ 自动化 CI/CD
- ✅ 社区管理规则
- ✅ 核心团队审核机制
- ✅ 定期发布节奏（每月一次）

### 风险 4：竞争对手克隆项目

**可能性：** 低-中等
**影响：** 中等

**应对措施：**
- ✅ MIT License 允许这样做
- ✅ 你的优势：先发优势、社区、品牌
- ✅ 持续创新，保持领先
- ✅ 优质的用户体验和支持
- ✅ Pro 版本的后端服务是护城河

---

## 💰 商业模式总结

### 收入来源

**1. Pro 订阅（主要收入）**
- 个人版：$9/月 × 预估 100-500 用户 = $900-$4,500/月
- 团队版：$29/月 × 预估 20-100 团队 = $580-$2,900/月
- **预估首年 ARR：** $20K-$80K

**2. Enterprise 定制（高利润）**
- 自托管支持
- 定制开发
- 培训服务
- 预估单笔：$5K-$50K

**3. 赞助（副收入）**
- GitHub Sponsors
- Open Collective
- 预估：$100-$500/月

### 成本结构

**固定成本：**
- 云服务器：$50-$200/月（根据用户增长）
- 数据库：$25-$100/月
- CDN：$20-$50/月
- 支付手续费（Lemon Squeezy）：5% + $0.50/交易
- **合计：** ~$100-$500/月

**变动成本：**
- OAuth API 调用：几乎免费
- 云存储：$0.02/GB/月
- 带宽：$0.09/GB

**人力成本：**
- 你的时间（全职/兼职）
- 可选：雇佣兼职开发者

### 盈利路径

**阶段 1（3-6 个月）：验证市场**
- 目标：100 付费用户
- 月收入：$1,000-$2,000
- 状态：覆盖成本

**阶段 2（6-12 个月）：增长期**
- 目标：500 付费用户
- 月收入：$5,000-$10,000
- 状态：开始盈利

**阶段 3（12-24 个月）：规模化**
- 目标：2,000 付费用户
- 月收入：$20,000-$40,000
- 状态：可持续商业

---

## ✅ 立即行动项（优先级排序）

### P0 - 本周必须完成

1. **添加 Feature Flag 系统**
   - 创建 `features.rs`（已完成 ✅）
   - 集成到 `lib.rs`
   - 添加单元测试

2. **保护云同步功能**
   - 修改 `cloud_sync.rs` 添加 License 检查
   - 保持接口开源，逻辑可见

3. **保护后端 API 地址**
   - 使用环境变量
   - 编译时注入

### P1 - 下周完成

4. **创建 README.md**
   - 中英双语
   - 清晰的 Pro/Community 区分

5. **创建 LICENSE**
   - 推荐 MIT

6. **后端 License 验证 API**
   - `/api/v1/licenses/verify`
   - 数据库表设计

### P2 - 两周内完成

7. **完整文档套件**
   - CONTRIBUTING.md
   - SECURITY.md
   - CODE_OF_CONDUCT.md

8. **完整测试**
   - 安全审计
   - 跨平台测试

9. **Beta 测试**
   - 邀请 10-20 个用户
   - 收集反馈

---

## 📞 需要你决定的问题

1. **许可证选择**
   - ✅ **推荐：MIT**（最宽松，利于采用）
   - ⚠️ 备选：AGPL-3.0（防云服务商白嫖）

2. **仓库策略**
   - ✅ **推荐：直接公开 private 仓库**
   - 优点：保留 Stars、历史、Issues
   - 缺点：需要清理历史敏感信息（如果有）

3. **定价策略**
   - 个人版：$9/月 还是 $12/月？
   - 年付折扣：8.3 折（约 2 个月免费）可以吗？
   - 是否提供永久许可证选项？

4. **发布时机**
   - 尽快发布（2-3 周内）？
   - 还是等 Pro 版本准备好（2-3 个月）？
   - **推荐：尽快开源，Pro 版本后续推出**

---

## 🎯 成功指标

### 短期（3 个月）
- [ ] GitHub Stars > 1,500
- [ ] Issues < 10 个未解决
- [ ] PRs 平均响应时间 < 48h
- [ ] Beta 用户 > 50

### 中期（6 个月）
- [ ] Pro 用户 > 100
- [ ] MRR > $1,000
- [ ] 活跃贡献者 > 5
- [ ] 文档覆盖率 > 80%

### 长期（12 个月）
- [ ] GitHub Stars > 5,000
- [ ] Pro 用户 > 500
- [ ] MRR > $5,000
- [ ] 社区自主维护部分功能

---

## 📚 参考资源

### 开源商业化案例研究
- [n8n 开源商业化之路](https://n8n.io/blog/open-source-business-model/)
- [GitLab 的开源策略](https://about.gitlab.com/company/stewardship/)
- [Plausible 如何做到开源+盈利](https://plausible.io/blog/open-source-saas)

### 技术文档
- [Tauri Security Best Practices](https://tauri.app/v1/guides/security/)
- [Rust Licensing Guide](https://rust-lang.github.io/api-guidelines/necessities.html#crate-and-its-dependencies-have-a-permissive-license-c-permissive)
- [Open Source License Comparison](https://choosealicense.com/)

---

**下一步：**
1. 我可以帮你立即添加 License 模型到 `config.rs`
2. 修改云同步命令添加 Feature Flag 检查
3. 创建 README.md 和 LICENSE 文件

你想从哪一步开始？
