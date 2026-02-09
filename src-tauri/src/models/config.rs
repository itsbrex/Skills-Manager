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
    pub custom_tools: HashMap<String, CustomToolConfig>,
    #[serde(default)]
    pub preferences: Option<UserPreferences>,
    #[serde(default)]
    pub initialized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomToolConfig {
    pub name: String,
    pub config_path: PathBuf,
    pub skills_path: PathBuf,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub icon_path: Option<PathBuf>,
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
            version: "1.0.3".to_string(),
            skills_dir: dirs::home_dir()
                .unwrap_or_default()
                .join(".skills-hub")
                .join("skills"),
            tools: HashMap::new(),
            custom_tools: HashMap::new(),
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

impl AppConfig {
    pub fn get_tool_config(&self, tool_id: &str) -> Option<ToolConfig> {
        if let Some(tool) = self.tools.get(tool_id) {
            return Some(tool.clone());
        }

        self.custom_tools.get(tool_id).map(|custom| {
            let detected = custom.config_path.exists();
            ToolConfig {
                enabled: custom.enabled,
                detected,
                skills_path: custom.skills_path.clone(),
                config_path: custom.config_path.clone(),
            }
        })
    }

    pub fn collect_tool_configs(&self) -> Vec<(String, ToolConfig)> {
        let mut configs: Vec<(String, ToolConfig)> = self
            .tools
            .iter()
            .map(|(id, config)| (id.clone(), config.clone()))
            .collect();

        for (id, custom) in &self.custom_tools {
            let detected = custom.config_path.exists();
            configs.push((
                id.clone(),
                ToolConfig {
                    enabled: custom.enabled,
                    detected,
                    skills_path: custom.skills_path.clone(),
                    config_path: custom.config_path.clone(),
                },
            ));
        }

        configs
    }
}
