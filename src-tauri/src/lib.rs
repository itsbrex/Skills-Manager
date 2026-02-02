mod commands;
mod models;
mod services;

use commands::{
    check_sync_status, detect_tools, disable_skill, enable_skill,
    fix_sync_issues, get_config, get_tool_status, import_skills_to_hub,
    is_initialized, list_skills, save_config, scan_existing_skills,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            is_initialized,
            list_skills,
            enable_skill,
            disable_skill,
            detect_tools,
            get_tool_status,
            check_sync_status,
            fix_sync_issues,
            scan_existing_skills,
            import_skills_to_hub,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
