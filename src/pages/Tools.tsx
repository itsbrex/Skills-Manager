import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tool } from "@/types";

export function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Tool[]>("detect_tools");
      setTools(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    detectTools();
  }, [detectTools]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">检测工具中...</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Tools</h1>
        <Button variant="outline" size="sm" onClick={detectTools}>
          重新检测
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="grid gap-4 pb-4">
          {tools.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">未检测到任何工具</p>
              <p className="text-muted-foreground text-sm mt-2">
                请确保已安装支持的 AI 编程工具（如 Claude Code、Codex 等）
              </p>
            </div>
          ) : (
            tools.map((tool) => (
              <Card key={tool.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">配置路径:</span>
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        {tool.config.config_path || "未设置"}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Skills 路径:</span>
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        {tool.config.skills_path || "未设置"}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">启用状态:</span>
                      <span
                        className={
                          tool.config.enabled
                            ? "text-green-600 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {tool.config.enabled ? "已启用" : "未启用"}
                      </span>
                    </div>
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
