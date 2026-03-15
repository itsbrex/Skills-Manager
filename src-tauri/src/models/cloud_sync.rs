use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncState {
    pub device_id: String,
    pub last_revision: i64,
    #[serde(default)]
    pub last_synced_at: Option<i64>,
    #[serde(default)]
    pub last_payload_hash: Option<String>,
}

impl CloudSyncState {
    pub fn new() -> Self {
        Self {
            device_id: uuid::Uuid::new_v4().simple().to_string(),
            last_revision: 0,
            last_synced_at: None,
            last_payload_hash: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncSkill {
    pub id: String,
    pub name: String,
    pub source: String,
    pub version: String,
    #[serde(default)]
    pub marketplace: Option<CloudSyncMarketplaceMeta>,
    #[serde(default)]
    pub vault: Option<CloudSyncVaultMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncMarketplaceMeta {
    pub marketplace_source_id: Option<String>,
    pub marketplace_skill_id: Option<String>,
    pub marketplace_skill_slug: Option<String>,
    pub repo_url: Option<String>,
    pub skill_path: Option<String>,
    pub remote_revision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncVaultMeta {
    pub provider: Option<String>,
    pub user_id: Option<String>,
    pub skill_id: Option<String>,
    pub version: Option<String>,
    pub hash: Option<String>,
    pub size: Option<u64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncToolState {
    pub enabled: bool,
    #[serde(default)]
    pub enabled_skills: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncCustomTool {
    pub id: String,
    pub name: String,
    pub config_path: String,
    pub skills_path: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncPayload {
    pub version: u8,
    pub updated_at: i64,
    pub device_id: String,
    #[serde(default)]
    pub skills: Vec<CloudSyncSkill>,
    #[serde(default)]
    pub tool_states: HashMap<String, CloudSyncToolState>,
    #[serde(default)]
    pub custom_tools: Vec<CloudSyncCustomTool>,
}
