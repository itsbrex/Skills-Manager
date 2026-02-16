use crate::services::{ConfigManager, LinkReport, LinkStatus, LinkerService, ScannerService};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncReport {
    pub issues_count: usize,
}

#[tauri::command]
pub fn check_sync_status() -> Result<SyncReport, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skills = ScannerService::scan_skills(&config.skills_dir)?;
    let mut issues_count = 0;

    for (tool_id, tool_config) in config.collect_tool_configs() {
        for skill in &skills {
            let status = LinkerService::check_link_for_tool(
                &skill.path,
                &tool_config.skills_path,
                &skill.id,
                &tool_id,
            );

            if status != LinkStatus::Valid && status != LinkStatus::Missing {
                issues_count += 1;
            }
        }
    }

    Ok(SyncReport { issues_count })
}

#[tauri::command]
pub fn fix_sync_issues() -> Result<LinkReport, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skills = ScannerService::scan_skills(&config.skills_dir)?;
    let mut combined_report = LinkReport::default();

    for (tool_id, tool_config) in config.collect_tool_configs() {
        let skill_data: Vec<(String, std::path::PathBuf)> = skills
            .iter()
            .map(|s| (s.id.clone(), s.path.clone()))
            .collect();

        let enabled_skills: Vec<String> = skills
            .iter()
            .filter(|s| s.is_enabled_for(&tool_id))
            .map(|s| s.id.clone())
            .collect();

        let report = LinkerService::sync_all_for_tool(
            &skill_data,
            &tool_config.skills_path,
            &enabled_skills,
            &tool_id,
        );

        combined_report.success.extend(report.success);
        combined_report.failed.extend(report.failed);
    }

    Ok(combined_report)
}
