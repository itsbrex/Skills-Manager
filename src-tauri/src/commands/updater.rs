use crate::models::update::UpdateInfo;
use crate::services::updater;

#[tauri::command]
pub async fn check_update(app_handle: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let package_info = app_handle.package_info();
    let current_version = &package_info.version;
    let v_str = format!(
        "{}.{}.{}",
        current_version.major, current_version.minor, current_version.patch
    );

    updater::check_for_updates(&v_str)
        .await
        .map_err(|e| e.to_string())
}
