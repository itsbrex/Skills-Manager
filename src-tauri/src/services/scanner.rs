use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::models::{Skill, SkillSource, AppConfig};
use crate::services::detector::DetectorService;

pub struct ScannerService;

#[derive(Debug, Clone)]
pub struct SkillMeta {
    pub name: String,
    pub description: Option<String>,
    pub version: String,
}

impl ScannerService {
    pub fn scan_skills(skills_dir: &Path) -> Result<Vec<Skill>, String> {
        // Load config to check enabled status for each tool
        let config = crate::services::ConfigManager::new().load()?;
        Self::scan_skills_with_config(skills_dir, &config)
    }

    pub fn scan_skills_with_config(skills_dir: &Path, config: &AppConfig) -> Result<Vec<Skill>, String> {
        if !skills_dir.exists() {
            return Ok(Vec::new());
        }

        let entries = fs::read_dir(skills_dir)
            .map_err(|e| format!("Failed to read skills directory: {}", e))?;

        let mut skills = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(skill) = Self::load_skill_with_config(&path, config) {
                    skills.push(skill);
                }
            }
        }

        Ok(skills)
    }

    pub fn load_skill(skill_path: &Path) -> Result<Skill, String> {
        let config = crate::services::ConfigManager::new().load()?;
        Self::load_skill_with_config(skill_path, &config)
    }

    pub fn load_skill_with_config(skill_path: &Path, config: &AppConfig) -> Result<Skill, String> {
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

        // Check enabled status by looking for symlinks in each tool's skills directory
        let enabled = Self::check_enabled_status(skill_path, &id, config);

        Ok(Skill {
            id: id.clone(),
            name: meta.name,
            description: meta.description,
            version: meta.version,
            source: SkillSource::Local,
            enabled,
            path: skill_path.to_path_buf(),
        })
    }

    /// Check if this skill is enabled for each tool by looking for symlinks
    fn check_enabled_status(skill_path: &Path, skill_id: &str, config: &AppConfig) -> HashMap<String, bool> {
        let mut enabled = HashMap::new();

        // Canonicalize the skill source path for comparison
        let canonical_skill_path = skill_path.canonicalize().ok();

        for (tool_id, tool_config) in &config.tools {
            let link_path = tool_config.skills_path.join(skill_id);

            // Check if a symlink exists at the expected location
            if let Ok(metadata) = link_path.symlink_metadata() {
                if metadata.file_type().is_symlink() {
                    // Read the symlink target and check if it points to our skill
                    if let Ok(target) = fs::read_link(&link_path) {
                        // Resolve relative paths
                        let resolved_target = if target.is_relative() {
                            link_path.parent()
                                .map(|p| p.join(&target))
                                .and_then(|p| p.canonicalize().ok())
                        } else {
                            target.canonicalize().ok()
                        };

                        // Compare with our skill path
                        let is_enabled = match (&resolved_target, &canonical_skill_path) {
                            (Some(t), Some(s)) => t == s,
                            _ => {
                                // Fallback: compare the raw target with skill_path
                                target == skill_path ||
                                target.ends_with(skill_id)
                            }
                        };

                        enabled.insert(tool_id.clone(), is_enabled);
                    }
                }
            }
        }

        enabled
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

    pub fn scan_all_tools() -> Result<Vec<Skill>, String> {
        let mut all_skills = Vec::new();
        let tools = DetectorService::detect_all();

        for tool in tools {
            if tool.detected {
                let skills_path = &tool.config.skills_path;
                if skills_path.exists() {
                    let skills = Self::scan_skills(skills_path)?;
                    all_skills.extend(skills);
                }
            }
        }

        // 去重（按 skill id）
        all_skills.sort_by(|a, b| a.id.cmp(&b.id));
        all_skills.dedup_by(|a, b| a.id == b.id);

        Ok(all_skills)
    }
}
