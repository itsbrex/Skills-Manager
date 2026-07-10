# Changelog

所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/)，
版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

## [2.1.4] - 2026-07-10

### 中文

#### Added
- 新增 Skill 收藏功能：支持本地与市场 Skill 收藏，市场收藏保存快照支持断网展示，已收藏置顶排序与"仅看收藏"筛选
- 市场源切换为 clawhub.ai：后端改用 clawhub.ai 公开 API，支持 ZIP 归档内存预览与标签筛选
- 优化市场搜索体验：Clawhub 专用搜索端点支持全库搜索，分词 AND 匹配扩展至 tags 字段，搜索结果高亮匹配子串并显示计数
- 新增 WorkBuddy 工具支持

#### Changed
- 设置页"市场"区块合并到"通用"区块，命令面板对应命令更新为 set-github-token
- 清理 Rust 编译警告：移除未使用的 re-export，为 clawhub 响应结构体补充 #[allow(dead_code)]
- 版本号统一升级至 2.1.4

#### Fixed
- 修正 clawhub 市场 Skill 外部链接 URL 构造（补全 owner 与 /skills/ 段）
- 修复下拉菜单点击外部空白区域无法收起的问题（backdrop-filter 导致 fixed 遮罩失效，改用 useClickOutside hook）
- 修复切换市场源后旧源已安装 Skill 混入当前源列表的问题
- 修复选中标签后底部无限显示"加载中"的问题

### English

#### Added
- Skill favorites: supports favoriting local and marketplace skills; marketplace favorites store snapshots for offline display; favorited items pinned to top with "favorites only" filter
- Marketplace source switched to clawhub.ai: backend now uses clawhub.ai public API with in-memory ZIP archive preview and tag filtering
- Improved marketplace search: dedicated Clawhub search endpoint enables full-library search; token-based AND matching extended to tags; search results highlight matched substrings with result count
- Added WorkBuddy tool support

#### Changed
- Merged the "Marketplace" settings section into "General"; command palette command updated to set-github-token
- Cleaned up Rust compile warnings: removed unused re-exports, added #[allow(dead_code)] to clawhub response structs
- Bumped version to 2.1.4 across the board

#### Fixed
- Fixed clawhub marketplace skill external link URL construction (missing owner and /skills/ segment)
- Fixed dropdown menus not closing when clicking outside (backdrop-filter broke the fixed overlay; replaced with useClickOutside hook)
- Fixed installed skills from a previous marketplace source leaking into the current source list after switching sources
- Fixed infinite "loading" indicator at the bottom when a tag filter was selected

## [2.1.2] - 2026-06-23

### 中文

#### Added
- 全新 Raycast 风格 UI 设计语言，重塑整体视觉体验
- 新增 TopBar 顶栏布局，整合品牌标识、范围搜索、认证与更新提示，移除原侧边栏
- 新增 ScopeSearchField 范围搜索组件，支持页面范围切换与 `/` 快捷键
- CommandPalette 命令面板升级至 Raycast 规格
- 新增 Raycast 设计令牌（Token）基础与 Inter + GeistMono 字体预设
- 新增页面入场动画与 Raycast 动效系统
- 新增自定义 Raycast Monaco 编辑器主题
- 设置面板与欢迎页新增氛围渐变效果
- Skills 页面工具启用状态改用工具图标展示，替代原文字标签

#### Changed
- 全站硬编码颜色清理，统一使用语义化设计令牌
- 设置页改为垂直滚动布局，简化字体预设为 default/serif
- 页面操作按钮整合为统一图标按钮
- 下拉菜单、标签筛选、更多菜单统一 Raycast 风格
- 搜索快捷键提示改为平台自适应（macOS 显示 ⌘K，Windows/Linux 显示 Ctrl+K）
- 市场页排序移至顶部操作栏

#### Fixed
- 修复页面切换时的闪烁与卡顿问题
- 修复 TopBar 固定定位导致的布局问题
- 修复暗色模式下的可读性问题
- 修复 Shell 渲染循环导致的导航卡死与错误
- 修复认证登录弹窗定位问题
- 修复命令面板重复的 Enter 提示

### English

#### Added
- Brand-new Raycast-style UI design language across the app
- New TopBar layout integrating brand, scope search, auth, and update badge; removed the sidebar
- New ScopeSearchField component with page-scope chip and `/` switcher
- Elevated CommandPalette to Raycast spec
- Added Raycast design token foundation with Inter + GeistMono font preset
- Page entrance animations and Raycast motion system
- Custom Raycast Monaco editor theme
- Atmosphere gradients on Settings panel and Welcome hero
- Skills page now shows tool enable status with tool icons instead of text labels

#### Changed
- Swept hardcoded colors app-wide; unified on semantic design tokens
- Settings page switched to vertical scroll layout; simplified font presets to default/serif
- Consolidated page actions into unified icon buttons
- Unified dropdown menus, tag filters, and more menu to Raycast style
- Search shortcut hint is now platform-aware (⌘K on macOS, Ctrl+K on Windows/Linux)
- Marketplace sort moved to the header action bar

#### Fixed
- Eliminated flicker and lag on page switching
- Fixed TopBar fixed-positioning layout issues
- Fixed dark-mode readability issues
- Fixed render loop causing stuck navigation and red errors
- Fixed auth login popup positioning
- Fixed duplicate Enter hint in command palette

## [2.1.0] - 2026-06-14

### Added
- 完整的开源文档（LICENSE, CONTRIBUTING, SECURITY）
- 双语文档支持（英文/中文）
- 隐私政策文档

### Changed
- 准备开源 Community Edition
- 移除云同步、遥测、投票、Vault 等 Pro 功能
- 保留 OAuth 认证（用于 GitHub Marketplace 集成）
- 移动私有功能到 `.private-features/` 目录
- 更新 README 为开源社区版本
- 添加功能标志系统（features.rs）

### Fixed
- 修复测试代码中缺失的 auth_session 字段
- 修复 Sidebar 使用 config.auth_session

## [2.0.3] - 2024-06-14

### Added
- 完整的本地功能
- Skills 统一管理
- 软链接自动同步
- 内置 Monaco Editor
- AI 翻译支持
- Marketplace 浏览

### Fixed
- 多项 Bug 修复

## [2.0.0] - 2024-01-01

### Added
- 完整重写，基于 Tauri 2.0
- React 19 前端
- Rust 后端
- 跨平台支持（macOS/Windows/Linux）

[Unreleased]: https://github.com/jiweiyeah/Skills-Manager/compare/v2.1.4...HEAD
[2.1.4]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.1.4
[2.1.2]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.1.2
[2.1.0]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.1.0
[2.0.3]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.3
[2.0.0]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.0
