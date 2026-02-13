mod commands;
mod models;
mod services;
#[cfg(test)]
mod test_support;

use commands::{
    check_marketplace_updates_if_stale, check_sync_status, check_update, create_custom_tool,
    create_skill, delete_custom_tool, delete_skill, detect_available_editors, detect_tools,
    disable_skill, enable_skill, fetch_marketplace_skill_descriptions, fetch_marketplace_skills,
    fetch_skill_file_content, fetch_skill_files, fix_sync_issues, get_available_editors,
    get_config, get_marketplace_sources, get_tool_status, import_skills_to_hub,
    install_marketplace_skill, is_initialized, list_skills, mark_initialized, open_in_editor,
    read_directory_tree, read_file, refresh_editors, refresh_skills, refresh_tools, save_config,
    scan_existing_skills, set_tool_enabled, sync_marketplace_installed_skills,
    submit_feedback, toggle_marketplace_source, update_custom_tool, update_tool_paths, write_file,
};
use services::{AppCache, MarketplaceCache};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppCache::default())
        .manage(MarketplaceCache::default())
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
            create_skill,
            detect_tools,
            refresh_tools,
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
            refresh_editors,
            get_available_editors,
            open_in_editor,
            read_directory_tree,
            read_file,
            write_file,
            fetch_marketplace_skills,
            fetch_marketplace_skill_descriptions,
            fetch_skill_files,
            fetch_skill_file_content,
            install_marketplace_skill,
            sync_marketplace_installed_skills,
            check_marketplace_updates_if_stale,
            get_marketplace_sources,
            toggle_marketplace_source,
            check_update,
            submit_feedback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
