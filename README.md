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
# 下载 DMG
# https://github.com/jiweiyeah/Skills-Manager/releases
```

### Windows
```bash
# 下载 MSI 安装包
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
