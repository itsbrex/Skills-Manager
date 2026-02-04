# 编辑器设置功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现动态编辑器检测和内置 Monaco 编辑器，让用户可以根据本机安装情况选择编辑器，并在应用内直接编辑 skill 文件。

**Architecture:** 后端通过命令行检测可用编辑器并缓存结果，前端设置页面动态显示可用编辑器列表。新增内置编辑器页面，使用 Monaco Editor 实现，支持文件树浏览和编辑 skill 目录下的所有文件。

**Tech Stack:** Rust (Tauri 后端)、React、TypeScript、Monaco Editor、SVG 图标

---

## Task 1: 添加前端依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装 Monaco Editor React 封装**

Run: `cd /Users/yjw/code/projects/skills-manager && npm install @monaco-editor/react`

**Step 2: 验证安装成功**

Run: `npm list @monaco-editor/react`
Expected: 显示已安装的版本号

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @monaco-editor/react for builtin editor"
```

---

## Task 2: 添加后端编辑器模型和检测逻辑

**Files:**
- Create: `src-tauri/src/models/editor.rs`
- Modify: `src-tauri/src/models/mod.rs`

**Step 1: 创建编辑器模型文件**

Create `src-tauri/src/models/editor.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedEditor {
    pub id: String,
    pub name: String,
    pub command: String,
    pub available: bool,
    pub icon: String,
}

pub struct EditorDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub detect_cmd: &'static str,
    pub open_cmd: &'static str,
    pub icon: &'static str,
    pub always_available: bool,
}

pub const EDITOR_DEFINITIONS: &[EditorDefinition] = &[
    EditorDefinition {
        id: "vscode",
        name: "VS Code",
        detect_cmd: "code",
        open_cmd: "code",
        icon: "vscode.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "cursor",
        name: "Cursor",
        detect_cmd: "cursor",
        open_cmd: "cursor",
        icon: "cursor.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "windsurf",
        name: "Windsurf",
        detect_cmd: "windsurf",
        open_cmd: "windsurf",
        icon: "windsurf.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "zed",
        name: "Zed",
        detect_cmd: "zed",
        open_cmd: "zed",
        icon: "zed.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "sublime",
        name: "Sublime Text",
        detect_cmd: "subl",
        open_cmd: "subl",
        icon: "sublime.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "vim",
        name: "Vim",
        detect_cmd: "vim",
        open_cmd: "vim",
        icon: "vim.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "neovim",
        name: "Neovim",
        detect_cmd: "nvim",
        open_cmd: "nvim",
        icon: "neovim.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "idea",
        name: "IntelliJ IDEA",
        detect_cmd: "idea",
        open_cmd: "idea",
        icon: "idea.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "pycharm",
        name: "PyCharm",
        detect_cmd: "pycharm",
        open_cmd: "pycharm",
        icon: "pycharm.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "webstorm",
        name: "WebStorm",
        detect_cmd: "webstorm",
        open_cmd: "webstorm",
        icon: "webstorm.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "xcode",
        name: "Xcode",
        detect_cmd: "xcode-select",
        open_cmd: "open -a Xcode",
        icon: "xcode.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "android-studio",
        name: "Android Studio",
        detect_cmd: "studio",
        open_cmd: "studio",
        icon: "android-studio.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "textmate",
        name: "TextMate",
        detect_cmd: "mate",
        open_cmd: "mate",
        icon: "textmate.svg",
        always_available: false,
    },
    EditorDefinition {
        id: "terminal",
        name: "Terminal",
        detect_cmd: "",
        open_cmd: "open -a Terminal",
        icon: "terminal.svg",
        always_available: true,
    },
    EditorDefinition {
        id: "finder",
        name: "Finder",
        detect_cmd: "",
        open_cmd: "open",
        icon: "finder.svg",
        always_available: true,
    },
    EditorDefinition {
        id: "builtin",
        name: "Built-in Editor",
        detect_cmd: "",
        open_cmd: "",
        icon: "builtin.svg",
        always_available: true,
    },
];
```

**Step 2: 更新 models/mod.rs**

Add to `src-tauri/src/models/mod.rs`:

```rust
pub mod editor;
```

And add to exports:

```rust
pub use editor::{DetectedEditor, EditorDefinition, EDITOR_DEFINITIONS};
```

**Step 3: 验证编译**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo check`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src-tauri/src/models/editor.rs src-tauri/src/models/mod.rs
git commit -m "feat: add editor model and definitions"
```

---

## Task 3: 实现编辑器检测服务

**Files:**
- Create: `src-tauri/src/services/editor_detector.rs`
- Modify: `src-tauri/src/services/mod.rs`

**Step 1: 创建编辑器检测服务**

Create `src-tauri/src/services/editor_detector.rs`:

```rust
use crate::models::{DetectedEditor, EDITOR_DEFINITIONS};
use std::process::Command;

