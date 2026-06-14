# Goal Prompt: Skills Manager 开源清理 - Phase 3（文档创建与最终验证）

## 前提条件

✅ Phase 1（后端清理）已完成并通过验证
✅ Phase 2（前端清理）已完成并通过验证

## 目标

创建所有开源必需的文档，进行最终验证，并准备发布到公共仓库。

## 详细任务清单

### Phase 1: 创建 README.md（预计 30 分钟）

**任务 1.1：创建 README.md**

在项目根目录创建 `README.md`，包含以下内容：

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
\`\`\`bash
# 下载 DMG
# https://github.com/jiweiyeah/Skills-Manager/releases
\`\`\`

### Windows
\`\`\`bash
# 下载 MSI 安装包
# https://github.com/jiweiyeah/Skills-Manager/releases
\`\`\`

### Linux
\`\`\`bash
# 下载 AppImage
# https://github.com/jiweiyeah/Skills-Manager/releases
chmod +x skills-manager.AppImage
./skills-manager.AppImage
\`\`\`

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

\`\`\`
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
\`\`\`

## 🛠️ 开发

\`\`\`bash
# 克隆仓库
git clone https://github.com/jiweiyeah/Skills-Manager.git
cd Skills-Manager

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建
npm run tauri build
\`\`\`

### 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4
- **桌面**: Tauri 2.0
- **后端**: Rust
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

验证：
```bash
# 确认文件存在
ls README.md

# 检查内容长度
wc -l README.md
# 应该有 100+ 行
```

---

### Phase 2: 创建 LICENSE（预计 5 分钟）

**任务 2.1：创建 LICENSE 文件**

在项目根目录创建 `LICENSE`：

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

验证：
```bash
# 确认文件存在
ls LICENSE

# 检查是否包含 MIT License
grep "MIT License" LICENSE
```

---

### Phase 3: 创建 CONTRIBUTING.md（预计 30 分钟）

**任务 3.1：创建 CONTRIBUTING.md**

在项目根目录创建 `CONTRIBUTING.md`：

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

请尊重所有贡献者，保持友善和专业。
```

验证：
```bash
# 确认文件存在
ls CONTRIBUTING.md

# 检查内容
head -20 CONTRIBUTING.md
```

---

### Phase 4: 创建 SECURITY.md（预计 15 分钟）

**任务 4.1：创建 SECURITY.md**

```markdown
# 安全政策

## 报告安全漏洞

如果你发现了安全漏洞，请 **不要** 公开提交 Issue。

请发送邮件到：[你的邮箱]

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

验证：
```bash
ls SECURITY.md
```

---

### Phase 5: 创建 CHANGELOG.md（预计 15 分钟）

**任务 5.1：创建 CHANGELOG.md**

```markdown
# Changelog

所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/)，
版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### Changed
- 准备开源 Community Edition
- 移除云功能（认证、云同步、遥测、投票、Vault）
- Pro 功能开发中

## [2.0.3] - 2024-XX-XX

### Added
- 完整的本地功能
- Skills 统一管理
- 软链接自动同步
- 内置 Monaco Editor
- AI 翻译支持
- Marketplace 浏览

### Fixed
- 多项 Bug 修复

## [2.0.0] - 2024-XX-XX

### Added
- 完整重写，基于 Tauri 2.0
- React 19 前端
- Rust 后端
- 跨平台支持（macOS/Windows/Linux）

[Unreleased]: https://github.com/jiweiyeah/Skills-Manager/compare/v2.0.3...HEAD
[2.0.3]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.3
[2.0.0]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.0
```

验证：
```bash
ls CHANGELOG.md
```

---

### Phase 6: 最终代码验证（预计 30 分钟）

**任务 6.1：完整编译测试**

```bash
# 1. 清理
cd src-tauri
cargo clean
cd ..
rm -rf node_modules dist

# 2. 重新安装依赖
npm install

# 3. Rust 编译
cd src-tauri
cargo build --release

# 4. Rust 测试
cargo test

# 5. Clippy 检查
cargo clippy -- -D warnings

# 6. 前端类型检查
cd ..
npm run typecheck

# 7. 前端构建
npm run build

# 8. 完整构建
npm run tauri build
```

**预期结果：** ✅ 所有步骤都成功

**任务 6.2：搜索残留引用**

```bash
# 搜索后端残留
grep -r "AuthSession\|CloudSyncState\|PollClientState" src-tauri/src/ --include="*.rs"
# 应该返回空

# 搜索前端残留
grep -r "cloudSync\|authProfile\|telemetry_" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
# 应该返回空
```

**任务 6.3：检查配置文件**

```bash
# 检查 package.json
grep '"version"' package.json

# 检查 Cargo.toml
grep '^version' src-tauri/Cargo.toml

