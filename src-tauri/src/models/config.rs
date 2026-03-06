use crate::models::marketplace::{MarketplaceSource, SourceType};
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
    #[serde(default = "default_false")]
    pub remove_links_when_disabling_tool: bool,
    #[serde(default)]
    pub github_token: Option<String>,
}

fn default_theme() -> String {
    "system".to_string()
}
fn default_language() -> String {
    "en".to_string()
}
fn default_editor() -> String {
    "builtin".to_string()
}
fn default_tab_size() -> u8 {
    2
}
fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}
fn default_marketplace_sources() -> Vec<MarketplaceSource> {
    vec![
        MarketplaceSource {
            id: "src_skills_sh_home".to_string(),
            name: "skills.sh Homepage".to_string(),
            url: "https://skills.sh".to_string(),
            source_type: SourceType::Crawler,
            enabled: true,
            builtin: true,
            api_key: None,
        },
        MarketplaceSource {
            id: "src_composio_awesome_claude_skills".to_string(),
            name: "awesome-claude-skills".to_string(),
            url: "https://github.com/ComposioHQ/awesome-claude-skills".to_string(),
            source_type: SourceType::Crawler,
            enabled: true,
            builtin: true,
            api_key: None,
        },
    ]
}

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
            remove_links_when_disabling_tool: false,
            github_token: None,
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
    pub marketplace_sources: Option<Vec<MarketplaceSource>>,
    #[serde(default)]
    pub poll_client_state: Option<PollClientState>,
    #[serde(default)]
    pub initialized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PollClientState {
    #[serde(default)]
    pub voter_id: Option<String>,
    #[serde(default)]
    pub voted_options: HashMap<String, String>,
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
            version: "1.1.4".to_string(),
            skills_dir: Self::default_skills_dir(),
            tools: HashMap::new(),
            custom_tools: HashMap::new(),
            preferences: Some(UserPreferences::default()),
            marketplace_sources: Some(default_marketplace_sources()),
            poll_client_state: Some(PollClientState::default()),
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
    pub fn default_skills_dir() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".skills-manager")
            .join("skills")
    }

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

#[cfg(test)]
mod tests {
    use super::default_marketplace_sources;
    use crate::models::SourceType;

    #[test]
    fn default_marketplace_sources_matches_remote_source_ids() {
        let sources = default_marketplace_sources();
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].id, "src_skills_sh_home");
        assert_eq!(sources[0].source_type, SourceType::Crawler);
        assert_eq!(sources[1].id, "src_composio_awesome_claude_skills");
        assert_eq!(sources[1].source_type, SourceType::Crawler);
    }
}