pub fn detect_editors() -> Vec<DetectedEditor> {
    EDITOR_DEFINITIONS
        .iter()
        .filter_map(|def| {
            let available = if def.always_available {
                true
            } else if def.detect_cmd.is_empty() {
                false
            } else {
                check_command_exists(def.detect_cmd)
            };

            if available {
                Some(DetectedEditor {
                    id: def.id.to_string(),
                    name: def.name.to_string(),
                    command: def.open_cmd.to_string(),
                    available: true,
                    icon: def.icon.to_string(),
                })
            } else {
                None
            }
        })
        .collect()
}

fn check_command_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

pub fn open_in_external_editor(editor_id: &str, path: &str) -> Result<(), String> {
    let editor = EDITOR_DEFINITIONS
        .iter()
        .find(|e| e.id == editor_id)
        .ok_or_else(|| format!("Editor not found: {}", editor_id))?;

    if editor.open_cmd.is_empty() {
        return Err("Cannot open with built-in editor externally".to_string());
    }

    let parts: Vec<&str> = editor.open_cmd.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Invalid open command".to_string());
    }

    let mut cmd = Command::new(parts[0]);
    for part in parts.iter().skip(1) {
        cmd.arg(part);
    }
    cmd.arg(path);

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
```

**Step 2: 更新 services/mod.rs**

Add to `src-tauri/src/services/mod.rs`:

```rust
pub mod editor_detector;
```

And add to exports:

```rust
pub use editor_detector::{detect_editors, open_in_external_editor};
```

**Step 3: 验证编译**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo check`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src-tauri/src/services/editor_detector.rs src-tauri/src/services/mod.rs
git commit -m "feat: add editor detection service"
```

---

## Task 4: 实现文件操作服务

**Files:**
- Create: `src-tauri/src/services/file_ops.rs`
- Modify: `src-tauri/src/services/mod.rs`

**Step 1: 创建文件操作服务**

Create `src-tauri/src/services/file_ops.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

pub fn read_directory_tree(root_path: &str) -> Result<FileNode, String> {
    let path = Path::new(root_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", root_path));
    }

    build_tree(path, path)
}

fn build_tree(path: &Path, root: &Path) -> Result<FileNode, String> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let relative_path = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    let relative_path = if relative_path.is_empty() {
        ".".to_string()
    } else {
        relative_path
    };

    if path.is_dir() {
        let mut children: Vec<FileNode> = fs::read_dir(path)
            .map_err(|e| e.to_string())?
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                !name_str.starts_with('.')
            })
            .filter_map(|entry| build_tree(&entry.path(), root).ok())
            .collect();

        // Sort: directories first, then files, alphabetically
        children.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(FileNode {
            name,
            path: relative_path,
            is_dir: true,
            children: Some(children),
        })
    } else {
        Ok(FileNode {
            name,
            path: relative_path,
            is_dir: false,
            children: None,
        })
    }
}

