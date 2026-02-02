use serde::{Deserialize, Serialize};
use crate::services::{ConfigManager, LinkerService, LinkReport, LinkStatus, ScannerService};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub skill_id: String,
    pub tool_id: String,
    pub status: LinkStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncReport {
    pub statuses: Vec<SyncStatus>,
    pub issues_count: usize,
}

#[tauri::command]
pub fn check_sync_status() -> Result<SyncReport, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skills = ScannerService::scan_skills(&config.skills_dir)?;
    let mut statuses = Vec::new();
    let mut issues_count = 0;

    for (tool_id, tool_config) in &config.tools {
        for skill in &skills {
            let status = LinkerService::check_link(
                &skill.path,
                &tool_config.skills_path,
                &skill.id,
            );

            if status != LinkStatus::Valid && status != LinkStatus::Missing {
                issues_count += 1;
            }

            statuses.push(SyncStatus {
                skill_id: skill.id.clone(),
                tool_id: tool_id.clone(),
                status,
            });
        }
    }

    Ok(SyncReport {
        statuses,
        issues_count,
    })
}

#[tauri::command]
pub fn fix_sync_issues() -> Result<LinkReport, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skills = ScannerService::scan_skills(&config.skills_dir)?;
    let mut combined_report = LinkReport::default();

    for (tool_id, tool_config) in &config.tools {
        let skill_data: Vec<(String, std::path::PathBuf)> = skills
            .iter()
            .map(|s| (s.id.clone(), s.path.clone()))
            .collect();

        let enabled_skills: Vec<String> = skills
            .iter()
            .filter(|s| s.is_enabled_for(tool_id))
            .map(|s| s.id.clone())
            .collect();

        let report = LinkerService::sync_all(&skill_data, &tool_config.skills_path, &enabled_skills);

        combined_report.success.extend(report.success);
        combined_report.failed.extend(report.failed);
    }

    Ok(combined_report)
}
