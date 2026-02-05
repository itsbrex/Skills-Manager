use std::path::PathBuf;

use crate::models::Tool;
use crate::services::{ConfigManager, DetectorService};

#[tauri::command]
pub fn detect_tools() -> Result<Vec<Tool>, String> {
    Ok(DetectorService::detect_all())
}

#[tauri::command]
pub fn get_tool_status(tool_id: String) -> Result<Tool, String> {
    DetectorService::get_tool_by_id(&tool_id)
        .ok_or_else(|| format!("Tool not found: {}", tool_id))
}

#[tauri::command]
pub fn set_tool_enabled(tool_id: String, enabled: bool) -> Result<(), String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;

    let tool_config = config
        .tools
        .get_mut(&tool_id)
        .ok_or_else(|| format!("Tool not found: {}", tool_id))?;

    tool_config.enabled = enabled;
    manager.save(&config)
}

#[tauri::command]
pub fn update_tool_paths(
    tool_id: String,
    config_path: Option<String>,
    skills_path: Option<String>,
) -> Result<(), String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;

    let tool_config = config
        .tools
        .get_mut(&tool_id)
        .ok_or_else(|| format!("Tool not found: {}", tool_id))?;

    if let Some(path) = config_path {
        tool_config.config_path = PathBuf::from(path);
        // Re-detect if directory exists
        tool_config.detected = tool_config.config_path.exists();
    }

    if let Some(path) = skills_path {
        tool_config.skills_path = PathBuf::from(path);
    }

    manager.save(&config)
}
