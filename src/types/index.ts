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
  source: "builtin" | "custom";
  icon_path?: string | null;
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

  // Marketplace auth
  github_token?: string | null;
}

export interface AppConfig {
  version: string;
  skills_dir: string;
  tools: Record<string, ToolConfig>;
  custom_tools?: Record<string, CustomToolConfig>;
  preferences?: UserPreferences;
  marketplace_sources?: MarketplaceSource[];
}

export interface CustomToolConfig {
  name: string;
  config_path: string;
  skills_path: string;
  enabled: boolean;
  icon_path?: string | null;
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

export interface MarketplaceSource {
  id: string;
  name: string;
  url: string;
  source_type: "github_repo";
  enabled: boolean;
  builtin: boolean;
  api_key?: string | null;
}

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string | null;
  author: string | null;
  source_id: string;
  source_name: string;
  repo_url: string | null;
  skill_path: string | null;
  external_url: string | null;
  remote_revision?: string | null;
  tags: string[];
  install_status: "not_installed" | "installed" | "update_available";
}

export interface MarketplaceSkillsResponse {
  skills: MarketplaceSkill[];
  has_more: boolean;
}

export interface SkillFileNode {
  name: string;
  path: string;
  is_dir: boolean;
  download_url: string | null;
  sha?: string | null;
  children?: SkillFileNode[];
}

export interface InstallResult {
  success: boolean;
  skill_id: string;
  message: string | null;
  installed_path: string | null;
}

export interface MarketplaceSyncResult {
  checked: number;
  updated: number;
  failed: string[];
}

export interface MarketplaceUpdateCheckResult {
  performed: boolean;
  checked: number;
  update_available: number;
}

export interface UpdateInfo {
  has_update: boolean;
  latest_version: string;
  download_url: string;
  release_notes?: string;
}

export interface FeedbackRequest {
  user_info: string;
  content: string;
  source?: string | null;
  language?: string | null;
}
