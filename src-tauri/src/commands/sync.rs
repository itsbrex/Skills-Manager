use crate::services::{ConfigManager, LinkReport, LinkStatus, LinkerService, ScannerService};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncReport {
    pub issues_count: usize,
}

fn collect_active_tool_configs(
    config: &crate::models::AppConfig,
) -> Vec<(String, crate::models::ToolConfig)> {
    config
        .collect_tool_configs()
        .into_iter()
        .filter(|(_, tool_config)| tool_config.enabled && tool_config.detected)
        .collect()
}

#[tauri::command]
pub fn check_sync_status() -> Result<SyncReport, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skills = ScannerService::scan_skills(&config.skills_dir)?;
    let mut issues_count = 0;

    for (tool_id, tool_config) in collect_active_tool_configs(&config) {
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

    for (tool_id, tool_config) in collect_active_tool_configs(&config) {
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

#[cfg(test)]
mod tests {
    use super::collect_active_tool_configs;
    use crate::models::{AppConfig, CustomToolConfig, ToolConfig};
    use std::collections::HashMap;
    use std::path::PathBuf;

    fn mk_tool(enabled: bool, detected: bool) -> ToolConfig {
        ToolConfig {
            enabled,
            detected,
            skills_path: PathBuf::from("/tmp/skills"),
            config_path: PathBuf::from("/tmp/config"),
        }
    }

    #[test]
    fn collect_active_tool_configs_only_returns_enabled_and_detected() {
        let mut config = AppConfig::default();
        config.tools = HashMap::from([
            ("active".to_string(), mk_tool(true, true)),
            ("disabled".to_string(), mk_tool(false, true)),
            ("undetected".to_string(), mk_tool(true, false)),
        ]);
        config.custom_tools = HashMap::from([(
            "custom-active".to_string(),
            CustomToolConfig {
                name: "Custom".to_string(),
                config_path: PathBuf::from("/tmp/custom"),
                skills_path: PathBuf::from("/tmp/custom/skills"),
                enabled: true,
                icon_path: None,
            },
        )]);

        let mut ids: Vec<String> = collect_active_tool_configs(&config)
            .into_iter()
            .map(|(id, _)| id)
            .collect();
        ids.sort();

        assert_eq!(ids, vec!["active".to_string()]);
    }
}
