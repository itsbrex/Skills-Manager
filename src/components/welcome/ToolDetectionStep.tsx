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
