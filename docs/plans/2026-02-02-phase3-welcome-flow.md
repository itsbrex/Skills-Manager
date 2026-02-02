# Phase 3: 首次启动流程 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现首次启动引导流程，让用户完成工具检测、公共目录设置和现有 skills 导入。

**Architecture:** 使用 React 状态机模式管理多步骤向导流程。App.tsx 根据 `is_initialized()` 返回值决定显示主界面还是欢迎向导。向导分为 4 个步骤：欢迎页 → 工具检测 → 目录设置 → Skills 导入。

**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui + Tauri Commands

---

## Task 1: 添加初始化状态检测 Hook

**Files:**
- Create: `src/hooks/useInitialization.ts`

**Step 1: 创建 useInitialization hook**

```typescript
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useInitialization() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkInitialization();
  }, []);

  async function checkInitialization() {
    try {
      const result = await invoke<boolean>("is_initialized");
      setIsInitialized(result);
    } catch (error) {
      console.error("Failed to check initialization:", error);
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function markInitialized() {
    setIsInitialized(true);
  }

  return { isInitialized, isLoading, markInitialized };
}
```

**Step 2: 验证文件创建成功**

Run: `ls -la src/hooks/useInitialization.ts`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/hooks/useInitialization.ts
git commit -m "feat: add useInitialization hook for first-run detection"
```

---

## Task 2: 创建 Welcome 页面框架

**Files:**
- Create: `src/pages/Welcome.tsx`

**Step 1: 创建 Welcome 页面组件**

```typescript
import { useState } from "react";
import { WelcomeStep } from "@/components/welcome/WelcomeStep";
import { ToolDetectionStep } from "@/components/welcome/ToolDetectionStep";
import { DirectorySetupStep } from "@/components/welcome/DirectorySetupStep";
import { ImportSkillsStep } from "@/components/welcome/ImportSkillsStep";

type WizardStep = "welcome" | "tools" | "directory" | "import";

interface WelcomeProps {
  onComplete: () => void;
}

export function Welcome({ onComplete }: WelcomeProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");

  const steps: WizardStep[] = ["welcome", "tools", "directory", "import"];
  const currentIndex = steps.indexOf(currentStep);

  function goNext() {
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      onComplete();
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  index <= currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 ${
                    index < currentIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {currentStep === "welcome" && <WelcomeStep onNext={goNext} />}
        {currentStep === "tools" && (
          <ToolDetectionStep onNext={goNext} onBack={goBack} />
        )}
        {currentStep === "directory" && (
          <DirectorySetupStep onNext={goNext} onBack={goBack} />
        )}
        {currentStep === "import" && (
          <ImportSkillsStep onNext={goNext} onBack={goBack} />
        )}
      </div>
    </div>
  );
}
```

**Step 2: 验证文件创建成功**

Run: `ls -la src/pages/Welcome.tsx`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/pages/Welcome.tsx
git commit -m "feat: add Welcome page with wizard step framework"
```

---

## Task 3: 创建 WelcomeStep 组件

**Files:**
- Create: `src/components/welcome/WelcomeStep.tsx`

**Step 1: 创建 WelcomeStep 组件**

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Puzzle } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Puzzle className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">欢迎使用 Skills Manager</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-6">
        <p className="text-muted-foreground">
          一份 Skills，多工具共享。统一管理 Claude Code、Codex、CodeBuddy 的技能库。
        </p>
        <div className="space-y-2 text-sm text-left bg-muted/50 rounded-lg p-4">
          <p className="font-medium">接下来我们将：</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>检测已安装的 AI 编程工具</li>
            <li>设置公共 Skills 目录</li>
            <li>导入现有的 Skills（可选）</li>
          </ul>
        </div>
        <Button onClick={onNext} size="lg" className="w-full">
          开始设置
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: 验证文件创建成功**

