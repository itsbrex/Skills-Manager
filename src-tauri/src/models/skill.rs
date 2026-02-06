use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub source: SkillSource,
    pub enabled: HashMap<String, bool>,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    Local,
    Imported,
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
            enabled: HashMap::new(),
            path,
        }
    }

    pub fn is_enabled_for(&self, tool_id: &str) -> bool {
        self.enabled.get(tool_id).copied().unwrap_or(false)
    }
}
