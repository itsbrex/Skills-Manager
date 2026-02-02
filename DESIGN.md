# Skills Manager 设计文档

## 概述

Skills Manager 是一个 Tauri 桌面应用，用于统一管理多个 AI 编程工具（Claude Code、Codex、CodeBuddy）的 skills。

**核心价值**：一份 Skills，多工具共享 — 通过公共目录 + 软链接机制，避免在多个工具间重复维护 skills。

## 技术栈

- **框架**: Tauri 2.x
- **前端**: React + TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **数据存储**: JSON 文件
- **后端**: Rust (via Tauri)

## MVP 功能范围

| 功能 | 说明 |
|------|------|
| A. 公共目录设置 | 指定一个统一存放 skills 的目录 |
| B. 工具检测与配置 | 自动检测已安装的 cc/codex/codebuddy，配置软链接 |
| C. Skills 列表展示 | 查看公共目录里所有 skills，分类浏览 |
| D. 启用/禁用 Skills | 可视化开关，控制某个 skill 是否生效 |
| H. 同步状态检查 | 检查各工具的软链接是否正常，一键修复 |

## 软链接策略

采用 **文件级软链接**（方案 B）：
- 每个 skill 单独创建软链接
- 支持对单个 skill 启用/禁用（删除/创建对应链接）
- 不依赖工具是否支持自定义路径

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Skills Manager                        │
│                   (Tauri Desktop App)                    │
├─────────────────────────────────────────────────────────┤
│  Frontend (React + Tailwind + shadcn/ui)                │
│  ┌───────────┬───────────┬───────────┬───────────┐      │
│  │  设置页   │  Skills   │  工具管理  │  同步状态  │      │
│  │           │  列表     │           │  检查      │      │
│  └───────────┴───────────┴───────────┴───────────┘      │
├─────────────────────────────────────────────────────────┤
│  Backend (Rust via Tauri)                               │
│  ┌───────────┬───────────┬───────────┬───────────┐      │
│  │  配置管理  │  Skills   │  软链接   │  工具检测  │      │
│  │  模块     │  扫描器   │  管理器   │  模块      │      │
│  └───────────┴───────────┴───────────┴───────────┘      │
├─────────────────────────────────────────────────────────┤
│  File System                                            │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │ 公共 Skills 目录 │  │ 各工具 Skills 目录 (软链接) │   │
│  │ ~/.skills-hub/  │  │ ~/.claude/, ~/.codex/ ...  │   │
│  └─────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 目录结构与数据模型

### 公共 Skills 目录结构

```
~/.skills-hub/
├── config.json              # 全局配置
├── skills/                  # 所有 skills 存放处
│   ├── superpowers/
│   │   ├── skill.md
│   │   └── meta.json        # 我们生成的元信息
│   ├── playwright-skill/
│   └── ...
└── tools/                   # 各工具的配置信息
    ├── claude-code.json
    ├── codex.json
    └── codebuddy.json
```

### config.json 示例

```json
{
  "version": "1.0.0",
  "skillsDir": "~/.skills-hub/skills",
  "tools": {
    "claude-code": {
      "enabled": true,
      "detected": true,
      "skillsPath": "~/.claude/skills",
      "configPath": "~/.claude"
    },
    "codex": {
      "enabled": true,
      "detected": false,
      "skillsPath": "~/.codex/skills",
      "configPath": "~/.codex"
    }
  }
}
```

### skill 的 meta.json 示例

```json
{
  "id": "superpowers",
  "name": "Superpowers",
  "description": "A collection of powerful skills",
  "version": "4.0.3",
  "source": "local",
  "enabled": {
    "claude-code": true,
    "codex": true,
    "codebuddy": false
  },
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-02-01T15:30:00Z"
}
```

## 核心功能流程

### 1. 首次启动流程

1. 检测已安装的 AI 编程工具
2. 设置公共 Skills 目录（默认 `~/.skills-hub`）
3. 可选：导入现有 Skills 到公共目录
   - 扫描已检测工具的 skills 目录
   - 把发现的 skills **移动**（不是复制）到公共目录
   - 在原位置创建软链接指向公共目录
   - 多个工具有相同 skill 时，保留最新版本，去重合并

### 2. 启用/禁用 Skill 的逻辑

**启用 Skill (对某工具)**:
1. 检查公共目录中 skill 文件是否存在
2. 检查目标工具 skills 目录是否存在（不存在则创建）
3. 创建软链接: `工具目录/skill-name → 公共目录/skill-name`
4. 更新 meta.json 中的 enabled 状态

**禁用 Skill (对某工具)**:
1. 检查软链接是否存在
2. 删除软链接（仅删除链接，不删除源文件）
3. 更新 meta.json 中的 enabled 状态

### 3. 野生 Skill 处理策略

采用 **策略 A（定期检测 + 提示收编）**：
- 应用启动或手动刷新时，检测到"非软链接"的 skill
- 提示用户是否要纳入公共目录管理
- 给用户选择：「收编到公共目录」或「保持独立」
- 保持独立的会标记为"仅限 XX 工具"

### 4. 同步状态检查流程