pub fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

pub fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}
```

**Step 2: 更新 services/mod.rs 导出**

Add to exports in `src-tauri/src/services/mod.rs`:

```rust
pub mod file_ops;
pub use file_ops::{read_directory_tree, read_file_content, write_file_content, FileNode};
```

**Step 3: 验证编译**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo check`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src-tauri/src/services/file_ops.rs src-tauri/src/services/mod.rs
git commit -m "feat: add file operations service"
```

---

## Task 5: 添加 Tauri 命令

**Files:**
- Create: `src-tauri/src/commands/editors.rs`
- Create: `src-tauri/src/commands/files.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建编辑器命令**

Create `src-tauri/src/commands/editors.rs`:

```rust
use crate::models::DetectedEditor;
use crate::services::{detect_editors as do_detect, open_in_external_editor};
use std::sync::Mutex;
use tauri::State;

pub struct EditorState {
    pub editors: Mutex<Vec<DetectedEditor>>,
}

impl Default for EditorState {
    fn default() -> Self {
        Self {
            editors: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn detect_available_editors(state: State<EditorState>) -> Vec<DetectedEditor> {
    let editors = do_detect();
    let mut cached = state.editors.lock().unwrap();
    *cached = editors.clone();
    editors
}

#[tauri::command]
pub fn get_available_editors(state: State<EditorState>) -> Vec<DetectedEditor> {
    let cached = state.editors.lock().unwrap();
    if cached.is_empty() {
        drop(cached);
        let editors = do_detect();
        let mut cached = state.editors.lock().unwrap();
        *cached = editors.clone();
        editors
    } else {
        cached.clone()
    }
}

#[tauri::command]
pub fn open_in_editor(editor_id: String, path: String) -> Result<(), String> {
    open_in_external_editor(&editor_id, &path)
}
```

**Step 2: 创建文件命令**

Create `src-tauri/src/commands/files.rs`:

```rust
use crate::services::{read_directory_tree as do_read_tree, read_file_content, write_file_content, FileNode};

#[tauri::command]
pub fn read_directory_tree(path: String) -> Result<FileNode, String> {
    do_read_tree(&path)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    read_file_content(&path)
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    write_file_content(&path, &content)
}
```

**Step 3: 更新 commands/mod.rs**

Replace `src-tauri/src/commands/mod.rs` with:

```rust
pub mod config;
pub mod editors;
pub mod files;
pub mod skills;
pub mod sync;
pub mod tools;

pub use config::{get_config, is_initialized, save_config};
pub use editors::{detect_available_editors, get_available_editors, open_in_editor, EditorState};
pub use files::{read_directory_tree, read_file, write_file};
pub use skills::{disable_skill, enable_skill, import_skills_to_hub, list_skills, scan_existing_skills};
pub use sync::{check_sync_status, fix_sync_issues};
pub use tools::{detect_tools, get_tool_status, set_tool_enabled};
```

**Step 4: 更新 lib.rs 注册命令**

Replace `src-tauri/src/lib.rs` with:

```rust
mod commands;
mod models;
mod services;

use commands::{
    check_sync_status, detect_available_editors, detect_tools, disable_skill, enable_skill,
    fix_sync_issues, get_available_editors, get_config, get_tool_status, import_skills_to_hub,
    is_initialized, list_skills, open_in_editor, read_directory_tree, read_file, save_config,
    scan_existing_skills, set_tool_enabled, write_file, EditorState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(EditorState::default())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            is_initialized,
            list_skills,
            enable_skill,
            disable_skill,
            detect_tools,
            get_tool_status,
            set_tool_enabled,
            check_sync_status,
            fix_sync_issues,
            scan_existing_skills,
            import_skills_to_hub,
            detect_available_editors,
            get_available_editors,
            open_in_editor,
            read_directory_tree,
            read_file,
            write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 5: 验证编译**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo check`
Expected: 编译成功

