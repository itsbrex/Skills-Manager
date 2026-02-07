use std::process::Command;

use crate::models::{Tool, ToolConfig, ToolDefinition, SUPPORTED_TOOLS};
use crate::services::ConfigManager;

pub struct DetectorService;

impl DetectorService {
    pub fn detect_all() -> Vec<Tool> {
        let manager = ConfigManager::new();
        let saved_config = manager.load().ok();

        SUPPORTED_TOOLS
            .iter()
            .map(|def| Self::detect_tool(def, &saved_config))
            .collect()
    }

    pub fn detect_tool(definition: &ToolDefinition, saved_config: &Option<crate::models::AppConfig>) -> Tool {
        let home_dir = dirs::home_dir().unwrap_or_default();

        // Prioritize saved custom paths, fallback to defaults
        let (config_path, skills_path) = if let Some(saved) = saved_config
            .as_ref()
            .and_then(|c| c.tools.get(definition.id))
        {
            (saved.config_path.clone(), saved.skills_path.clone())
        } else {
            let mut config_dir = home_dir.join(definition.config_dir);

            // Prioritize default config_dir, but check alternatives if it doesn't exist
            if !config_dir.exists() {
                for alt in definition.alt_config_dirs {
                    let alt_dir = home_dir.join(alt);
                    if alt_dir.exists() {
                        config_dir = alt_dir;
                        break;
                    }
                }
            }

            (config_dir.clone(), config_dir.join("skills"))
        };

        let dir_exists = config_path.exists();
        let cli_available = Self::check_cli_available(definition.cli_command);

        // Get saved enabled state from config, default to false
        let enabled = saved_config
            .as_ref()
            .and_then(|c| c.tools.get(definition.id))
            .map(|tc| tc.enabled)
            .unwrap_or(false);

        let tool_config = ToolConfig {
            enabled,
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
        {
            use std::os::windows::process::CommandExt;
            let result = Command::new("where")
                .arg(cli_command)
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output();
            match result {
                Ok(output) => output.status.success(),
                Err(_) => false,
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let result = Command::new("which").arg(cli_command).output();
            match result {
                Ok(output) => output.status.success(),
                Err(_) => false,
            }
        }
    }

    pub fn get_tool_by_id(tool_id: &str) -> Option<Tool> {
        let manager = ConfigManager::new();
        let saved_config = manager.load().ok();

        SUPPORTED_TOOLS
            .iter()
            .find(|def| def.id == tool_id)
            .map(|def| Self::detect_tool(def, &saved_config))
    }
}
