use crate::models::auth::AuthSession;
use crate::models::cloud_sync::CloudSyncState;
use crate::models::marketplace::{MarketplaceSource, SourceType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VaultBackupConsent {
    Unknown,
    Granted,
    Denied,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryConsent {
    Unknown,
    Granted,
    Denied,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_true")]
    pub auto_sync: bool,
    #[serde(default = "default_true")]
    pub sync_on_save: bool,
    #[serde(default = "default_true")]
    pub cloud_sync_auto: bool,
    #[serde(default = "default_cloud_sync_interval_minutes")]
    pub cloud_sync_interval_minutes: u32,
    #[serde(default = "default_editor")]
    pub default_editor: String,
    #[serde(default = "default_tab_size")]
    pub tab_size: u8,
    #[serde(default = "default_true")]
    pub show_sync_notifications: bool,
    #[serde(default = "default_false")]
    pub remove_links_when_disabling_tool: bool,
    #[serde(default = "default_vault_backup_consent")]
    pub vault_backup_consent: VaultBackupConsent,
    #[serde(default = "default_telemetry_consent")]
    pub telemetry_consent: TelemetryConsent,
    #[serde(default)]
    pub github_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct SkillMetadata {
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default = "default_telemetry_ingest_path")]
    pub ingest_path: String,
    #[serde(default)]
    pub ingest_key: Option<String>,
    #[serde(default = "default_telemetry_heartbeat_interval_secs")]
    pub heartbeat_interval_secs: u32,
    #[serde(default = "default_telemetry_flush_interval_secs")]
    pub flush_interval_secs: u32,
    #[serde(default = "default_telemetry_startup_flush_delay_secs")]
    pub startup_flush_delay_secs: u32,
    #[serde(default = "default_telemetry_batch_size")]
    pub batch_size: u32,
}

fn default_telemetry_ingest_path() -> String {
    "/api/v1/telemetry/ingest".to_string()
}

fn default_telemetry_heartbeat_interval_secs() -> u32 {
    60
}

fn default_telemetry_flush_interval_secs() -> u32 {
    600
}

fn default_telemetry_startup_flush_delay_secs() -> u32 {
    45
}

fn default_telemetry_batch_size() -> u32 {
    20
}

fn default_theme() -> String {
    "system".to_string()
}
fn default_language() -> String {
    "en".to_string()
}
fn default_font_family() -> String {
    "system".to_string()
}
fn default_editor() -> String {
    "builtin".to_string()
}
fn default_tab_size() -> u8 {
    2
}
fn default_cloud_sync_interval_minutes() -> u32 {
    10
}
fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}
fn default_vault_backup_consent() -> VaultBackupConsent {
    VaultBackupConsent::Unknown
}
fn default_telemetry_consent() -> TelemetryConsent {
    TelemetryConsent::Unknown
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
            font_family: default_font_family(),
            language: default_language(),
            auto_sync: true,
            sync_on_save: true,
            cloud_sync_auto: true,
            cloud_sync_interval_minutes: default_cloud_sync_interval_minutes(),
            default_editor: default_editor(),
            tab_size: default_tab_size(),
            show_sync_notifications: true,
            remove_links_when_disabling_tool: false,
            vault_backup_consent: default_vault_backup_consent(),
            telemetry_consent: default_telemetry_consent(),
            github_token: None,
        }
    }
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: None,
            ingest_path: default_telemetry_ingest_path(),
            ingest_key: None,
            heartbeat_interval_secs: default_telemetry_heartbeat_interval_secs(),
            flush_interval_secs: default_telemetry_flush_interval_secs(),
            startup_flush_delay_secs: default_telemetry_startup_flush_delay_secs(),
            batch_size: default_telemetry_batch_size(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectBinding {
    pub id: String,
    pub name: String,
    pub root_path: PathBuf,
    pub skills_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub skills_dir: PathBuf,
    pub tools: HashMap<String, ToolConfig>,
    #[serde(default)]
    pub custom_tools: HashMap<String, CustomToolConfig>,
    #[serde(default)]
    pub skill_metadata: HashMap<String, SkillMetadata>,
    #[serde(default)]
    pub preferences: Option<UserPreferences>,
    #[serde(default)]
    pub marketplace_sources: Option<Vec<MarketplaceSource>>,
    #[serde(default)]
    pub poll_client_state: Option<PollClientState>,
    #[serde(default)]
    pub auth_session: Option<AuthSession>,
    #[serde(default)]
    pub cloud_sync: Option<CloudSyncState>,
    #[serde(default)]
    pub projects: Vec<ProjectBinding>,
    #[serde(default)]
    pub active_project_id: Option<String>,
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
            version: "2.0.1".to_string(),
            skills_dir: Self::default_skills_dir(),
            tools: HashMap::new(),
            custom_tools: HashMap::new(),
            skill_metadata: HashMap::new(),
            preferences: Some(UserPreferences::default()),
            marketplace_sources: Some(default_marketplace_sources()),
            poll_client_state: Some(PollClientState::default()),
            auth_session: None,
            cloud_sync: Some(CloudSyncState::new()),
            projects: Vec::new(),
            active_project_id: None,
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
    use super::AppConfig;
    use super::SkillMetadata;
    use super::TelemetryConsent;
    use super::VaultBackupConsent;
    use crate::models::auth::{AuthProfile, AuthSession};
    use crate::models::SourceType;
    use std::collections::HashMap;

    #[test]
    fn default_marketplace_sources_matches_remote_source_ids() {
        let sources = default_marketplace_sources();
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].id, "src_skills_sh_home");
        assert_eq!(sources[0].source_type, SourceType::Crawler);
        assert_eq!(sources[1].id, "src_composio_awesome_claude_skills");
        assert_eq!(sources[1].source_type, SourceType::Crawler);
    }

    #[test]
    fn telemetry_config_is_not_serialized_into_default_app_config() {
        let value = serde_json::to_value(AppConfig::default()).expect("config should serialize");
        assert_eq!(
            value.get("telemetry"),
            None,
            "telemetry runtime config should not be persisted into config.json"
        );
    }

    #[test]
    fn auth_config_persists_session() {
        let mut config = AppConfig::default();
        config.auth_session = Some(AuthSession {
            provider: "github".to_string(),
            access_token: Some("a".to_string()),
            refresh_token: Some("r".to_string()),
            profile: AuthProfile {
                username: "octo".to_string(),
                avatar_url: Some("https://example.com/a.png".to_string()),
            },
        });
        let json = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.auth_session.unwrap().provider, "github");
    }

    #[test]
    fn cloud_sync_state_persists() {
        let config = AppConfig::default();
        let device_id = config
            .cloud_sync
            .as_ref()
            .expect("cloud sync state")
            .device_id
            .clone();
        let json = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&json).unwrap();
        let state = restored.cloud_sync.expect("cloud sync restored");
        assert_eq!(state.device_id, device_id);
        assert_eq!(state.last_revision, 0);
    }

    #[test]
    fn cloud_sync_preferences_persist() {
        let config = AppConfig::default();
        let prefs = config.preferences.as_ref().expect("prefs");
        assert!(prefs.cloud_sync_auto);
        assert_eq!(prefs.cloud_sync_interval_minutes, 10);

        let json = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&json).unwrap();
        let restored_prefs = restored.preferences.as_ref().expect("prefs");
        assert!(restored_prefs.cloud_sync_auto);
        assert_eq!(restored_prefs.cloud_sync_interval_minutes, 10);
    }

    #[test]
    fn vault_backup_consent_defaults_to_unknown() {
        let config = AppConfig::default();
        let prefs = config.preferences.as_ref().expect("prefs");
        assert_eq!(prefs.vault_backup_consent, VaultBackupConsent::Unknown);

        let json = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&json).unwrap();
        let restored_prefs = restored.preferences.as_ref().expect("prefs");
        assert_eq!(
            restored_prefs.vault_backup_consent,
            VaultBackupConsent::Unknown
        );
    }

    #[test]
    fn telemetry_consent_defaults_to_unknown() {
        let config = AppConfig::default();
        let prefs = config.preferences.as_ref().expect("prefs");
        assert_eq!(prefs.telemetry_consent, TelemetryConsent::Unknown);

        let json = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&json).unwrap();
        let restored_prefs = restored.preferences.as_ref().expect("prefs");
        assert_eq!(restored_prefs.telemetry_consent, TelemetryConsent::Unknown);
    }

    #[test]
    fn font_family_preference_defaults_and_persists() {
        let config = AppConfig::default();
        let value = serde_json::to_value(&config).expect("config should serialize");
        let font_family = value
            .get("preferences")
            .and_then(|prefs| prefs.get("font_family"))
            .and_then(|value| value.as_str());
        assert_eq!(font_family, Some("system"));

        let json = serde_json::to_string(&config).expect("config should serialize");
        let restored: AppConfig = serde_json::from_str(&json).expect("config should deserialize");
        let restored_value =
            serde_json::to_value(&restored).expect("restored config should serialize");
        let restored_font_family = restored_value
            .get("preferences")
            .and_then(|prefs| prefs.get("font_family"))
            .and_then(|value| value.as_str());
        assert_eq!(restored_font_family, Some("system"));
    }

    #[test]
    fn skill_tags_default_to_empty_when_loading_legacy_config() {
        let config_json = r#"{
            "version": "2.0.1",
            "skills_dir": "/tmp/skills",
            "tools": {},
            "custom_tools": {},
            "initialized": true
        }"#;

        let config: AppConfig = serde_json::from_str(config_json).expect("deserialize config");
        assert!(config.skill_metadata.is_empty());
    }

    #[test]
    fn skill_tags_persist_through_config_serialization() {
        let mut config = AppConfig::default();
        let mut metadata = HashMap::new();
        metadata.insert(
            "react-playground".to_string(),
            SkillMetadata {
                tags: vec!["react".to_string(), "frontend".to_string()],
            },
        );
        config.skill_metadata = metadata;

        let json = serde_json::to_string(&config).expect("serialize config");
        let restored: AppConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(
            restored.skill_metadata.get("react-playground"),
            Some(&SkillMetadata {
                tags: vec!["react".to_string(), "frontend".to_string()],
            })
        );
    }
}
