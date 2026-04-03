use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::models::SkillPackageMeta;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub source: SkillSource,
    pub marketplace_meta: Option<MarketplaceMeta>,
    pub vault_meta: Option<VaultMeta>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub package_meta: Option<SkillPackageMeta>,
    pub enabled: HashMap<String, bool>,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MarketplaceMeta {
    pub marketplace_source_id: Option<String>,
    pub marketplace_skill_id: Option<String>,
    pub marketplace_skill_slug: Option<String>,
    pub repo_url: Option<String>,
    pub skill_path: Option<String>,
    pub remote_revision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultMeta {
    pub provider: Option<String>,
    pub user_id: Option<String>,
    pub skill_id: Option<String>,
    pub version: Option<String>,
    pub hash: Option<String>,
    pub size: Option<u64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    Local,
    Imported,
    Marketplace,
    Vault,
}

impl Skill {
    #[allow(dead_code)]
    pub fn new(id: String, name: String, path: PathBuf) -> Self {
        Self {
            id,
            name,
            description: None,
            version: "1.0".to_string(),
            source: SkillSource::Local,
            marketplace_meta: None,
            vault_meta: None,
            package_meta: None,
            enabled: HashMap::new(),
            path,
        }
    }

    pub fn is_enabled_for(&self, tool_id: &str) -> bool {
        self.enabled.get(tool_id).copied().unwrap_or(false)
    }
}