检查项:
- 公共目录是否存在且可访问
- 各工具目录是否存在
- 对每个 skill:
  - 软链接是否存在
  - 软链接指向是否正确
  - 源文件是否存在
- 汇总问题，提供一键修复

## 界面设计

### 主界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  🧩 Skills Manager                              ─  □  ✕        │
├──────────┬──────────────────────────────────────────────────────┤
│          │  Skills                           🔍 搜索...  ⟳ 刷新 │
│  📦 Skills├──────────────────────────────────────────────────────┤
│          │  ┌─────────────────────────────────────────────────┐ │
│  🔧 工具  │  │ ☑ superpowers                        v4.0.3   │ │
│          │  │   强大的工作流技能集                            │ │
│  ⚙️ 设置  │  │   🟢 cc  🟢 codex  ⚫ codebuddy                │ │
│          │  ├─────────────────────────────────────────────────┤ │
│  🔄 同步  │  │ ☑ playwright-skill                   v4.1.0   │ │
│          │  │   浏览器自动化测试                              │ │
│          │  │   🟢 cc  ⚫ codex  🟢 codebuddy                │ │
│          │  └─────────────────────────────────────────────────┘ │
│          ├──────────────────────────────────────────────────────┤
│          │  ⚠️ 检测到 2 个未纳入管理的 skill    [ 查看详情 ]    │
└──────────┴──────────────────────────────────────────────────────┘

图例: 🟢 已启用  ⚫ 未启用
```

### 页面列表

1. **Skills 页** - 主页面，展示所有 skills 列表，支持搜索、启用/禁用
2. **工具管理页** - 显示已检测的工具状态，支持手动添加工具路径
3. **同步状态页** - 检查软链接健康状态，显示问题并提供一键修复
4. **设置页** - 公共目录设置、启动选项、关于信息

## 项目结构

```
skills-manager/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/             # Tauri 命令
│   │   │   ├── mod.rs
│   │   │   ├── skills.rs         # skills CRUD
│   │   │   ├── tools.rs          # 工具检测与管理
│   │   │   ├── sync.rs           # 软链接同步
│   │   │   └── config.rs         # 配置管理
│   │   ├── services/             # 业务逻辑
│   │   │   ├── mod.rs
│   │   │   ├── scanner.rs        # 文件扫描
│   │   │   ├── linker.rs         # 软链接操作
│   │   │   └── detector.rs       # 工具检测
│   │   └── models/               # 数据结构
│   │       ├── mod.rs
│   │       ├── skill.rs
│   │       ├── tool.rs
│   │       └── config.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # React 前端
│   ├── components/
│   │   ├── ui/                   # shadcn 组件
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── skills/
│   │   │   ├── SkillList.tsx
│   │   │   ├── SkillCard.tsx
│   │   │   └── SkillDetail.tsx
│   │   ├── tools/
│   │   │   └── ToolCard.tsx
│   │   └── sync/
│   │       └── SyncStatus.tsx
│   ├── pages/
│   │   ├── Skills.tsx
│   │   ├── Tools.tsx
│   │   ├── Sync.tsx
│   │   ├── Settings.tsx
│   │   └── Welcome.tsx           # 首次启动引导
│   ├── hooks/
│   │   ├── useSkills.ts
│   │   ├── useTools.ts
│   │   └── useSync.ts
│   ├── lib/
│   │   ├── tauri.ts              # Tauri API 封装
│   │   └── utils.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── README.md
```

## Tauri 命令接口

```rust
// skills.rs
#[tauri::command]
fn list_skills() -> Result<Vec<Skill>, String>

#[tauri::command]
fn enable_skill(skill_id: String, tool_id: String) -> Result<(), String>

#[tauri::command]
fn disable_skill(skill_id: String, tool_id: String) -> Result<(), String>

#[tauri::command]
fn import_skill(path: String) -> Result<Skill, String>

// tools.rs
#[tauri::command]
fn detect_tools() -> Result<Vec<Tool>, String>

#[tauri::command]
fn get_tool_status(tool_id: String) -> Result<ToolStatus, String>

// sync.rs
#[tauri::command]
fn check_sync_status() -> Result<SyncReport, String>

#[tauri::command]
fn fix_sync_issues() -> Result<FixReport, String>

#[tauri::command]
fn scan_unmanaged_skills() -> Result<Vec<UnmanagedSkill>, String>

#[tauri::command]
fn adopt_skill(path: String) -> Result<Skill, String>
```

## MVP 实现路线图

### Phase 1: 项目基础搭建
- 初始化 Tauri + React + Tailwind + shadcn 项目
- 配置开发环境和构建流程
- 实现基础布局框架

### Phase 2: 核心后端
- 实现工具检测模块 (Claude Code / Codex / CodeBuddy)
- 实现 skills 扫描器
- 实现软链接管理器
- 实现配置读写

### Phase 3: 首次启动流程
- 欢迎引导页面
- 工具检测 UI
- 公共目录设置
- 现有 skills 导入

### Phase 4: 主功能页面
- Skills 列表页 (展示、搜索、启用/禁用)
- 工具管理页
- 同步状态页
- 设置页

### Phase 5: 收尾
- 边缘情况处理和错误提示优化
- 跨平台测试 (macOS / Windows / Linux)
- 打包发布
