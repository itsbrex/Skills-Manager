# Phase 4: 主功能页面实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Skills Manager 的四个主要管理页面：Skills 列表页、工具管理页、同步状态页、设置页。

**Architecture:** 所有后端命令已就绪（list_skills, enable_skill, disable_skill, detect_tools, check_sync_status, fix_sync_issues, get_config, save_config）。本阶段专注于前端 UI 实现，通过 Tauri invoke 调用后端。每个页面独立开发，使用已有的 shadcn/ui 组件库。

**Tech Stack:** React + TypeScript, Tailwind CSS, shadcn/ui (button, card, switch, badge, scroll-area, separator), Tauri invoke API

---

## Task 1: 添加 Input 和 Alert UI 组件

**Files:**
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/alert.tsx`

**Step 1: 添加 Input 组件**

```bash
cd /Users/yjw/code/projects/skills-manager && npx shadcn@latest add input -y
```

**Step 2: 添加 Alert 组件**

```bash
cd /Users/yjw/code/projects/skills-manager && npx shadcn@latest add alert -y
```

**Step 3: 验证组件已添加**

```bash
ls -la /Users/yjw/code/projects/skills-manager/src/components/ui/
```

Expected: 应显示 input.tsx 和 alert.tsx

**Step 4: Commit**

```bash
cd /Users/yjw/code/projects/skills-manager && git add src/components/ui/ && git commit -m "feat: add input and alert UI components"
```

---

## Task 2: 定义前端 TypeScript 类型

**Files:**
- Create: `src/types/index.ts`

**Step 1: 创建类型定义文件**

```typescript
// src/types/index.ts

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  version: string;
  source: "local" | "imported";
  enabled: Record<string, boolean>;
  path: string;
}

export interface ToolConfig {
  enabled: boolean;
  detected: boolean;
  skills_path: string;
  config_path: string;
}

export interface Tool {
  id: string;
  name: string;
  detected: boolean;
  cli_available: boolean;
  config: ToolConfig;
}

export interface AppConfig {
  version: string;
  skills_dir: string;
  tools: Record<string, ToolConfig>;
}

export type LinkStatus = "valid" | "broken" | "wrongtarget" | "notalink" | "missing";

export interface SyncStatus {
  skill_id: string;
  tool_id: string;
  status: LinkStatus;
}

export interface SyncReport {
  statuses: SyncStatus[];
  issues_count: number;
}

export interface LinkResult {
  skill_id: string;
  tool_id: string;
  status: LinkStatus;
  message: string | null;
}

export interface LinkReport {
  success: LinkResult[];
  failed: LinkResult[];
}
```

**Step 2: 验证文件创建成功**

```bash
cat /Users/yjw/code/projects/skills-manager/src/types/index.ts
```

**Step 3: Commit**

```bash
cd /Users/yjw/code/projects/skills-manager && git add src/types/index.ts && git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: 实现 Skills 列表页 - 基础布局

**Files:**
- Modify: `src/pages/Skills.tsx`

**Step 1: 实现 Skills 页面基础结构**

