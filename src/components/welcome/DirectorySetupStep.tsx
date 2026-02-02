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
