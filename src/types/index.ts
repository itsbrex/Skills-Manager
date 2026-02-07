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

// User preferences for the application
export interface UserPreferences {
  // Appearance
  theme: "light" | "dark" | "system";
  language: "zh" | "en";

  // Sync behavior
  auto_sync: boolean;
  sync_on_save: boolean;

  // Editor settings
  default_editor: string;
  tab_size: 2 | 4;

  // Notifications
  show_sync_notifications: boolean;
}

export interface AppConfig {
  version: string;
  skills_dir: string;
  tools: Record<string, ToolConfig>;
  preferences?: UserPreferences;
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

// Detected editor from backend
export interface DetectedEditor {
  id: string;
  name: string;
  command: string;
  available: boolean;
  icon: string;
  icon_data?: string;  // Base64 encoded PNG from app bundle
}

// File tree node
export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface UpdateInfo {
  has_update: boolean;
  latest_version: string;
  download_url: string;
  release_notes?: string;
}
