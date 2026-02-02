use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::models::{Skill, SkillSource};

pub struct ScannerService;

#[derive(Debug, Clone)]
pub struct SkillMeta {
    pub name: String,
    pub description: Option<String>,
    pub version: String,
}

impl ScannerService {
    pub fn scan_skills(skills_dir: &Path) -> Result<Vec<Skill>, String> {
        if !skills_dir.exists() {
            return Ok(Vec::new());
        }

        let entries = fs::read_dir(skills_dir)
            .map_err(|e| format!("Failed to read skills directory: {}", e))?;

        let mut skills = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(skill) = Self::load_skill(&path) {
                    skills.push(skill);
                }
            }
        }

        Ok(skills)
    }

    pub fn load_skill(skill_path: &Path) -> Result<Skill, String> {
        let id = skill_path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .ok_or("Invalid skill directory name")?;

        let meta_path = skill_path.join("meta.json");
        let skill_md_path = skill_path.join("skill.md");

        let meta = if meta_path.exists() {
            Self::load_meta(&meta_path)?
        } else if skill_md_path.exists() {
            Self::parse_frontmatter(&skill_md_path)?
        } else {
            Self::generate_meta(&id)
        };

        Ok(Skill {
            id: id.clone(),
            name: meta.name,
            description: meta.description,
            version: meta.version,
            source: SkillSource::Local,
            enabled: HashMap::new(),
            path: skill_path.to_path_buf(),
        })
    }

    fn load_meta(meta_path: &Path) -> Result<SkillMeta, String> {
        let content = fs::read_to_string(meta_path)
            .map_err(|e| format!("Failed to read meta.json: {}", e))?;

        #[derive(serde::Deserialize)]
        struct MetaJson {
            name: Option<String>,
            description: Option<String>,
            version: Option<String>,
        }

        let meta: MetaJson = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse meta.json: {}", e))?;

        let name = meta.name.unwrap_or_else(|| {
            meta_path
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });

        Ok(SkillMeta {
            name,
            description: meta.description,
            version: meta.version.unwrap_or_else(|| "1.0.0".to_string()),
        })
    }

    pub fn parse_frontmatter(skill_md_path: &Path) -> Result<SkillMeta, String> {
        let content = fs::read_to_string(skill_md_path)
            .map_err(|e| format!("Failed to read skill.md: {}", e))?;

        let mut name = None;
        let mut description = None;

        if content.starts_with("---") {
            if let Some(end_idx) = content[3..].find("---") {
                let frontmatter = &content[3..3 + end_idx];
                for line in frontmatter.lines() {
                    let line = line.trim();
                    if let Some(value) = line.strip_prefix("name:") {
                        name = Some(value.trim().trim_matches('"').to_string());
                    } else if let Some(value) = line.strip_prefix("description:") {
                        description = Some(value.trim().trim_matches('"').to_string());
                    }
                }
            }
        }

        let default_name = skill_md_path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        Ok(SkillMeta {
            name: name.unwrap_or(default_name),
            description,
            version: "1.0.0".to_string(),
        })
    }

    pub fn generate_meta(id: &str) -> SkillMeta {
        SkillMeta {
            name: id.replace('-', " ").replace('_', " "),
            description: None,
            version: "1.0.0".to_string(),
        }
    }

    #[allow(dead_code)]
    pub fn save_meta(skill_path: &Path, meta: &SkillMeta) -> Result<(), String> {
        let meta_path = skill_path.join("meta.json");

        #[derive(serde::Serialize)]
        struct MetaJson<'a> {
            name: &'a str,
            description: Option<&'a str>,
            version: &'a str,
        }

        let json = MetaJson {
            name: &meta.name,
            description: meta.description.as_deref(),
            version: &meta.version,
        };

        let content = serde_json::to_string_pretty(&json)
            .map_err(|e| format!("Failed to serialize meta: {}", e))?;

        fs::write(&meta_path, content)
            .map_err(|e| format!("Failed to write meta.json: {}", e))
    }
}
