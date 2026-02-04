use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use crate::services::config_manager::ConfigManager;

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

    pub fn import_to_hub(skill_path: &str) -> Result<(), String> {
        let source = PathBuf::from(skill_path);
        if !source.exists() {
            return Err(format!("Skill path does not exist: {}", skill_path));
        }

        let skill_name = source
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid skill path")?;

        let config = ConfigManager::new().load()?;
        let hub_skills_dir = PathBuf::from(&config.skills_dir);

        // 确保 hub 目录存在
        std::fs::create_dir_all(&hub_skills_dir)
            .map_err(|e| format!("Failed to create hub directory: {}", e))?;

        let target = hub_skills_dir.join(skill_name);

        // 如果目标已存在，跳过
        if target.exists() {
            return Ok(());
        }

        // 如果源是软链接，获取真实路径（规范化处理相对路径）
        let real_source = if source.is_symlink() {
            std::fs::read_link(&source)
                .and_then(|p| {
                    if p.is_relative() {
                        source.parent().unwrap_or(&source).join(&p).canonicalize()
                    } else {
                        p.canonicalize()
                    }
                })
                .map_err(|e| format!("Failed to resolve symlink: {}", e))?
        } else {
            source.clone()
        };

        // 移动到 hub
        std::fs::rename(&real_source, &target)
            .or_else(|_| {
                // 如果跨文件系统，使用复制+删除
                copy_dir_all(&real_source, &target)?;
                std::fs::remove_dir_all(&real_source).or_else(|e| {
                    // 如果删除失败，清理已复制的目标
                    let _ = std::fs::remove_dir_all(&target);
                    Err(format!("Failed to remove source after copy: {}", e))
                })
            })
            .map_err(|e| format!("Failed to move skill: {}", e))?;

        // 在原位置创建软链接
        if source != real_source {
            // 原来就是软链接，删除旧的
            std::fs::remove_file(&source).ok();
        }

        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, &source)
            .map_err(|e| format!("Failed to create symlink: {}", e))?;

        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&target, &source)
            .map_err(|e| format!("Failed to create symlink: {}", e))?;

        Ok(())
    }
}

fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        // Skip hidden files/directories (starting with .)
        if file_name_str.starts_with('.') {
            continue;
        }

        let ty = entry.file_type().map_err(|e| format!("Failed to get file type: {}", e))?;

        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}
