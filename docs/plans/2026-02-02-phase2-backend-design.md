# Phase 2 核心后端设计

## 概述

实现 Skills Manager 的四个核心后端模块：工具检测、Skills 扫描、软链接管理、配置读写。

## 决策记录

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 工具检测方式 | 配置目录 + CLI 验证 | 检查目录存在性，同时运行 `which` 验证 CLI |
| 软链接错误处理 | 静默跳过 + 汇总报告 | 单个失败不中断，完成后返回汇总 |
| 无 meta.json 处理 | 自动生成 | 从目录名和 frontmatter 推断信息 |
| 配置存储位置 | 公共 Skills 目录内 | `~/.skills-hub/config.json` |

## 模块结构

```
src-tauri/src/
├── main.rs
├── lib.rs
├── commands/
│   ├── mod.rs
│   ├── config.rs
│   ├── skills.rs
│   ├── tools.rs
│   └── sync.rs
├── services/
│   ├── mod.rs
│   ├── config_manager.rs
│   ├── scanner.rs
│   ├── linker.rs
│   └── detector.rs
└── models/
    ├── mod.rs
    ├── config.rs
    ├── skill.rs
    └── tool.rs
```

## 数据模型

### AppConfig
```rust
pub struct AppConfig {
    pub version: String,
    pub skills_dir: PathBuf,
    pub tools: HashMap<String, ToolConfig>,
}

pub struct ToolConfig {
    pub enabled: bool,
    pub detected: bool,
    pub skills_path: PathBuf,
    pub config_path: PathBuf,
}
```

### Skill
```rust
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub source: SkillSource,
    pub enabled: HashMap<String, bool>,
    pub path: PathBuf,
}

pub enum SkillSource {
    Local,
    Imported,
}
```

### Tool
```rust
pub struct Tool {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub cli_available: bool,
    pub config: ToolConfig,
}
```

## 服务模块

### DetectorService
- `detect_all()` - 检测所有支持的工具
- `detect_tool()` - 检测单个工具（目录 + CLI）
- `check_cli_available()` - 运行 which/where 检查 CLI

支持的工具：
- claude-code: ~/.claude, `claude`
- codex: ~/.codex, `codex`
- codebuddy: ~/.codebuddy, `codebuddy`

### ScannerService
- `scan_skills()` - 扫描公共目录下所有 skills
- `load_skill()` - 加载单个 skill
- `generate_meta()` - 自动生成 meta.json
- `parse_frontmatter()` - 解析 skill.md 的 YAML frontmatter

### LinkerService
- `enable_skill()` - 创建软链接
- `disable_skill()` - 删除软链接
- `sync_all()` - 批量同步，返回 LinkReport
- `check_link()` - 检查链接健康状态

LinkStatus 枚举：Valid / Broken / WrongTarget / NotALink / Missing

### ConfigManager
- `load()` - 加载配置，不存在则创建默认
- `save()` - 保存配置
- `init_default()` - 创建默认配置
- `is_initialized()` - 检查是否已初始化

## Tauri 命令

```rust
// config
fn get_config() -> Result<AppConfig, String>
fn save_config(config: AppConfig) -> Result<(), String>
fn is_initialized() -> bool

// skills
fn list_skills() -> Result<Vec<Skill>, String>
fn enable_skill(skill_id: String, tool_id: String) -> Result<(), String>
fn disable_skill(skill_id: String, tool_id: String) -> Result<(), String>

// tools
fn detect_tools() -> Result<Vec<Tool>, String>
fn get_tool_status(tool_id: String) -> Result<Tool, String>

// sync
fn check_sync_status() -> Result<SyncReport, String>
fn fix_sync_issues() -> Result<LinkReport, String>
```

## 依赖关系

```
commands/* → services/*
config_manager → detector
scanner → (无)
linker → (无)
detector → (无)
```

## 实现顺序

1. models/ - 定义所有数据结构
2. services/detector.rs - 工具检测
3. services/config_manager.rs - 配置管理
4. services/scanner.rs - Skills 扫描
5. services/linker.rs - 软链接管理
6. commands/* - Tauri 命令暴露
7. lib.rs - 注册所有命令
