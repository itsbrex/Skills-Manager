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

  async function handleImport(): Promise<boolean> {
    if (selectedSkills.size === 0) {
      return true;
    }

    setIsImporting(true);
    try {
      await invoke("import_skills_to_hub", {
        skillPaths: Array.from(selectedSkills),
      });
      setImportComplete(true);
      return true;
    } catch (error) {
      console.error("Failed to import skills:", error);
      return false;
    } finally {
      setIsImporting(false);
    }
  }

  async function handleNext() {
    if (!importComplete && selectedSkills.size > 0) {
      const success = await handleImport();
      if (!success) {
        return; // 导入失败，不继续
      }
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