**Step 6: Commit**

```bash
git add src-tauri/src/commands/editors.rs src-tauri/src/commands/files.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add tauri commands for editors and files"
```

---

## Task 6: 添加前端类型定义

**Files:**
- Modify: `src/types/index.ts`

**Step 1: 添加新类型**

Add to `src/types/index.ts`:

```typescript
// Detected editor from backend
export interface DetectedEditor {
  id: string;
  name: string;
  command: string;
  available: boolean;
  icon: string;
}

// File tree node
export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}
```

**Step 2: 更新 UserPreferences 类型**

Update the `default_editor` type in `UserPreferences`:

```typescript
export interface UserPreferences {
  // ... existing fields
  default_editor: string; // Changed from union type to string
  // ... rest of fields
}
```

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add frontend types for editors and files"
```

---

## Task 7: 添加编辑器图标

**Files:**
- Create: `src/assets/editors/` directory
- Create: SVG icon files

**Step 1: 创建图标目录**

Run: `mkdir -p /Users/yjw/code/projects/skills-manager/src/assets/editors`

**Step 2: 创建图标组件**

Create `src/assets/editors/index.tsx`:

```tsx
import React from "react";

const iconStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  flexShrink: 0,
};

export const VSCodeIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <path d="M17.5 0L24 5.5V18.5L17.5 24L0 12L5 7.5L17.5 16V8L0 12L17.5 0Z" fill="#007ACC"/>
  </svg>
);

export const CursorIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
    <rect width="24" height="24" rx="4" fill="#1a1a1a"/>
    <path d="M7 6l10 6-10 6V6z" fill="#fff"/>
  </svg>
);

export const WindsurfIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#6366f1"/>
    <path d="M6 18L12 6l6 12H6z" fill="#fff"/>
  </svg>
);

export const ZedIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#000"/>
    <path d="M6 8h12v2H10l8 6H6v-2h8L6 8z" fill="#fff"/>
  </svg>
);

export const SublimeIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#FF9800"/>
    <path d="M6 8l12 4-12 4V8z" fill="#fff"/>
  </svg>
);

export const VimIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#019733"/>
    <path d="M6 6l6 12 6-12H6z" fill="#fff"/>
  </svg>
);

export const NeovimIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#57A143"/>
    <path d="M6 6l6 12 6-12H6z" fill="#fff"/>
  </svg>
);

export const IdeaIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#000"/>
    <circle cx="12" cy="12" r="6" fill="#FC801D"/>
  </svg>
);

export const PyCharmIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#21D789"/>
    <rect x="6" y="6" width="12" height="12" fill="#000"/>
  </svg>
);

export const WebStormIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#00CDD7"/>
    <rect x="6" y="6" width="12" height="12" fill="#000"/>
  </svg>
);

export const XcodeIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#147EFB"/>
    <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2"/>
  </svg>
);

export const AndroidStudioIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#3DDC84"/>
    <circle cx="12" cy="10" r="5" fill="#fff"/>
    <rect x="8" y="15" width="8" height="4" rx="1" fill="#fff"/>
  </svg>
);

export const TextMateIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#9B4DCA"/>
    <path d="M7 7h10v2H7V7zm2 4h6v6H9v-6z" fill="#fff"/>
  </svg>
);

export const TerminalIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#000"/>
    <path d="M6 8l4 4-4 4M12 16h6" stroke="#fff" strokeWidth="2"/>
  </svg>
);

export const FinderIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#1C9BEF"/>
    <circle cx="9" cy="10" r="2" fill="#fff"/>
    <circle cx="15" cy="10" r="2" fill="#fff"/>
    <path d="M8 15c2 2 6 2 8 0" stroke="#fff" strokeWidth="2"/>
  </svg>
);

export const BuiltinIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#6366f1"/>
    <path d="M7 7h10v10H7V7z" stroke="#fff" strokeWidth="2" fill="none"/>
    <path d="M9 11h6M9 14h4" stroke="#fff" strokeWidth="1.5"/>
  </svg>
);