Run: `ls -la src/components/welcome/WelcomeStep.tsx`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/components/welcome/WelcomeStep.tsx
git commit -m "feat: add WelcomeStep component for intro screen"
```

---

## Task 4: 创建 ToolDetectionStep 组件

**Files:**
- Create: `src/components/welcome/ToolDetectionStep.tsx`

**Step 1: 创建 ToolDetectionStep 组件**

```typescript
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface Tool {
  id: string;
  name: string;
  detected: boolean;
  cli_available: boolean;
}

interface ToolDetectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ToolDetectionStep({ onNext, onBack }: ToolDetectionStepProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    detectTools();
  }, []);

  async function detectTools() {
    setIsLoading(true);
    try {
      const result = await invoke<Tool[]>("detect_tools");
      setTools(result);
    } catch (error) {
      console.error("Failed to detect tools:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const detectedCount = tools.filter((t) => t.detected).length;

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">检测已安装的工具</CardTitle>
        <p className="text-sm text-muted-foreground">
          我们将检测您系统中安装的 AI 编程工具
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">正在检测...</span>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {tool.detected ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{tool.name}</span>
                  </div>
                  <Badge variant={tool.detected ? "default" : "secondary"}>
                    {tool.detected ? "已检测到" : "未检测到"}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground">
              {detectedCount > 0
                ? `已检测到 ${detectedCount} 个工具`
                : "未检测到任何工具，您可以稍后手动配置"}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={detectTools}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重新检测
            </Button>
          </>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            上一步
          </Button>
          <Button onClick={onNext} className="flex-1" disabled={isLoading}>
            下一步
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: 验证文件创建成功**

Run: `ls -la src/components/welcome/ToolDetectionStep.tsx`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/components/welcome/ToolDetectionStep.tsx
git commit -m "feat: add ToolDetectionStep component for tool detection UI"
```

---

## Task 5: 创建 DirectorySetupStep 组件

**Files:**
- Create: `src/components/welcome/DirectorySetupStep.tsx`

**Step 1: 创建 DirectorySetupStep 组件**

```typescript
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, FolderOpen } from "lucide-react";

interface AppConfig {
  version: string;
  skills_dir: string;
  tools: Record<string, unknown>;
}

interface DirectorySetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function DirectorySetupStep({ onNext, onBack }: DirectorySetupStepProps) {
  const [skillsDir, setSkillsDir] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await invoke<AppConfig>("get_config");
      setSkillsDir(config.skills_dir);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  async function selectDirectory() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择 Skills 公共目录",
      });
      if (selected && typeof selected === "string") {
        setSkillsDir(selected);
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
    }
  }

  async function handleNext() {
    setIsSaving(true);
    try {
      const config = await invoke<AppConfig>("get_config");
      config.skills_dir = skillsDir;
      await invoke("save_config", { config });
      onNext();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">设置公共目录</CardTitle>
        <p className="text-sm text-muted-foreground">
          所有 Skills 将统一存放在这个目录中
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Skills 目录</label>
          <div
            onClick={selectDirectory}
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
          >
            {skillsDir ? (
              <>
                <FolderOpen className="w-5 h-5 text-primary" />
                <span className="text-sm font-mono flex-1 truncate">
                  {skillsDir}
                </span>
              </>
            ) : (
              <>
                <Folder className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  点击选择目录...
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            默认位置: ~/.skills-hub/skills
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">这个目录将用于：</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>存放所有公共 Skills</li>
            <li>通过软链接同步到各个工具</li>
            <li>统一管理和版本控制</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            上一步
          </Button>
          <Button
            onClick={handleNext}
            className="flex-1"
            disabled={!skillsDir || isSaving}
          >
            {isSaving ? "保存中..." : "下一步"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: 验证文件创建成功**

Run: `ls -la src/components/welcome/DirectorySetupStep.tsx`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/components/welcome/DirectorySetupStep.tsx
git commit -m "feat: add DirectorySetupStep component for skills directory selection"
```

---

## Task 6: 添加后端 Skills 扫描和导入命令

**Files:**
- Modify: `src-tauri/src/commands/skills.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 在 skills.rs 中添加扫描和导入命令**

在 `src-tauri/src/commands/skills.rs` 文件末尾添加：

```rust
#[tauri::command]
pub fn scan_existing_skills() -> Result<Vec<crate::models::Skill>, String> {
    let scanner = crate::services::SkillScanner::new();
    scanner.scan_all_tools()
}

#[tauri::command]
pub fn import_skills_to_hub(skill_paths: Vec<String>) -> Result<(), String> {
    let linker = crate::services::LinkerService::new();
    for path in skill_paths {
        linker.import_to_hub(&path)?;
    }
    Ok(())
}
```

**Step 2: 在 lib.rs 中注册新命令**

在 `src-tauri/src/lib.rs` 的 `invoke_handler` 中添加 `scan_existing_skills` 和 `import_skills_to_hub`。

**Step 3: 验证编译通过**

Run: `cd src-tauri && cargo check`
Expected: 编译通过，无错误

**Step 4: Commit**

```bash
git add src-tauri/src/commands/skills.rs src-tauri/src/lib.rs
git commit -m "feat: add scan_existing_skills and import_skills_to_hub commands"
```

---

## Task 7: 实现 SkillScanner.scan_all_tools 方法

**Files:**
- Modify: `src-tauri/src/services/scanner.rs`

**Step 1: 在 scanner.rs 中添加 scan_all_tools 方法**

确保 `SkillScanner` 有一个 `scan_all_tools` 方法，扫描所有已检测工具目录中的 skills：

```rust
pub fn scan_all_tools(&self) -> Result<Vec<Skill>, String> {
    let mut all_skills = Vec::new();
    let detector = DetectorService::new();
    let tools = detector.detect_all();

    for tool in tools {
        if tool.detected {
            let skills_path = &tool.config.skills_path;
            if skills_path.exists() {
                let skills = self.scan_directory(skills_path)?;
                all_skills.extend(skills);
            }
        }
    }

    // 去重（按 skill id）
    all_skills.sort_by(|a, b| a.id.cmp(&b.id));
    all_skills.dedup_by(|a, b| a.id == b.id);

    Ok(all_skills)
}
```

**Step 2: 验证编译通过**

Run: `cd src-tauri && cargo check`
Expected: 编译通过

**Step 3: Commit**

```bash
git add src-tauri/src/services/scanner.rs
git commit -m "feat: add scan_all_tools method to SkillScanner"
```

---

## Task 8: 实现 LinkerService.import_to_hub 方法

**Files:**
- Modify: `src-tauri/src/services/linker.rs`

**Step 1: 在 linker.rs 中添加 import_to_hub 方法**

```rust
pub fn import_to_hub(&self, skill_path: &str) -> Result<(), String> {
    let source = PathBuf::from(skill_path);
    if !source.exists() {
        return Err(format!("Skill path does not exist: {}", skill_path));
    }

    let skill_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid skill path")?;

    let config = ConfigManager::new().load()?;
    let hub_skills_dir = PathBuf::from(&config.skills_dir);

    // 确保 hub 目录存在
    std::fs::create_dir_all(&hub_skills_dir)
        .map_err(|e| format!("Failed to create hub directory: {}", e))?;

    let target = hub_skills_dir.join(skill_name);

    // 如果目标已存在，跳过
    if target.exists() {
        return Ok(());
    }

    // 如果源是软链接，获取真实路径
    let real_source = if source.is_symlink() {
        std::fs::read_link(&source)
            .map_err(|e| format!("Failed to read symlink: {}", e))?
    } else {
        source.clone()
    };

    // 移动到 hub
    std::fs::rename(&real_source, &target)
        .or_else(|_| {
            // 如果跨文件系统，使用复制+删除
            copy_dir_all(&real_source, &target)?;
            std::fs::remove_dir_all(&real_source)
        })
        .map_err(|e| format!("Failed to move skill: {}", e))?;

    // 在原位置创建软链接
    if source != real_source {
        // 原来就是软链接，删除旧的
        std::fs::remove_file(&source).ok();
    }

    #[cfg(unix)]
    std::os::unix::fs::symlink(&target, &source)
        .map_err(|e| format!("Failed to create symlink: {}", e))?;

    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(&target, &source)
        .map_err(|e| format!("Failed to create symlink: {}", e))?;

    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let ty = entry.file_type().map_err(|e| format!("Failed to get file type: {}", e))?;

        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}
```

**Step 2: 验证编译通过**

Run: `cd src-tauri && cargo check`
Expected: 编译通过

**Step 3: Commit**

```bash
git add src-tauri/src/services/linker.rs
git commit -m "feat: add import_to_hub method for moving skills to central directory"
```

---

## Task 9: 创建 ImportSkillsStep 组件

**Files:**
- Create: `src/components/welcome/ImportSkillsStep.tsx`

**Step 1: 创建 ImportSkillsStep 组件**

```typescript
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, CheckCircle2 } from "lucide-react";

interface Skill {
  id: string;
  name: string;
  description: string;
  path: string;
}

interface ImportSkillsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ImportSkillsStep({ onNext, onBack }: ImportSkillsStepProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  useEffect(() => {
    scanSkills();
  }, []);

  async function scanSkills() {
    setIsScanning(true);
    try {
      const result = await invoke<Skill[]>("scan_existing_skills");
      setSkills(result);
      // 默认全选
      setSelectedSkills(new Set(result.map((s) => s.path)));
    } catch (error) {
      console.error("Failed to scan skills:", error);
    } finally {
      setIsScanning(false);
    }
  }

  function toggleSkill(path: string) {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedSkills(newSelected);
  }

  async function handleImport() {
    if (selectedSkills.size === 0) {
      onNext();
      return;
    }

    setIsImporting(true);
    try {
      await invoke("import_skills_to_hub", {
        skillPaths: Array.from(selectedSkills),
      });
      setImportComplete(true);
    } catch (error) {
      console.error("Failed to import skills:", error);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleNext() {
    if (!importComplete && selectedSkills.size > 0) {
      await handleImport();
    }
    onNext();
  }

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">导入现有 Skills</CardTitle>
        <p className="text-sm text-muted-foreground">
          将现有工具中的 Skills 统一收纳到公共目录
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isScanning ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">正在扫描...</span>
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">未发现现有 Skills</p>
            <p className="text-sm text-muted-foreground">
              您可以稍后手动添加 Skills
            </p>
          </div>
        ) : importComplete ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="font-medium">导入完成！</p>
            <p className="text-sm text-muted-foreground">
              已导入 {selectedSkills.size} 个 Skills
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {skills.map((skill) => (
              <div
                key={skill.path}
                onClick={() => toggleSkill(skill.path)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedSkills.has(skill.path)
                    ? "bg-primary/10 border border-primary"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                <div>
                  <p className="font-medium">{skill.name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                    {skill.path}
                  </p>
                </div>
                <Badge variant={selectedSkills.has(skill.path) ? "default" : "secondary"}>
                  {selectedSkills.has(skill.path) ? "已选择" : "未选择"}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1" disabled={isImporting}>
            上一步
          </Button>
          <Button
            onClick={handleNext}
            className="flex-1"
            disabled={isScanning || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                导入中...
              </>
            ) : skills.length === 0 || importComplete ? (
              "完成设置"
            ) : (
              `导入并完成 (${selectedSkills.size})`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: 验证文件创建成功**

Run: `ls -la src/components/welcome/ImportSkillsStep.tsx`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/components/welcome/ImportSkillsStep.tsx
git commit -m "feat: add ImportSkillsStep component for importing existing skills"
```

---

## Task 10: 创建 welcome 组件目录的 index 文件

**Files:**
- Create: `src/components/welcome/index.ts`

**Step 1: 创建 index.ts 导出文件**

```typescript
export { WelcomeStep } from "./WelcomeStep";
export { ToolDetectionStep } from "./ToolDetectionStep";
export { DirectorySetupStep } from "./DirectorySetupStep";
export { ImportSkillsStep } from "./ImportSkillsStep";
```

**Step 2: 验证文件创建成功**

Run: `ls -la src/components/welcome/index.ts`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/components/welcome/index.ts
git commit -m "feat: add welcome components index file"
```

---

## Task 11: 更新 App.tsx 添加初始化检测逻辑

**Files:**
- Modify: `src/App.tsx`

**Step 1: 更新 App.tsx**

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Skills } from "@/pages/Skills";
import { Tools } from "@/pages/Tools";
import { Sync } from "@/pages/Sync";
import { Settings } from "@/pages/Settings";
import { Welcome } from "@/pages/Welcome";
import { useInitialization } from "@/hooks/useInitialization";

function App() {
  const { isInitialized, isLoading, markInitialized } = useInitialization();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isInitialized) {
    return <Welcome onComplete={markInitialized} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Skills />} />
          <Route path="tools" element={<Tools />} />
          <Route path="sync" element={<Sync />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Step 2: 验证 TypeScript 编译通过**

Run: `npm run check` 或 `npx tsc --noEmit`
Expected: 无 TypeScript 错误

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add initialization check and Welcome flow to App"
```

---

## Task 12: 添加 dialog 插件依赖

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/capabilities/default.json`

**Step 1: 安装 Tauri dialog 插件**

Run: `npm install @tauri-apps/plugin-dialog`

**Step 2: 在 Cargo.toml 添加 dialog 插件**

在 `[dependencies]` 中添加:
```toml
tauri-plugin-dialog = "2"
```

**Step 3: 在 capabilities 中添加 dialog 权限**

在 `src-tauri/capabilities/default.json` 的 permissions 数组中添加:
```json
"dialog:default"
```

**Step 4: 在 lib.rs 中注册插件**

在 `tauri::Builder` 中添加:
```rust
.plugin(tauri_plugin_dialog::init())
```

**Step 5: 验证编译通过**

Run: `npm run tauri build -- --debug` 或 `cd src-tauri && cargo check`
Expected: 编译通过

**Step 6: Commit**

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/capabilities/default.json src-tauri/src/lib.rs
git commit -m "feat: add tauri-plugin-dialog for directory selection"
```

---

## Task 13: 端到端测试

**Step 1: 删除 config.json 模拟首次启动**

Run: `rm -f ~/.skills-hub/config.json`

**Step 2: 启动开发服务器**

Run: `npm run tauri dev`

**Step 3: 验证 Welcome 流程**

Expected:
- 应用启动后显示 Welcome 页面
- 点击"开始设置"进入工具检测步骤
- 工具检测完成后可以进入下一步
- 可以选择或更改 Skills 目录
- 可以看到扫描到的 Skills（如果有）
- 完成后进入主界面

**Step 4: 验证再次启动**

重新启动应用，应该直接进入主界面而不是 Welcome 流程。

**Step 5: Commit 最终调整**

```bash
git add -A
git commit -m "feat: complete Phase 3 - first-run welcome wizard flow"
```

---

## Summary

Phase 3 实现包含:
- **1 个 Hook**: `useInitialization` - 检测是否首次运行
- **1 个页面**: `Welcome` - 向导容器
- **4 个组件**: `WelcomeStep`, `ToolDetectionStep`, `DirectorySetupStep`, `ImportSkillsStep`
- **2 个后端命令**: `scan_existing_skills`, `import_skills_to_hub`
- **更新 App.tsx**: 添加初始化检测和条件渲染逻辑
