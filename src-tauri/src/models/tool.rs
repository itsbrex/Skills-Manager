use serde::{Deserialize, Serialize};
use super::config::ToolConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub cli_available: bool,
    pub config: ToolConfig,
}

impl Tool {
    #[allow(dead_code)]
    pub fn new(id: String, name: String, config: ToolConfig) -> Self {
        Self {
            id,
            name,
            detected: false,
            cli_available: false,
            config,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ToolDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub config_dir: &'static str,
    pub alt_config_dirs: &'static [&'static str],
    pub cli_command: &'static str,
}

pub const SUPPORTED_TOOLS: &[ToolDefinition] = &[
    ToolDefinition {
        id: "claude-code",
        name: "Claude Code",
        config_dir: ".claude",
        alt_config_dirs: &[],
        cli_command: "claude",
    },
    ToolDefinition {
        id: "codex",
        name: "Codex",
        config_dir: ".codex",
        alt_config_dirs: &[],
        cli_command: "codex",
    },
    ToolDefinition {
        id: "codebuddy",
        name: "CodeBuddy",
        config_dir: ".codebuddy",
        alt_config_dirs: &[],
        cli_command: "codebuddy",
    },
    ToolDefinition {
        id: "opencode",
        name: "OpenCode",
        config_dir: ".config/opencode",
        alt_config_dirs: &[".opencode"],
        cli_command: "opencode",
    },
    ToolDefinition {
        id: "cursor",
        name: "Cursor",
        config_dir: ".cursor",
        alt_config_dirs: &[],
        cli_command: "cursor",
    },
    ToolDefinition {
        id: "gemini",
        name: "Gemini CLI",
        config_dir: ".gemini",
        alt_config_dirs: &[],
        cli_command: "gemini",
    },
    ToolDefinition {
        id: "antigravity",
        name: "Antigravity",
        config_dir: ".antigravity",
        alt_config_dirs: &[],
        cli_command: "antigravity",
    },
    ToolDefinition {
        id: "windsurf",
        name: "Windsurf",
        config_dir: ".windsurf",
        alt_config_dirs: &[],
        cli_command: "windsurf",
    },
    ToolDefinition {
        id: "trae",
        name: "Trae",
        config_dir: ".trae",
        alt_config_dirs: &[],
        cli_command: "trae",
    },
];
