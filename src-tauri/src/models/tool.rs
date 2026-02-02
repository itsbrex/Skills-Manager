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
    pub cli_command: &'static str,
}

pub const SUPPORTED_TOOLS: &[ToolDefinition] = &[
    ToolDefinition {
        id: "claude-code",
        name: "Claude Code",
        config_dir: ".claude",
        cli_command: "claude",
    },
    ToolDefinition {
        id: "codex",
        name: "Codex",
        config_dir: ".codex",
        cli_command: "codex",
    },
    ToolDefinition {
        id: "codebuddy",
        name: "CodeBuddy",
        config_dir: ".codebuddy",
        cli_command: "codebuddy",
    },
];
