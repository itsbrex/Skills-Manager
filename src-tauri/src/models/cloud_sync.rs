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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncToolState {
    pub enabled: bool,
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
    pub skills: Vec<CloudSyncSkill>,
    pub tool_states: HashMap<String, CloudSyncToolState>,
    pub custom_tools: Vec<CloudSyncCustomTool>,
}