export const editorIcons: Record<string, React.FC> = {
  vscode: VSCodeIcon,
  cursor: CursorIcon,
  windsurf: WindsurfIcon,
  zed: ZedIcon,
  sublime: SublimeIcon,
  vim: VimIcon,
  neovim: NeovimIcon,
  idea: IdeaIcon,
  pycharm: PyCharmIcon,
  webstorm: WebStormIcon,
  xcode: XcodeIcon,
  "android-studio": AndroidStudioIcon,
  textmate: TextMateIcon,
  terminal: TerminalIcon,
  finder: FinderIcon,
  builtin: BuiltinIcon,
};

export const getEditorIcon = (id: string): React.FC => {
  return editorIcons[id] || BuiltinIcon;
};
```

**Step 3: Commit**

```bash
git add src/assets/editors/
git commit -m "feat: add editor icon components"
```

---

## Task 8: 更新国际化文本

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/zh.ts`

**Step 1: 更新英文翻译**

Add to `editors` section in `src/i18n/locales/en.ts`:

```typescript
editors: {
  vscode: "VS Code",
  cursor: "Cursor",
  windsurf: "Windsurf",
  zed: "Zed",
  sublime: "Sublime Text",
  vim: "Vim",
  neovim: "Neovim",
  idea: "IntelliJ IDEA",
  pycharm: "PyCharm",
  webstorm: "WebStorm",
  xcode: "Xcode",
  "android-studio": "Android Studio",
  textmate: "TextMate",
  terminal: "Terminal",
  finder: "Finder",
  builtin: "Built-in Editor",
  system: "System Default",
},
editor: {
  save: "Save",
  saving: "Saving...",
  saved: "Saved",
  unsavedChanges: "Unsaved Changes",
  unsavedChangesDesc: "You have unsaved changes. Do you want to save them?",
  dontSave: "Don't Save",
  back: "Back",
},
```

**Step 2: 更新中文翻译**

Add to `editors` section in `src/i18n/locales/zh.ts`:

```typescript
editors: {
  vscode: "VS Code",
  cursor: "Cursor",
  windsurf: "Windsurf",
  zed: "Zed",
  sublime: "Sublime Text",
  vim: "Vim",
  neovim: "Neovim",
  idea: "IntelliJ IDEA",
  pycharm: "PyCharm",
  webstorm: "WebStorm",
  xcode: "Xcode",
  "android-studio": "Android Studio",
  textmate: "TextMate",
  terminal: "终端",
  finder: "访达",
  builtin: "内置编辑器",
  system: "系统默认",
},
editor: {
  save: "保存",
  saving: "保存中...",
  saved: "已保存",
  unsavedChanges: "未保存的更改",
  unsavedChangesDesc: "您有未保存的更改，是否保存？",
  dontSave: "不保存",
  back: "返回",
},
```

**Step 3: Commit**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/zh.ts
git commit -m "feat: add i18n for new editors and editor page"
```

---

## Task 9: 更新设置页面编辑器选择器

**Files:**
- Modify: `src/pages/Settings.tsx`

**Step 1: 更新 Settings.tsx**

Replace the static `editorDefinitions` and editor dropdown with dynamic version:

1. Remove the static `editorDefinitions` constant (lines 19-27)
2. Add state and effect to fetch editors from backend
3. Update the dropdown to use fetched editors with icons

Key changes:
- Import `DetectedEditor` from types
- Import `getEditorIcon` from assets/editors
- Add `const [availableEditors, setAvailableEditors] = useState<DetectedEditor[]>([]);`
- Add `useEffect` to call `invoke<DetectedEditor[]>("get_available_editors")` on mount
- Update dropdown to map over `availableEditors` and show icons

**Step 2: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: update settings page with dynamic editor selection"
```

