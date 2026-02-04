use std::fs;
use std::path::PathBuf;

use crate::models::{AppConfig, ToolConfig, SUPPORTED_TOOLS};

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Self {
        let config_path = Self::get_config_path();
        Self { config_path }
    }

    fn get_config_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".skills-hub")
            .join("config.json")
    }

    pub fn load(&self) -> Result<AppConfig, String> {
        if !self.config_path.exists() {
            return self.init_default();
        }

        let content = fs::read_to_string(&self.config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&self.config_path, content)
            .map_err(|e| format!("Failed to write config: {}", e))
    }

    pub fn init_default(&self) -> Result<AppConfig, String> {
        let home_dir = dirs::home_dir().unwrap_or_default();
        let mut config = AppConfig::default();

        for tool_def in SUPPORTED_TOOLS {
            let tool_dir = home_dir.join(tool_def.config_dir);
            let detected = tool_dir.exists();
            let tool_config = ToolConfig {
                enabled: detected, // Enable by default if detected
                detected,
                skills_path: tool_dir.join("skills"),
                config_path: tool_dir,
            };
            config.tools.insert(tool_def.id.to_string(), tool_config);
        }

        self.save(&config)?;
        Ok(config)
    }

    pub fn is_initialized(&self) -> bool {
        match self.load() {
            Ok(config) => config.initialized,
            Err(_) => false,
        }
    }
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new()
    }
}
