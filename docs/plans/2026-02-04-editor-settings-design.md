# 编辑器设置功能设计

## 概述

设置页面的默认编辑器功能需要根据本机实际安装情况动态显示可用编辑器，同时提供内置编辑器以便在应用内直接编辑 skill 文件。

## 编辑器检测机制

### 支持的编辑器列表

| 编辑器 | 检测命令 | 打开命令 |
|--------|----------|----------|
| VS Code | `which code` | `code {path}` |
| Cursor | `which cursor` | `cursor {path}` |
| Windsurf | `which windsurf` | `windsurf {path}` |
| Zed | `which zed` | `zed {path}` |
| Sublime Text | `which subl` | `subl {path}` |
| Vim | `which vim` | `vim {path}` |
| Neovim | `which nvim` | `nvim {path}` |
| Xcode | `which xcode-select` | `open -a Xcode {path}` |
| IntelliJ IDEA | `which idea` | `idea {path}` |
| PyCharm | `which pycharm` | `pycharm {path}` |
| WebStorm | `which webstorm` | `webstorm {path}` |
| Android Studio | `which studio` | `studio {path}` |
| Atom | `which atom` | `atom {path}` |
| TextMate | `which mate` | `mate {path}` |
| Warp (Terminal) | `which warp` | `warp {path}` |
| Terminal | 始终可用 (macOS) | `open -a Terminal {path}` |
| Finder | 始终可用 (macOS) | `open {path}` |
| 内置编辑器 | 始终可用 | 应用内打开 |

### 检测时机

- 应用启动时检测一次，结果缓存到 Tauri 状态管理中
- 前端通过 `get_available_editors` 获取缓存结果
- 设置页面下拉列表只显示已检测到的编辑器 + 内置编辑器

### 图标方案

- 使用 SVG 图标，每个编辑器对应一个图标文件
- 图标存放在 `src/assets/editors/` 目录
- 图标尺寸统一为 20x20
- 下拉列表样式：左侧显示编辑器图标，右侧显示名称

## 内置编辑器页面

### 页面路由

- 路径：`/editor?root={skill目录路径}&file={当前文件相对路径}`
- 打开 skill 时传入 skill 根目录，默认打开 skill.md

### 页面布局

```
┌──────────────────────────────────────────────────────────┐
│  ← 返回    skill名称                          保存  │
├────────────────┬─────────────────────────────────────────┤
│ 📁 skill-name  │                                         │
│ ├─ skill.md    │                                         │
│ ├─ 📁 examples │         Monaco Editor 编辑区域          │
│ │  ├─ ex1.md   │                                         │
│ │  └─ ex2.md   │                                         │
│ └─ 📁 templates│                                         │
│    └─ tmpl.md  │                                         │
├────────────────┴─────────────────────────────────────────┤
│  skill-name/examples/ex1.md                              │
└──────────────────────────────────────────────────────────┘
```

### 组件说明

**左侧文件树：**
- 显示 skill 目录的完整结构
- 点击文件切换编辑内容
- 当前编辑的文件高亮显示
- 支持展开/折叠目录
- 宽度固定 200px

**底部状态栏：**
- 显示当前编辑文件的完整相对路径

**顶部工具栏：**
- 左侧：返回按钮（返回上一页）、skill 名称显示
- 右侧：保存按钮（Cmd/Ctrl+S 快捷键）

### Monaco Editor 配置

- 语言：根据文件扩展名自动识别（.md → markdown, .json → json 等）
- 主题：跟随应用主题（light/dark）
- 功能：语法高亮、行号、基本快捷键
- 禁用：自动补全、代码提示（保持轻量）

### 文件操作

- 通过 Tauri 后端读取文件内容
- 保存时调用后端写入接口
- 切换文件前检查是否有未保存修改，有则弹出确认对话框

## 数据结构与接口

### 前端类型定义

```typescript
// 检测到的编辑器
interface DetectedEditor {
  id: string;           // "vscode", "cursor", "builtin" 等
  name: string;         // 显示名称
  command: string;      // 打开命令，内置编辑器为空
  available: boolean;   // 是否可用
  icon: string;         // 图标文件名
}

// 文件树节点
interface FileNode {
  name: string;         // 文件/目录名
  path: string;         // 相对于 skill 根目录的路径
  is_dir: boolean;      // 是否是目录
  children?: FileNode[]; // 子节点（仅目录有）
}
```

### Tauri 后端接口

| 接口 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `detect_editors` | 无 | `Vec<DetectedEditor>` | 启动时检测可用编辑器 |
| `get_available_editors` | 无 | `Vec<DetectedEditor>` | 获取缓存的编辑器列表 |
| `open_in_editor` | `editor_id`, `path` | `Result<()>` | 用外部编辑器打开 |
| `read_directory_tree` | `path` | `FileNode` | 读取目录结构 |
| `read_file` | `path` | `String` | 读取文件内容 |
| `write_file` | `path`, `content` | `Result<()>` | 写入文件 |

### 应用启动流程

1. 应用启动
2. 调用 `detect_editors` 检测编辑器
3. 结果缓存到 Tauri 状态管理中
4. 前端通过 `get_available_editors` 获取

## 文件修改清单

### 后端（Rust）

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/src/editors.rs` | 新增 | 编辑器检测逻辑、打开文件命令 |
| `src-tauri/src/files.rs` | 新增 | 文件读写、目录树读取 |
| `src-tauri/src/lib.rs` | 修改 | 注册新命令、启动时检测编辑器 |
| `src-tauri/src/state.rs` | 新增或修改 | 缓存检测结果的状态管理 |

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/Editor.tsx` | 新增 | 内置编辑器页面 |
| `src/components/editor/FileTree.tsx` | 新增 | 左侧文件树组件 |
| `src/components/editor/EditorToolbar.tsx` | 新增 | 顶部工具栏 |
| `src/pages/Settings.tsx` | 修改 | 编辑器下拉列表改为动态获取 |
| `src/App.tsx` | 修改 | 添加 /editor 路由 |
| `src/types/index.ts` | 修改 | 添加新类型定义 |
| `src/assets/editors/*.svg` | 新增 | 编辑器图标文件 |

### 依赖

- `@monaco-editor/react` - Monaco Editor 的 React 封装
