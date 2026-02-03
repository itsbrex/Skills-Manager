import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skill, AppConfig } from "@/types";

// Tool name abbreviations
const toolAbbreviations: Record<string, string> = {
  "claude-code": "CC",
  "codex": "Codex",
  "codebuddy": "CB",
};

function getToolAbbreviation(toolId: string): string {
  return toolAbbreviations[toolId] || toolId;
}

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [skillsResult, configResult] = await Promise.all([
        invoke<Skill[]>("list_skills"),
        invoke<AppConfig>("get_config"),
      ]);
      setSkills(skillsResult);
      setConfig(configResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (skillId: string, toolId: string, enabled: boolean) => {
    const toggleKey = `${skillId}:${toolId}`;
    setTogglingSkill(toggleKey);
    try {
      if (enabled) {
        await invoke("enable_skill", { skillId, toolId });
      } else {
        await invoke("disable_skill", { skillId, toolId });
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTogglingSkill(null);
    }
  };

  const filteredSkills = skills.filter((skill) => {
    const query = searchQuery.toLowerCase();
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.id.toLowerCase().includes(query)
    );
  });

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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Skills</h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <div className="mb-4">
        <Input
          placeholder="Search skills by name or id..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="grid gap-4 pb-4">
          {filteredSkills.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? "No skills match your search." : "No skills found."}
            </p>
          ) : (
            filteredSkills.map((skill) => (
              <Card key={skill.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{skill.name}</CardTitle>
                    <Badge variant="secondary">v{skill.version}</Badge>
                  </div>
                  <CardDescription>
                    {skill.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    {toolIds.map((toolId) => {
                      const isEnabled = skill.enabled[toolId] ?? false;
                      const toggleKey = `${skill.id}:${toolId}`;
                      const isToggling = togglingSkill === toggleKey;

                      return (
                        <div key={toolId} className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            disabled={isToggling}
                            onCheckedChange={(checked) =>
                              handleToggle(skill.id, toolId, checked)
                            }
                          />
                          <span
                            className={`text-sm font-medium ${
                              isEnabled ? "text-green-600" : "text-muted-foreground"
                            }`}
                          >
                            {getToolAbbreviation(toolId)}
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
