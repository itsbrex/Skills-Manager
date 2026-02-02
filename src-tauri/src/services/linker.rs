use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LinkStatus {
    Valid,
    Broken,
    WrongTarget,
    NotALink,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkResult {
    pub skill_id: String,
    pub tool_id: String,
    pub status: LinkStatus,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LinkReport {
    pub success: Vec<LinkResult>,
    pub failed: Vec<LinkResult>,
}

pub struct LinkerService;

impl LinkerService {
    pub fn enable_skill(
        skill_source: &Path,
        tool_skills_dir: &Path,
        skill_id: &str,
    ) -> Result<(), String> {
        if !tool_skills_dir.exists() {
            fs::create_dir_all(tool_skills_dir)
                .map_err(|e| format!("Failed to create skills directory: {}", e))?;
        }

        let link_path = tool_skills_dir.join(skill_id);

        if link_path.exists() || link_path.symlink_metadata().is_ok() {
            fs::remove_file(&link_path)
                .or_else(|_| fs::remove_dir_all(&link_path))
                .map_err(|e| format!("Failed to remove existing link: {}", e))?;
        }

        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(skill_source, &link_path)
                .map_err(|e| format!("Failed to create symlink: {}", e))?;
        }

        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(skill_source, &link_path)
                .map_err(|e| format!("Failed to create symlink: {}", e))?;
        }

        Ok(())
    }

    pub fn disable_skill(tool_skills_dir: &Path, skill_id: &str) -> Result<(), String> {
        let link_path = tool_skills_dir.join(skill_id);

        if !link_path.exists() && link_path.symlink_metadata().is_err() {
            return Ok(());
        }

        fs::remove_file(&link_path)
            .or_else(|_| fs::remove_dir_all(&link_path))
            .map_err(|e| format!("Failed to remove link: {}", e))
    }

    pub fn check_link(
        skill_source: &Path,
        tool_skills_dir: &Path,
        skill_id: &str,
    ) -> LinkStatus {
        let link_path = tool_skills_dir.join(skill_id);

        match link_path.symlink_metadata() {
            Ok(meta) => {
                if meta.file_type().is_symlink() {
                    match fs::read_link(&link_path) {
                        Ok(target) => {
                            if target == skill_source {
                                if target.exists() {
                                    LinkStatus::Valid
                                } else {
                                    LinkStatus::Broken
                                }
                            } else {
                                LinkStatus::WrongTarget
                            }
                        }
                        Err(_) => LinkStatus::Broken,
                    }
                } else {
                    LinkStatus::NotALink
                }
            }
            Err(_) => LinkStatus::Missing,
        }
    }

    pub fn sync_all(
        skills: &[(String, std::path::PathBuf)],
        tool_skills_dir: &Path,
        enabled_skills: &[String],
    ) -> LinkReport {
        let mut report = LinkReport::default();

        for (skill_id, skill_path) in skills {
            let should_be_enabled = enabled_skills.contains(skill_id);

            if should_be_enabled {
                match Self::enable_skill(skill_path, tool_skills_dir, skill_id) {
                    Ok(_) => {
                        report.success.push(LinkResult {
                            skill_id: skill_id.clone(),
                            tool_id: String::new(),
                            status: LinkStatus::Valid,
                            message: Some("Enabled successfully".to_string()),
                        });
                    }
                    Err(e) => {
                        report.failed.push(LinkResult {
                            skill_id: skill_id.clone(),
                            tool_id: String::new(),
                            status: LinkStatus::Broken,
                            message: Some(e),
                        });
                    }
                }
            } else {
                match Self::disable_skill(tool_skills_dir, skill_id) {
                    Ok(_) => {
                        report.success.push(LinkResult {
                            skill_id: skill_id.clone(),
                            tool_id: String::new(),
                            status: LinkStatus::Missing,
                            message: Some("Disabled successfully".to_string()),
                        });
                    }
                    Err(e) => {
                        report.failed.push(LinkResult {
                            skill_id: skill_id.clone(),
                            tool_id: String::new(),
                            status: LinkStatus::Broken,
                            message: Some(e),
                        });
                    }
                }
            }
        }

        report
    }
}