# 确保版本一致
```

---

### Phase 7: 手动完整测试（预计 30 分钟）

**任务 7.1：启动应用**
```bash
npm run tauri dev
```

**任务 7.2：功能测试清单**

- [ ] **首次启动流程**
  - [ ] 欢迎页面显示正常
  - [ ] 可以选择 Skills 目录
  - [ ] 工具检测正常

- [ ] **Skills 管理**
  - [ ] 列表正常加载
  - [ ] 搜索功能正常
  - [ ] 可以启用/禁用 Skill
  - [ ] 软链接创建成功（检查文件系统）
  - [ ] 可以创建新 Skill
  - [ ] 可以删除 Skill

- [ ] **编辑器**
  - [ ] 可以打开 Skill 文件
  - [ ] 文件树正常显示
  - [ ] 可以编辑和保存
  - [ ] 语法高亮正常

- [ ] **AI 翻译**
  - [ ] 可以配置 LLM Provider
  - [ ] 输入 API Key 后翻译正常
  - [ ] 翻译结果缓存正常

- [ ] **Marketplace**
  - [ ] 列表正常加载
  - [ ] 搜索功能正常
  - [ ] 可以安装 Skill
  - [ ] 安装后软链接创建成功

- [ ] **设置页面**
  - [ ] 主题切换正常
  - [ ] 语言切换正常
  - [ ] Pro 功能占位显示正常
  - [ ] ❌ 无云同步设置
  - [ ] ❌ 无认证设置

- [ ] **UI 完整性**
  - [ ] ❌ 无登录按钮
  - [ ] ❌ 无用户头像
  - [ ] ❌ 无云同步状态指示
  - [ ] ✅ 所有本地功能按钮可用

**任务 7.3：控制台检查**

打开开发者工具：
- ✅ 无错误信息
- ✅ 无 "command not found"
- ✅ 无类型错误
- ✅ 无未捕获的 Promise rejection

---

### Phase 8: 文档完整性检查（预计 10 分钟）

**任务 8.1：检查所有必需文档**

```bash
# 检查文档是否存在
ls README.md LICENSE CONTRIBUTING.md SECURITY.md CHANGELOG.md

# 检查文档内容
for file in README.md LICENSE CONTRIBUTING.md SECURITY.md CHANGELOG.md; do
  echo "=== $file ==="
  wc -l $file
done
```

**预期结果：**
- ✅ README.md: 100+ 行
- ✅ LICENSE: 20+ 行
- ✅ CONTRIBUTING.md: 100+ 行
- ✅ SECURITY.md: 30+ 行
- ✅ CHANGELOG.md: 30+ 行

**任务 8.2：检查链接有效性**

在 README.md 中检查所有链接：
- GitHub Issues 链接
- GitHub Releases 链接
- 文档链接（CONTRIBUTING.md 等）

---

### Phase 9: Git 历史清理（可选，预计 20 分钟）

**⚠️ 注意：只在需要清理敏感历史时执行**

**任务 9.1：检查历史是否包含敏感信息**

```bash
# 搜索历史提交中的敏感信息
git log --all --full-history --source --all -S "sk-\|api_key\|password\|secret" --pretty=format:"%h %s"
```

如果发现敏感信息，考虑使用 git-filter-repo 清理（但会丢失 Stars）。

**推荐：不清理历史**，直接公开即可（因为私有仓库历史对你自己是安全的）。

---

### Phase 10: 最终提交（预计 10 分钟）

**任务 10.1：查看所有改动**

```bash
git status
git log --oneline -10
```

**任务 10.2：创建文档提交**

```bash
git add README.md LICENSE CONTRIBUTING.md SECURITY.md CHANGELOG.md
git commit -m "docs: add open source documentation

- Add README.md with Community Edition description
- Add MIT LICENSE
- Add CONTRIBUTING.md with development guidelines  
- Add SECURITY.md with vulnerability reporting process
- Add CHANGELOG.md with version history

Ready for open source release.
"
```

**任务 10.3：创建版本标签**

```bash
# 创建开源发布标签
git tag -a v2.1.0-community -m "Community Edition - Open Source Release

- All core local features
- Cloud features removed (will be Pro features)
- Complete documentation
- MIT License
"

# 查看标签
git tag -l
git show v2.1.0-community
```

---

### Phase 11: 准备发布（预计 15 分钟）

**任务 11.1：生成 Release Notes**

创建 `RELEASE_NOTES.md`：

```markdown
# Skills Manager v2.1.0 - Community Edition 开源发布

## 🎉 亮点

经过 6 个月的开发和 800+ 用户的验证，我们决定将 Skills Manager 完全开源！

### ✨ Community Edition 包含

