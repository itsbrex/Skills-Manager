use rayon::prelude::*;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::models::{AppConfig, Skill, SkillSource};
use crate::services::detector::DetectorService;
use crate::services::linker::{is_symlink_or_junction, LinkerService};

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

    pub fn scan_skills_with_config(
        skills_dir: &Path,
        config: &AppConfig,
    ) -> Result<Vec<Skill>, String> {
        if !skills_dir.exists() {
            return Ok(Vec::new());
        }

        let entries: Vec<_> = fs::read_dir(skills_dir)
            .map_err(|e| format!("Failed to read skills directory: {}", e))?
            .flatten()
            .collect();

        // Use rayon for parallel processing of skills
        // This significantly speeds up scanning on Windows where file I/O (especially canonicalize) is slow
        let skills: Vec<Skill> = entries
            .par_iter()
            .filter_map(|entry| {
                let path = entry.path();
                if path.is_dir() {
                    Self::load_skill_with_config(&path, config).ok()
                } else {
                    None
                }
            })
            .collect();

        Ok(skills)
    }

    #[allow(dead_code)]
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
        let skill_md_upper = skill_path.join("SKILL.md");
        let skill_md_lower = skill_path.join("skill.md");

        let mut meta = if meta_path.exists() {
            Self::load_meta(&meta_path)?
        } else if skill_md_upper.exists() {
            Self::parse_frontmatter(&skill_md_upper)?
        } else if skill_md_lower.exists() {
            Self::parse_frontmatter(&skill_md_lower)?
        } else {
            Self::generate_meta(&id)
        };
        if meta.description.is_none() {
            let fallback = if skill_md_upper.exists() {
                Self::parse_frontmatter(&skill_md_upper).ok()
            } else if skill_md_lower.exists() {
                Self::parse_frontmatter(&skill_md_lower).ok()
            } else {
                None
            };
            if let Some(fallback_meta) = fallback {
                let description = fallback_meta.description.and_then(|raw| {
                    let trimmed = raw.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed.to_string())
                    }
                });
                if description.is_some() {
                    meta.description = description;
                }
            }
        }

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
    fn check_enabled_status(
        skill_path: &Path,
        skill_id: &str,
        config: &AppConfig,
    ) -> HashMap<String, bool> {
        let mut enabled = HashMap::new();

        for (tool_id, tool_config) in config.collect_tool_configs() {
            if LinkerService::tool_uses_copy_mode(&tool_id) {
                let copied_path = tool_config.skills_path.join(skill_id);
                if copied_path.exists() && copied_path.is_dir() {
                    enabled.insert(tool_id, true);
                }
                continue;
            }

            let link_path = tool_config.skills_path.join(skill_id);

            // Check if a symlink or Junction (Windows) exists at the expected location
            if is_symlink_or_junction(&link_path) {
                // For symlinks, read_link gives us the target.
                // For Junctions, read_link also works (returns the junction target).
                if let Ok(target) = fs::read_link(&link_path) {
                    // FAST PATH: String comparison
                    // On Windows, canonicalize() causes excessive I/O.
                    // Most of the time, checking if the target path ends with the skill ID is sufficient.
                    let target_str = target.to_string_lossy();
                    // Check for direct match or path ending (handling separators)
                    let is_fast_match = target_str.ends_with(skill_id) || target == skill_path;

                    let is_enabled = if is_fast_match {
                        true
                    } else {
                        // SLOW PATH: Fallback to canonicalization only if simple check fails
                        let canonical_skill_path = skill_path.canonicalize().ok();

                        // Resolve relative paths
                        let resolved_target = if target.is_relative() {
                            link_path
                                .parent()
                                .map(|p| p.join(&target))
                                .and_then(|p| p.canonicalize().ok())
                        } else {
                            target.canonicalize().ok()
                        };

                        match (&resolved_target, &canonical_skill_path) {
                            (Some(t), Some(s)) => t == s,
                            _ => false,
                        }
                    };

                    enabled.insert(tool_id, is_enabled);
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
            version: meta.version.unwrap_or_else(|| "1.0".to_string()),
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
            version: "1.0".to_string(),
        })
    }

    pub fn generate_meta(id: &str) -> SkillMeta {
        SkillMeta {
            name: id.replace('-', " ").replace('_', " "),
            description: None,
            version: "1.0".to_string(),
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

        fs::write(&meta_path, content).map_err(|e| format!("Failed to write meta.json: {}", e))
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

        // De-duplicate (by skill id)
        all_skills.sort_by(|a, b| a.id.cmp(&b.id));
        all_skills.dedup_by(|a, b| a.id == b.id);

        Ok(all_skills)
    }
}

#[cfg(test)]
mod tests {
    use super::ScannerService;
    use crate::models::AppConfig;
    use crate::test_support::with_temp_home;
    use std::fs;

    #[test]
    fn load_skill_with_config_falls_back_to_skill_md_description_when_meta_is_null() {
        with_temp_home(|home| {
            let config = AppConfig::default();
            let skill_dir = home
                .join(".skills-manager")
                .join("skills")
                .join("marketplace-test-skill");
            fs::create_dir_all(&skill_dir).expect("create skill dir");

            let meta_content = r#"{
  "name": "marketplace-test-skill",
  "description": null,
  "version": "1.0"
}"#;
            fs::write(skill_dir.join("meta.json"), meta_content).expect("write meta.json");

            let skill_md = r#"---
name: marketplace-test-skill
description: "Description from SKILL.md"
---

# marketplace-test-skill
"#;
            fs::write(skill_dir.join("SKILL.md"), skill_md).expect("write SKILL.md");

            let skill =
                ScannerService::load_skill_with_config(&skill_dir, &config).expect("load skill");
            assert_eq!(
                skill.description,
                Some("Description from SKILL.md".to_string())
            );
        });
    }

    #[test]
    fn load_skill_with_config_keeps_meta_description_when_present() {
        with_temp_home(|home| {
            let config = AppConfig::default();
            let skill_dir = home
                .join(".skills-manager")
                .join("skills")
                .join("marketplace-test-skill");
            fs::create_dir_all(&skill_dir).expect("create skill dir");

            let meta_content = r#"{
  "name": "marketplace-test-skill",
  "description": "Description from meta",
  "version": "1.0"
}"#;
            fs::write(skill_dir.join("meta.json"), meta_content).expect("write meta.json");

            let skill_md = r#"---
name: marketplace-test-skill
description: "Description from SKILL.md"
---

# marketplace-test-skill
"#;
            fs::write(skill_dir.join("SKILL.md"), skill_md).expect("write SKILL.md");

            let skill =
                ScannerService::load_skill_with_config(&skill_dir, &config).expect("load skill");
            assert_eq!(skill.description, Some("Description from meta".to_string()));
        });
    }
}
