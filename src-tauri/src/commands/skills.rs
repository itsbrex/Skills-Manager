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

    if !tool_config.enabled {
        return Err(format!("Tool is disabled: {}", tool_id));
    }

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

    if !tool_config.enabled {
        return Err(format!("Tool is disabled: {}", tool_id));
    }

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

#[tauri::command]
pub fn delete_skill(skill_id: String) -> Result<(), String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skill_path = config.skills_dir.join(&skill_id);
    if !skill_path.exists() {
        return Err(format!("Skill not found: {}", skill_id));
    }

    // First, remove all symlinks from tool directories
    for (_tool_id, tool_config) in &config.tools {
        let _ = LinkerService::disable_skill(&tool_config.skills_path, &skill_id);
    }

    // Then delete the skill folder
    std::fs::remove_dir_all(&skill_path)
        .map_err(|e| format!("Failed to delete skill folder: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn refresh_skills() -> Result<Vec<Skill>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    // Scan all tool directories for new skills and import them to hub
    // Use rayon for parallel processing to speed up IO on Windows
    use rayon::prelude::*;

    let tools: Vec<_> = config.tools.values().collect();

    tools.par_iter().for_each(|tool_config| {
        if tool_config.skills_path.exists() {
            if let Ok(entries) = std::fs::read_dir(&tool_config.skills_path) {
                // Use par_bridge to iterate over directory entries in parallel
                entries.flatten().par_bridge().for_each(|entry| {
                    let path = entry.path();
                    // Skip hidden directories and non-directories
                    if !path.is_dir() {
                        return;
                    }
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with('.') {
                            return;
                        }
                    }
                    // Skip if it's already a symlink (managed by us)
                    if path.symlink_metadata().map(|m| m.file_type().is_symlink()).unwrap_or(false) {
                        return;
                    }
                    // Import this skill to hub
                    let _ = LinkerService::import_to_hub(path.to_string_lossy().as_ref());
                });
            }
        }
    });

    // Return updated skills list
    ScannerService::scan_skills(&config.skills_dir)
}
