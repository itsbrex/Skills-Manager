import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SyncReport, LinkReport, SyncStatus, LinkStatus } from "@/types";

// Tool name mappings
const toolNames: Record<string, string> = {
  "claude-code": "Claude Code",
  "codex": "Codex",
  "codebuddy": "CodeBuddy",
};

function getToolName(toolId: string): string {
  return toolNames[toolId] || toolId;
}

// Status badge configuration
function getStatusBadge(status: LinkStatus) {
  switch (status) {
    case "valid":
      return { variant: "default" as const, label: "正常", className: "bg-green-600 hover:bg-green-700" };
    case "broken":
      return { variant: "destructive" as const, label: "损坏", className: "" };
    case "wrongtarget":
      return { variant: "destructive" as const, label: "目标错误", className: "" };
    case "notalink":
      return { variant: "secondary" as const, label: "非链接", className: "" };
    case "missing":
      return { variant: "outline" as const, label: "未启用", className: "" };
    default:
      return { variant: "secondary" as const, label: status, className: "" };
  }
}

// Group statuses by skill_id
function groupBySkill(statuses: SyncStatus[]): Record<string, SyncStatus[]> {
  return statuses.reduce((acc, status) => {
    if (!acc[status.skill_id]) {
      acc[status.skill_id] = [];
    }
    acc[status.skill_id].push(status);
    return acc;
  }, {} as Record<string, SyncStatus[]>);
}

export function Sync() {
  const [report, setReport] = useState<SyncReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<LinkReport | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFixResult(null);
    try {
      const result = await invoke<SyncReport>("check_sync_status");
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFix = async () => {
    setFixing(true);
    setError(null);
    try {
      const result = await invoke<LinkReport>("fix_sync_issues");
      setFixResult(result);
      // Refresh status after fix
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFixing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">检查同步状态...</p>
      </div>
    );
  }

  const totalLinks = report?.statuses.length ?? 0;
  const validCount = report?.statuses.filter((s) => s.status === "valid").length ?? 0;
  const issuesCount = report?.issues_count ?? 0;
  const groupedStatuses = report ? groupBySkill(report.statuses) : {};
  const skillIds = Object.keys(groupedStatuses).sort();

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">同步状态</h1>
        <div className="flex items-center gap-2">
          {issuesCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleFix}
              disabled={fixing}
            >
              {fixing ? "修复中..." : "一键修复"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {fixResult && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">修复结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-green-600 font-medium">
                成功: {fixResult.success.length}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-destructive font-medium">
                失败: {fixResult.failed.length}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Statistics */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalLinks}</p>
              <p className="text-sm text-muted-foreground">总链接数</p>
            </div>
            <Separator orientation="vertical" className="h-12" />
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{validCount}</p>
              <p className="text-sm text-muted-foreground">正常</p>
            </div>
            <Separator orientation="vertical" className="h-12" />
            <div className="text-center">
              <p className={`text-2xl font-bold ${issuesCount > 0 ? "text-destructive" : ""}`}>
                {issuesCount}
              </p>
              <p className="text-sm text-muted-foreground">问题数</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-skill status */}
      <ScrollArea className="flex-1">
        <div className="grid gap-4 pb-4">
          {skillIds.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              暂无同步数据
            </p>
          ) : (
            skillIds.map((skillId) => (
              <Card key={skillId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">{skillId}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    {groupedStatuses[skillId].map((status) => {
                      const badgeConfig = getStatusBadge(status.status);
                      return (
                        <div key={status.tool_id} className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {getToolName(status.tool_id)}:
                          </span>
                          <Badge
                            variant={badgeConfig.variant}
                            className={badgeConfig.className}
                          >
                            {badgeConfig.label}
                          </Badge>
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