---

## Task 10: 创建文件树组件

**Files:**
- Create: `src/components/editor/FileTree.tsx`

**Step 1: 创建 FileTree 组件**

Create `src/components/editor/FileTree.tsx`:

```tsx
import React, { useState } from "react";
import { FileNode } from "@/types";

interface FileTreeProps {
  root: FileNode;
  selectedPath: string;
  onSelectFile: (path: string) => void;
}

export function FileTree({ root, selectedPath, onSelectFile }: FileTreeProps) {
  return (
    <div style={{
      width: 200,
      borderRight: "1px solid var(--border)",
      overflow: "auto",
      flexShrink: 0,
    }}>
      <TreeNode
        node={root}
        selectedPath={selectedPath}
        onSelectFile={onSelectFile}
        level={0}
      />
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  selectedPath: string;
  onSelectFile: (path: string) => void;
  level: number;
}

function TreeNode({ node, selectedPath, onSelectFile, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (node.is_dir) {
      setExpanded(!expanded);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          paddingLeft: 8 + level * 12,
          cursor: "pointer",
          backgroundColor: isSelected ? "var(--secondary)" : "transparent",
          color: isSelected ? "var(--foreground)" : "var(--muted-foreground)",
          fontSize: 13,
          userSelect: "none",
        }}
      >
        {node.is_dir ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
      </div>
      {node.is_dir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/editor/FileTree.tsx
git commit -m "feat: add FileTree component"
```

---

## Task 11: 创建内置编辑器页面

**Files:**
- Create: `src/pages/Editor.tsx`
- Modify: `src/App.tsx`

**Step 1: 创建 Editor 页面**

