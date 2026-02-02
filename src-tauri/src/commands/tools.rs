use crate::models::Tool;
use crate::services::DetectorService;

#[tauri::command]
pub fn detect_tools() -> Result<Vec<Tool>, String> {
    Ok(DetectorService::detect_all())
}

#[tauri::command]
pub fn get_tool_status(tool_id: String) -> Result<Tool, String> {
    DetectorService::get_tool_by_id(&tool_id)
        .ok_or_else(|| format!("Tool not found: {}", tool_id))
}
