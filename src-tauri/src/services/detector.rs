use std::process::Command;

use crate::models::{Tool, ToolConfig, ToolDefinition, SUPPORTED_TOOLS};

pub struct DetectorService;

impl DetectorService {
    pub fn detect_all() -> Vec<Tool> {
        SUPPORTED_TOOLS
            .iter()
            .map(|def| Self::detect_tool(def))
            .collect()
    }

    pub fn detect_tool(definition: &ToolDefinition) -> Tool {
        let home_dir = dirs::home_dir().unwrap_or_default();
        let config_dir = home_dir.join(definition.config_dir);
        let skills_path = config_dir.join("commands");
        let config_path = config_dir.clone();

        let dir_exists = config_dir.exists();
        let cli_available = Self::check_cli_available(definition.cli_command);

        let tool_config = ToolConfig {
            enabled: dir_exists,
            detected: dir_exists,
            skills_path,
            config_path,
        };

        Tool {
            id: definition.id.to_string(),
            name: definition.name.to_string(),
            detected: dir_exists,
            cli_available,
            config: tool_config,
        }
    }

    pub fn check_cli_available(cli_command: &str) -> bool {
        #[cfg(target_os = "windows")]
        let result = Command::new("where").arg(cli_command).output();

        #[cfg(not(target_os = "windows"))]
        let result = Command::new("which").arg(cli_command).output();

        match result {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    pub fn get_tool_by_id(tool_id: &str) -> Option<Tool> {
        SUPPORTED_TOOLS
            .iter()
            .find(|def| def.id == tool_id)
            .map(|def| Self::detect_tool(def))
    }
}
