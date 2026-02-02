use crate::models::Skill;
use crate::services::{ConfigManager, LinkerService, ScannerService};

#[tauri::command]
pub fn list_skills() -> Result<Vec<Skill>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    ScannerService::scan_skills(&config.skills_dir)
}

#[tauri::command]
pub fn enable_skill(skill_id: String, tool_id: String) -> Result<(), String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let tool_config = config
        .tools
        .get(&tool_id)
        .ok_or_else(|| format!("Tool not found: {}", tool_id))?;

    let skill_path = config.skills_dir.join(&skill_id);
    if !skill_path.exists() {
        return Err(format!("Skill not found: {}", skill_id));
    }

    LinkerService::enable_skill(&skill_path, &tool_config.skills_path, &skill_id)
}

#[tauri::command]
pub fn disable_skill(skill_id: String, tool_id: String) -> Result<(), String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let tool_config = config
        .tools
        .get(&tool_id)
        .ok_or_else(|| format!("Tool not found: {}", tool_id))?;

    LinkerService::disable_skill(&tool_config.skills_path, &skill_id)
}

#[tauri::command]
pub fn scan_existing_skills() -> Result<Vec<crate::models::Skill>, String> {
    crate::services::ScannerService::scan_all_tools()
}

#[tauri::command]
pub fn import_skills_to_hub(skill_paths: Vec<String>) -> Result<(), String> {
    for path in skill_paths {
        crate::services::LinkerService::import_to_hub(&path)?;
    }
    Ok(())
}
