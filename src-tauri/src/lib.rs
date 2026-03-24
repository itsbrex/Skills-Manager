mod commands;
mod models;
mod services;
#[cfg(test)]
mod test_support;

use commands::{
    check_marketplace_updates_if_stale, check_sync_status, check_update, cloud_sync_pull,
    cloud_sync_push, cloud_sync_resolve, create_custom_tool, create_skill, delete_custom_tool,
    delete_skill, detect_available_editors, detect_tools, disable_skill, enable_skill,
    exchange_github_auth, exchange_google_auth, fetch_marketplace_skill_descriptions,
    fetch_marketplace_skills, fetch_poll_results, fetch_polls, fetch_skill_file_content,
    fetch_skill_files, fix_sync_issues, get_auth_profile, get_available_editors, get_config,
    get_marketplace_sources, get_poll_client_state, get_tool_status, import_skills_to_hub,
    install_marketplace_skill, install_marketplace_skill_by_ref, is_initialized, list_skills,
    logout_auth, mark_initialized, open_in_editor, read_directory_tree, read_file, refresh_editors,
    refresh_skills, refresh_tools, save_config, save_poll_client_state, scan_existing_skills,
    set_tool_enabled, start_github_auth, start_google_auth, submit_feedback, submit_poll_vote,
    sync_marketplace_installed_skills, telemetry_end_session, telemetry_flush_pending,
    telemetry_initialize, telemetry_record_heartbeat, telemetry_track_event,
    toggle_marketplace_source, update_custom_tool, update_tool_paths, vault_backup, vault_download,
    write_file,
};
use services::{AppCache, MarketplaceCache};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, mut argv, _cwd| {
            if matches!(argv.first(), Some(arg) if arg.contains("://")) {
                argv.insert(0, String::new());
            }
            let _ = app.emit("auth:deep-link-argv", argv.clone());
            app.deep_link().handle_cli_arguments(argv.into_iter());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                match app.deep_link().register_all() {
                    Ok(_) => {}
                    Err(_err) => {}
                }
                for scheme in ["skills-manager", "skillsmanager"] {
                    match app.deep_link().is_registered(scheme) {
                        Ok(_is_registered) => {}
                        Err(_err) => {}
                    }
                }
            }
            Ok(())
        })
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
            install_marketplace_skill_by_ref,
            sync_marketplace_installed_skills,
            check_marketplace_updates_if_stale,
            get_marketplace_sources,
            toggle_marketplace_source,
            check_update,
            cloud_sync_pull,
            cloud_sync_push,
            cloud_sync_resolve,
            submit_feedback,
            fetch_polls,
            fetch_poll_results,
            submit_poll_vote,
            get_poll_client_state,
            save_poll_client_state,
            start_github_auth,
            exchange_github_auth,
            start_google_auth,
            exchange_google_auth,
            get_auth_profile,
            logout_auth,
            telemetry_initialize,
            telemetry_record_heartbeat,
            telemetry_end_session,
            telemetry_flush_pending,
            telemetry_track_event,
            vault_backup,
            vault_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
