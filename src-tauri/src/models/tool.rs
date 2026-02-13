use super::config::ToolConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ToolSource {
    Builtin,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub cli_available: bool,
    pub config: ToolConfig,
    pub source: ToolSource,
    #[serde(default)]
    pub icon_path: Option<PathBuf>,
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
            source: ToolSource::Builtin,
            icon_path: None,
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
    ToolDefinition {
        id: "droid",
        name: "Droid",
        config_dir: ".factory",
        alt_config_dirs: &[".droid"],
        cli_command: "droid",
    },
    ToolDefinition {
        id: "augment",
        name: "Augment",
        config_dir: ".augment",
        alt_config_dirs: &[],
        cli_command: "augment",
    },
    ToolDefinition {
        id: "openclaw",
        name: "OpenClaw",
        config_dir: ".openclaw",
        alt_config_dirs: &[],
        cli_command: "openclaw",
    },
    ToolDefinition {
        id: "cline",
        name: "Cline",
        config_dir: ".cline",
        alt_config_dirs: &[],
        cli_command: "cline",
    },
    ToolDefinition {
        id: "vercel-skills",
        name: "Vercel Skills",
        config_dir: ".agents",
        alt_config_dirs: &[".vercel", ".vercel-skills"],
        cli_command: "vercel",
    },
];

#[cfg(test)]
mod tests {
    use super::SUPPORTED_TOOLS;

    #[test]
    fn supported_tools_include_recent_builtins() {
        let ids: Vec<&str> = SUPPORTED_TOOLS.iter().map(|tool| tool.id).collect();

        assert!(ids.contains(&"droid"));
        assert!(ids.contains(&"augment"));
        assert!(ids.contains(&"openclaw"));
        assert!(ids.contains(&"cline"));
        assert!(ids.contains(&"vercel-skills"));
    }

    #[test]
    fn droid_and_vercel_skills_use_expected_base_directories() {
        let droid = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "droid")
            .expect("droid should exist in supported tools");
        let vercel_skills = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "vercel-skills")
            .expect("vercel-skills should exist in supported tools");

        assert_eq!(droid.config_dir, ".factory");
        assert_eq!(vercel_skills.config_dir, ".agents");
    }
}