Create `src/pages/Editor.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Editor from "@monaco-editor/react";
import { FileTree } from "@/components/editor/FileTree";
import { FileNode } from "@/types";
import { useTranslation } from "@/i18n";

export function EditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rootPath = searchParams.get("root") || "";
  const initialFile = searchParams.get("file") || "";

  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [selectedPath, setSelectedPath] = useState(initialFile);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<any>(null);
  const hasUnsavedChanges = content !== originalContent;

  // Load file tree
  useEffect(() => {
    if (!rootPath) return;

    async function loadTree() {
      try {
        const tree = await invoke<FileNode>("read_directory_tree", { path: rootPath });
        setFileTree(tree);

        // If no file selected, find first .md file
        if (!selectedPath && tree.children) {
          const firstMd = findFirstFile(tree, ".md") || findFirstFile(tree);
          if (firstMd) {
            setSelectedPath(firstMd);
          }
        }
      } catch (err) {
        setError(String(err));
      }
    }
    loadTree();
  }, [rootPath]);

  // Load file content
  useEffect(() => {
    if (!rootPath || !selectedPath) {
      setLoading(false);
      return;
    }

    async function loadFile() {
      setLoading(true);
      try {
        const fullPath = selectedPath === "." ? rootPath : `${rootPath}/${selectedPath}`;
        const fileContent = await invoke<string>("read_file", { path: fullPath });
        setContent(fileContent);
        setOriginalContent(fileContent);
        setError(null);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    loadFile();
  }, [rootPath, selectedPath]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, selectedPath]);

  const handleSave = async () => {
    if (!rootPath || !selectedPath || saving) return;

    setSaving(true);
    try {
      const fullPath = selectedPath === "." ? rootPath : `${rootPath}/${selectedPath}`;
      await invoke("write_file", { path: fullPath, content });
      setOriginalContent(content);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectFile = useCallback(async (path: string) => {
    if (path === selectedPath) return;

    if (hasUnsavedChanges) {
      const confirmed = window.confirm(t("editor.unsavedChangesDesc"));
      if (!confirmed) return;
    }

    setSelectedPath(path);
  }, [selectedPath, hasUnsavedChanges, t]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(t("editor.unsavedChangesDesc"));
      if (!confirmed) return;
    }
    navigate(-1);
  };

  const getLanguage = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      md: "markdown",
      json: "json",
      js: "javascript",
      ts: "typescript",
      tsx: "typescript",
      jsx: "javascript",
      css: "css",
      html: "html",
      yaml: "yaml",
      yml: "yaml",
      toml: "toml",
      rs: "rust",
      py: "python",
    };
    return langMap[ext || ""] || "plaintext";
  };

  const skillName = fileTree?.name || rootPath.split("/").pop() || "";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      backgroundColor: "var(--background)",
    }}>
      {/* Toolbar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              fontSize: 13,
              color: "var(--foreground)",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {t("editor.back")}
          </button>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)" }}>
            {skillName}
          </span>
          {hasUnsavedChanges && (
            <span style={{
              fontSize: 11,
              padding: "2px 6px",
              backgroundColor: "var(--secondary)",
              borderRadius: 4,
              color: "var(--muted-foreground)",
            }}>
              Modified
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--primary-foreground)",
            backgroundColor: hasUnsavedChanges ? "var(--foreground)" : "var(--secondary)",
            border: "none",
            borderRadius: 6,
            cursor: saving || !hasUnsavedChanges ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {saving ? t("editor.saving") : t("editor.save")}
        </button>
      </header>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* File tree */}
        {fileTree && (
          <FileTree
            root={fileTree}
            selectedPath={selectedPath}
            onSelectFile={handleSelectFile}
          />
        )}

        {/* Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted-foreground)",
            }}>
              Loading...
            </div>
          ) : error ? (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#dc2626",
            }}>
              {error}
            </div>
          ) : (
            <Editor
              height="100%"
              language={getLanguage(selectedPath)}
              value={content}
              onChange={(value) => setContent(value || "")}
              onMount={(editor) => { editorRef.current = editor; }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                parameterHints: { enabled: false },
              }}
              theme="vs-dark"
            />
          )}
        </div>
      </div>

      {/* Status bar */}
      <footer style={{
        padding: "6px 16px",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--muted-foreground)",
        flexShrink: 0,
      }}>
        {selectedPath}
      </footer>
    </div>
  );
}

function findFirstFile(node: FileNode, extension?: string): string | null {
  if (!node.is_dir) {
    if (!extension || node.name.endsWith(extension)) {
      return node.path;
    }
    return null;
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findFirstFile(child, extension);
      if (found) return found;
    }
  }
  return null;
}
```

**Step 2: 更新 App.tsx 添加路由**

Add import and route for Editor page in `src/App.tsx`:

```tsx
import { EditorPage } from "@/pages/Editor";

// In Routes, add:
<Route path="editor" element={<EditorPage />} />
```

**Step 3: Commit**

```bash
git add src/pages/Editor.tsx src/App.tsx
git commit -m "feat: add builtin editor page with Monaco"
```

---

## Task 12: 验证和测试

**Step 1: 验证后端编译**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo build`
Expected: 编译成功

**Step 2: 验证前端编译**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`
Expected: 编译成功

**Step 3: 运行应用测试**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run tauri dev`

测试项：
1. 打开设置页面，验证编辑器下拉列表显示已安装的编辑器（带图标）
2. 选择不同编辑器，保存设置
3. 选择"内置编辑器"，从 Skills 页面打开一个 skill
4. 验证编辑器页面显示文件树和编辑区域
5. 编辑文件，测试保存功能（Cmd+S）
6. 切换文件，验证未保存提示

**Step 4: Final Commit**

```bash
git add -A
git commit -m "feat: complete editor settings with detection and builtin editor"
```

---

## Summary

完成后将实现：
1. **后端**: 编辑器检测、文件操作、状态缓存
2. **前端**: 动态编辑器选择器（带图标）、内置 Monaco 编辑器页面
3. **功能**: 自动检测已安装编辑器、文件树浏览、文件编辑保存
