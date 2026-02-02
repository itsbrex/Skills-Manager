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
