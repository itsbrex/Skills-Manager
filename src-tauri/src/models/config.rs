use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_true")]
    pub auto_sync: bool,
    #[serde(default = "default_true")]
    pub sync_on_save: bool,
    #[serde(default = "default_editor")]
    pub default_editor: String,
    #[serde(default = "default_tab_size")]
    pub tab_size: u8,
    #[serde(default = "default_true")]
    pub show_sync_notifications: bool,
}

fn default_theme() -> String { "system".to_string() }
fn default_language() -> String { "en".to_string() }
fn default_editor() -> String { "builtin".to_string() }
fn default_tab_size() -> u8 { 2 }
fn default_true() -> bool { true }

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            language: default_language(),
            auto_sync: true,
            sync_on_save: true,
            default_editor: default_editor(),
            tab_size: default_tab_size(),
            show_sync_notifications: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub skills_dir: PathBuf,
    pub tools: HashMap<String, ToolConfig>,
    #[serde(default)]
    pub preferences: Option<UserPreferences>,
    #[serde(default)]
    pub initialized: bool,
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
            preferences: Some(UserPreferences::default()),
            initialized: false,
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
