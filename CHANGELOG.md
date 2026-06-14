# Changelog

所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/)，
版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

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

[Unreleased]: https://github.com/jiweiyeah/Skills-Manager/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.1.0
[2.0.3]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.3
[2.0.0]: https://github.com/jiweiyeah/Skills-Manager/releases/tag/v2.0.0
