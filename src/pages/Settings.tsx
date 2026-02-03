import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppConfig } from "@/types";

// Tool name display mapping
const toolDisplayNames: Record<string, string> = {
  "claude-code": "Claude Code",
  "codex": "Codex",
  "codebuddy": "CodeBuddy",
};

function getToolDisplayName(toolId: string): string {
  return toolDisplayNames[toolId] || toolId;
}

export function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configResult = await invoke<AppConfig>("get_config");
      setConfig(configResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择公共 Skills 目录",
      });
      if (selected && config) {
        setConfig({
          ...config,
          skills_dir: selected as string,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await invoke("save_config", { config });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
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

  if (error) {
    return (
      <div className="p-6">
        <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">无法加载配置</p>
      </div>
    );
  }

  const toolIds = Object.keys(config.tools);

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold text-foreground mb-6">设置</h1>

      <div className="flex-1 space-y-6 overflow-auto pb-4">
        {/* Public Skills Directory Card */}
        <Card>
          <CardHeader>
            <CardTitle>公共 Skills 目录</CardTitle>
            <CardDescription>
              所有 Skills 的存储位置，各工具将通过符号链接引用此目录中的 Skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input
                value={config.skills_dir}
                readOnly
                className="flex-1 bg-muted"
              />
              <Button variant="outline" onClick={handleSelectDirectory}>
                选择目录
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tool Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>工具配置信息</CardTitle>
            <CardDescription>
              已配置的 AI 编码工具及其路径信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {toolIds.map((toolId, index) => {
                const toolConfig = config.tools[toolId];
                return (
                  <div key={toolId}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="space-y-2">
                      <h4 className="font-medium text-foreground">
                        {getToolDisplayName(toolId)}
                      </h4>
                      <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                        <span className="text-muted-foreground">Skills 路径:</span>
                        <span className="text-foreground font-mono text-xs break-all">
                          {toolConfig.skills_path || "-"}
                        </span>
                        <span className="text-muted-foreground">配置路径:</span>
                        <span className="text-foreground font-mono text-xs break-all">
                          {toolConfig.config_path || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {toolIds.length === 0 && (
                <p className="text-muted-foreground text-sm">暂无已配置的工具</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* About Card */}
        <Card>
          <CardHeader>
            <CardTitle>关于</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="text-muted-foreground">版本:</span>
                <span className="text-foreground">{config.version}</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="text-muted-foreground">说明:</span>
                <span className="text-foreground">
                  Skills Manager - 统一管理多 AI 工具的 Skills
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button and Feedback */}
      <div className="pt-4 border-t">
        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存设置"}
          </Button>
          {saveSuccess && (
            <span className="text-sm text-green-600">设置已保存</span>
          )}
          {saveError && (
            <span className="text-sm text-destructive">{saveError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
