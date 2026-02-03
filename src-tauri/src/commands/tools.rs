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
