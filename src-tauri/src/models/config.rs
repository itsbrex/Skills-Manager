use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub skills_dir: PathBuf,
    pub tools: HashMap<String, ToolConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    pub enabled: bool,
    pub detected: bool,
    pub skills_path: PathBuf,
    pub config_path: PathBuf,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: "1.0.0".to_string(),
            skills_dir: dirs::home_dir()
                .unwrap_or_default()
                .join(".skills-hub")
                .join("skills"),
            tools: HashMap::new(),
        }
    }
}

impl ToolConfig {
    #[allow(dead_code)]
    pub fn new(skills_path: PathBuf, config_path: PathBuf) -> Self {
        Self {
            enabled: false,
            detected: false,
            skills_path,
            config_path,
        }
    }
}
