// TypeScript type definitions matching Rust backend models
// Note: Field names use snake_case to match Rust serde serialization

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

export interface SyncReport {
  issues_count: number;
}

export interface LinkResult {
  skill_id: string;
  tool_id: string;
  message: string | null;
}

export interface LinkReport {
  success: LinkResult[];
  failed: LinkResult[];
}
