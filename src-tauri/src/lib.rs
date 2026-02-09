mod commands;
mod models;
mod services;
#[cfg(test)]
mod test_support;

use commands::{
    check_sync_status, check_update, create_custom_tool, delete_custom_tool, delete_skill,
    detect_available_editors, detect_tools, disable_skill, enable_skill, fix_sync_issues,
    get_available_editors, get_config, get_tool_status, import_skills_to_hub, is_initialized,
    list_skills, mark_initialized, open_in_editor, read_directory_tree, read_file, refresh_skills,
    save_config, scan_existing_skills, set_tool_enabled, update_custom_tool, update_tool_paths,
    write_file, EditorState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(EditorState::default())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            is_initialized,
            mark_initialized,
            list_skills,
            refresh_skills,
            enable_skill,
            disable_skill,
            delete_skill,
            detect_tools,
            get_tool_status,
            set_tool_enabled,
            update_tool_paths,
            create_custom_tool,
            update_custom_tool,
            delete_custom_tool,
            check_sync_status,
            fix_sync_issues,
            scan_existing_skills,
            import_skills_to_hub,
            detect_available_editors,
            get_available_editors,
            open_in_editor,
            read_directory_tree,
            read_file,
            write_file,
            check_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