- 🔗 **统一管理** - 一处编写 Skills，多处使用
- 🔄 **软链接同步** - 自动同步到 Claude Code、Codex 等
- 📝 **内置编辑器** - Monaco Editor 支持
- 🌐 **AI 翻译** - 支持 OpenAI 兼容 API（用户自带 Key）
- 🛠️ **工具检测** - 自动检测已安装的 AI 助手
- 🛍️ **Marketplace** - 浏览和安装社区 Skills

### 🔒 MIT License

核心功能永久免费开源！

### 💎 Pro 功能（开发中）

以下功能将在后端服务完善后作为 Pro 版本推出：
- 云同步
- 团队协作
- 无限 AI 翻译
- 使用分析

## 📦 下载

- [macOS (DMG)](...)
- [Windows (MSI)](...)
- [Linux (AppImage)](...)

## 🚀 快速开始

\`\`\`bash
# 1. 下载安装包
# 2. 启动应用
# 3. 选择 Skills 目录
# 4. 开始使用
\`\`\`

## 🤝 贡献

我们欢迎所有形式的贡献！

- 🐛 [报告 Bug](https://github.com/jiweiyeah/Skills-Manager/issues)
- 💡 [功能建议](https://github.com/jiweiyeah/Skills-Manager/issues)
- 🔧 [提交代码](https://github.com/jiweiyeah/Skills-Manager/pulls)

详细指南：[CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 许可证

[MIT License](LICENSE)

---

感谢所有支持 Skills Manager 的用户！🙏
```

**任务 11.2：推送到私有仓库**

```bash
# 推送所有改动
git push origin feat/opensource-cleanup

# 推送标签
git push origin v2.1.0-community
```

---

## 成功标准

### 必须满足

- [ ] 5 个文档文件已创建
  - [ ] README.md
  - [ ] LICENSE
  - [ ] CONTRIBUTING.md
  - [ ] SECURITY.md
  - [ ] CHANGELOG.md
- [ ] 完整编译测试通过
  - [ ] `cargo build --release` 成功
  - [ ] `cargo test` 通过
  - [ ] `cargo clippy` 无警告
  - [ ] `npm run typecheck` 通过
  - [ ] `npm run build` 成功
  - [ ] `npm run tauri build` 成功
- [ ] 手动功能测试全部通过
- [ ] 无残留云功能引用
- [ ] 文档链接有效
- [ ] Git 提交完成
- [ ] 版本标签创建

### 验证命令

```bash
# 1. 文档存在性
ls README.md LICENSE CONTRIBUTING.md SECURITY.md CHANGELOG.md

# 2. 编译成功
cd src-tauri && cargo build --release 2>&1 | grep "Finished release"

# 3. 测试通过
cargo test 2>&1 | grep "test result: ok"

# 4. 前端构建
cd .. && npm run build 2>&1 | grep "built in"

# 5. 无残留引用
grep -r "AuthSession\|CloudSync" src-tauri/src/ src/ --include="*.rs" --include="*.ts" --include="*.tsx" | wc -l
# 应该返回 0

# 6. Git 状态
git log --oneline -5
git tag -l | grep community
```

---

## 时间估算

- Phase 1（README）：30 分钟
- Phase 2（LICENSE）：5 分钟
- Phase 3（CONTRIBUTING）：30 分钟
- Phase 4（SECURITY）：15 分钟
- Phase 5（CHANGELOG）：15 分钟
- Phase 6（代码验证）：30 分钟
- Phase 7（手动测试）：30 分钟
- Phase 8（文档检查）：10 分钟
- Phase 9（历史清理）：0 分钟（跳过）
- Phase 10（提交）：10 分钟
- Phase 11（准备发布）：15 分钟

**总计：约 3 小时**

---

## 完成后下一步

Phase 3 完成后，你的私有仓库已经完全准备好开源了！

**准备同步到公共仓库时：**

1. **方案 A：直接公开私有仓库**（推荐）
   ```bash
   # GitHub 网页端
   Settings → Danger Zone → Change visibility → Make public
   ```

2. **方案 B：推送到公共仓库**
   ```bash
   git remote add public git@github.com:jiweiyeah/Skills-Manager.git
   git push public feat/opensource-cleanup:main --force
   git push public v2.1.0-community
   ```

3. **创建 GitHub Release**
   - 使用 `RELEASE_NOTES.md` 内容
   - 上传构建产物（DMG/MSI/AppImage）
   - 发布！

---

## 参考文档

- 完整清单：`docs/COMPLETE_CHANGELOG.md`
- 执行指南：`docs/CLEANUP_EXECUTION_GUIDE.md`
- 开源策略：`docs/OPEN_SOURCE_STRATEGY.md`

---

## 恭喜！🎉

完成 Phase 3 后，Skills Manager Community Edition 就完全准备好开源了！