```tsx
// src/pages/Skills.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Skill, AppConfig } from "@/types";

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [skillsData, configData] = await Promise.all([
        invoke<Skill[]>("list_skills"),
        invoke<AppConfig>("get_config"),
      ]);
      setSkills(skillsData);
      setConfig(configData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (skillId: string, toolId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await invoke("enable_skill", { skillId, toolId });
      } else {
        await invoke("disable_skill", { skillId, toolId });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const filteredSkills = skills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toolIds = config ? Object.keys(config.tools) : [];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Skills</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理你的 Skills，控制各工具的启用状态
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          刷新
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="搜索 Skills..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {filteredSkills.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchTerm ? "没有找到匹配的 Skills" : "暂无 Skills"}
            </p>
          ) : (
            filteredSkills.map((skill) => (
              <Card key={skill.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{skill.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {skill.description || "无描述"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">v{skill.version}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {toolIds.map((toolId) => {
                      const isEnabled = skill.enabled[toolId] ?? false;
                      const toolName = toolId === "claude-code" ? "CC" :
                                       toolId === "codex" ? "Codex" :
                                       toolId === "codebuddy" ? "CB" : toolId;
                      return (
                        <div key={toolId} className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) =>
                              handleToggle(skill.id, toolId, checked)
                            }
                          />
                          <span className={`text-sm ${isEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                            {toolName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

**Step 2: 运行开发服务器验证**

```bash
cd /Users/yjw/code/projects/skills-manager && npm run tauri dev
```

Expected: Skills 页面应显示技能列表，包含搜索框和工具启用开关

**Step 3: Commit**

```bash
cd /Users/yjw/code/projects/skills-manager && git add src/pages/Skills.tsx && git commit -m "feat: implement Skills list page with search and toggle"
```

---

## Task 4: 实现工具管理页

**Files:**
- Modify: `src/pages/Tools.tsx`

**Step 1: 实现 Tools 页面**

```tsx
// src/pages/Tools.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tool } from "@/types";

export function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoke<Tool[]>("detect_tools");
      setTools(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">检测工具中...</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工具管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            查看已检测的 AI 编程工具状态
          </p>
        </div>
        <Button variant="outline" onClick={loadTools}>
          重新检测
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="grid gap-4 pr-4">
          {tools.map((tool) => (
            <Card key={tool.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{tool.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={tool.detected ? "default" : "secondary"}>
                      {tool.detected ? "已检测" : "未检测到"}
                    </Badge>
                    {tool.cli_available && (
                      <Badge variant="outline">CLI 可用</Badge>
                    )}
                  </div>
                </div>
                <CardDescription>ID: {tool.id}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">配置目录:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {tool.config.config_path}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Skills 目录:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {tool.config.skills_path}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">状态:</span>
                    <span className={tool.config.enabled ? "text-green-600" : "text-muted-foreground"}>
                      {tool.config.enabled ? "已启用" : "未启用"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {tools.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              未检测到任何 AI 编程工具
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

**Step 2: 验证页面渲染**

```bash
cd /Users/yjw/code/projects/skills-manager && npm run tauri dev
```

Expected: Tools 页面应显示已检测的工具列表

**Step 3: Commit**

```bash
cd /Users/yjw/code/projects/skills-manager && git add src/pages/Tools.tsx && git commit -m "feat: implement Tools management page"
```

---

## Task 5: 实现同步状态页

**Files:**
- Modify: `src/pages/Sync.tsx`

**Step 1: 实现 Sync 页面**

```tsx
// src/pages/Sync.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { SyncReport, LinkReport, LinkStatus } from "@/types";

const statusLabels: Record<LinkStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  valid: { label: "正常", variant: "default" },
  broken: { label: "损坏", variant: "destructive" },
  wrongtarget: { label: "目标错误", variant: "destructive" },
  notalink: { label: "非链接", variant: "secondary" },
  missing: { label: "未启用", variant: "outline" },
};

export function Sync() {
  const [report, setReport] = useState<SyncReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<LinkReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      setFixResult(null);
      const data = await invoke<SyncReport>("check_sync_status");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const fixIssues = async () => {
    try {
      setFixing(true);
      setError(null);
      const result = await invoke<LinkReport>("fix_sync_issues");
      setFixResult(result);
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFixing(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Group statuses by skill
  const groupedBySkill = report?.statuses.reduce((acc, status) => {
    if (!acc[status.skill_id]) {
      acc[status.skill_id] = [];
    }
    acc[status.skill_id].push(status);
    return acc;
  }, {} as Record<string, typeof report.statuses>) ?? {};

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">检查同步状态...</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">同步状态</h1>
          <p className="text-muted-foreground text-sm mt-1">
            检查软链接健康状态，修复同步问题
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkStatus} disabled={loading}>
            刷新
          </Button>
          {report && report.issues_count > 0 && (
            <Button onClick={fixIssues} disabled={fixing}>
              {fixing ? "修复中..." : `修复 ${report.issues_count} 个问题`}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {fixResult && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">修复结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">
                成功: {fixResult.success.length}
              </span>
              <span className="text-destructive">
                失败: {fixResult.failed.length}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-2xl font-bold">{report.statuses.length}</span>
                <span className="text-muted-foreground text-sm ml-2">总链接</span>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-2xl font-bold text-green-600">
                  {report.statuses.filter((s) => s.status === "valid").length}
                </span>
                <span className="text-muted-foreground text-sm ml-2">正常</span>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-2xl font-bold text-destructive">
                  {report.issues_count}
                </span>
                <span className="text-muted-foreground text-sm ml-2">问题</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {Object.entries(groupedBySkill).map(([skillId, statuses]) => (
            <Card key={skillId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{skillId}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {statuses.map((status) => {
                    const { label, variant } = statusLabels[status.status] || { label: status.status, variant: "secondary" as const };
                    const toolName = status.tool_id === "claude-code" ? "Claude Code" :
                                     status.tool_id === "codex" ? "Codex" :
                                     status.tool_id === "codebuddy" ? "CodeBuddy" : status.tool_id;
                    return (
                      <div key={status.tool_id} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{toolName}:</span>
                        <Badge variant={variant}>{label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {Object.keys(groupedBySkill).length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              暂无同步数据
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

**Step 2: 验证页面渲染**

```bash
cd /Users/yjw/code/projects/skills-manager && npm run tauri dev
```

Expected: Sync 页面应显示同步状态概览和详细列表

**Step 3: Commit**

```bash
cd /Users/yjw/code/projects/skills-manager && git add src/pages/Sync.tsx && git commit -m "feat: implement Sync status page with fix functionality"
```

---

## Task 6: 实现设置页

**Files:**
- Modify: `src/pages/Settings.tsx`

**Step 1: 实现 Settings 页面**

```tsx
// src/pages/Settings.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { AppConfig } from "@/types";

export function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoke<AppConfig>("get_config");
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择 Skills 目录",
      });
      if (selected && config) {
        setConfig({ ...config, skills_dir: selected as string });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await invoke("save_config", { config });
      setSuccess("配置已保存");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">加载配置...</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">设置</h1>
        <p className="text-muted-foreground text-sm mt-1">
          应用程序设置和配置
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/10 text-green-600 rounded-md text-sm">
          {success}
        </div>
      )}

      <div className="space-y-6 flex-1">
        <Card>
          <CardHeader>
            <CardTitle>公共 Skills 目录</CardTitle>
            <CardDescription>
              所有 Skills 统一存放的目录，各工具通过软链接引用
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={config?.skills_dir || ""}
                readOnly
                className="flex-1"
              />
              <Button variant="outline" onClick={handleSelectDirectory}>
                选择目录
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>工具配置</CardTitle>
            <CardDescription>
              已配置的 AI 编程工具路径信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {config && Object.entries(config.tools).map(([toolId, toolConfig], index) => (
                <div key={toolId}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="space-y-2">
                    <h4 className="font-medium">
                      {toolId === "claude-code" ? "Claude Code" :
                       toolId === "codex" ? "Codex" :
                       toolId === "codebuddy" ? "CodeBuddy" : toolId}
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Skills 路径:</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {toolConfig.skills_path}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">配置路径:</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {toolConfig.config_path}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {config && Object.keys(config.tools).length === 0 && (
                <p className="text-muted-foreground text-sm">暂无配置的工具</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>关于</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">版本:</span>
                <span>{config?.version || "1.0"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">说明:</span>
                <span>Skills Manager - 统一管理多 AI 工具的 Skills</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 pt-4 border-t">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: 验证页面渲染**

```bash
cd /Users/yjw/code/projects/skills-manager && npm run tauri dev
```

Expected: Settings 页面应显示配置信息和保存功能

**Step 3: Commit**

```bash
cd /Users/yjw/code/projects/skills-manager && git add src/pages/Settings.tsx && git commit -m "feat: implement Settings page with config management"
```

---

## Task 7: 最终验证和整体测试

**Step 1: 运行完整应用测试**

```bash
cd /Users/yjw/code/projects/skills-manager && npm run tauri dev
```

Expected: 所有四个页面都能正常工作

**Step 2: 验证各页面功能**

手动测试清单:
- [ ] Skills 页: 列表显示、搜索过滤、启用/禁用切换
- [ ] Tools 页: 工具检测、状态显示
- [ ] Sync 页: 同步状态检查、一键修复
- [ ] Settings 页: 配置显示、目录选择、保存功能

**Step 3: 创建 Phase 4 完成提交**

```bash
cd /Users/yjw/code/projects/skills-manager && git add -A && git commit -m "feat: complete Phase 4 - implement main management pages

- Skills page: list, search, enable/disable per tool
- Tools page: detect and display AI programming tools
- Sync page: check link status, one-click fix
- Settings page: config management, directory selection"
```

---

## 总结

Phase 4 共包含 7 个任务：
1. 添加 Input 和 Alert UI 组件
2. 定义前端 TypeScript 类型
3. 实现 Skills 列表页
4. 实现工具管理页
5. 实现同步状态页
6. 实现设置页
7. 最终验证和整体测试

预估提交次数：6 次
