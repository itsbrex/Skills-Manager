use crate::models::{DetectedEditor, EDITOR_DEFINITIONS};
use std::fs;
use std::path::Path;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

pub fn detect_editors() -> Vec<DetectedEditor> {
    EDITOR_DEFINITIONS
        .iter()
        .filter_map(|def| {
            let (available, app_path) = if def.always_available {
                (true, None)
            } else {
                // Check command line tool first
                let cmd_exists = !def.detect_cmd.is_empty() && check_command_exists(def.detect_cmd);
                // Check macOS app and get path
                let app_path = if !def.app_name.is_empty() {
                    find_app_path(def.app_name)
                } else {
                    None
                };
                (cmd_exists || app_path.is_some(), app_path)
            };

            if available {
                // Try to extract icon from app bundle
                let icon_data = app_path
                    .as_ref()
                    .and_then(|p| extract_app_icon(p))
                    .or_else(|| {
                        // For always_available system apps, try to get from /System/Applications
                        if def.always_available && !def.id.is_empty() && def.id != "builtin" {
                            let system_app = match def.id {
                                "terminal" => Some("/System/Applications/Utilities/Terminal.app"),
                                "finder" => Some("/System/Library/CoreServices/Finder.app"),
                                _ => None,
                            };
                            system_app.and_then(|p| extract_app_icon(p))
                        } else {
                            None
                        }
                    });

                Some(DetectedEditor {
                    id: def.id.to_string(),
                    name: def.name.to_string(),
                    command: def.open_cmd.to_string(),
                    available: true,
                    icon: def.icon.to_string(),
                    icon_data,
                })
            } else {
                None
            }
        })
        .collect()
}

fn check_command_exists(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        Command::new("where")
            .arg(cmd)
            .creation_flags(0x08000000)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("which")
            .arg(cmd)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
}

fn find_app_path(app_name: &str) -> Option<String> {
    // Check /Applications folder
    let app_path = format!("/Applications/{}.app", app_name);
    if Path::new(&app_path).exists() {
        return Some(app_path);
    }

    // Check ~/Applications folder
    if let Some(home) = dirs::home_dir() {
        let user_app_path = home.join("Applications").join(format!("{}.app", app_name));
        if user_app_path.exists() {
            return Some(user_app_path.to_string_lossy().to_string());
        }
    }

    // Check for JetBrains apps with version suffix (e.g., "IntelliJ IDEA CE.app")
    if let Ok(entries) = fs::read_dir("/Applications") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(app_name) && name.ends_with(".app") {
                return Some(entry.path().to_string_lossy().to_string());
            }
        }
    }

    None
}

fn extract_app_icon(app_path: &str) -> Option<String> {
    // Read Info.plist to get icon file name
    let plist_path = format!("{}/Contents/Info.plist", app_path);

    // Use defaults command to read CFBundleIconFile
    #[cfg(target_os = "windows")]
    let output = Command::new("defaults")
        .args(["read", &plist_path, "CFBundleIconFile"])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("defaults")
        .args(["read", &plist_path, "CFBundleIconFile"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let icon_name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let icon_name = if icon_name.ends_with(".icns") {
        icon_name
    } else {
        format!("{}.icns", icon_name)
    };

    let icns_path = format!("{}/Contents/Resources/{}", app_path, icon_name);

    if !Path::new(&icns_path).exists() {
        return None;
    }

    // Create temp file for PNG output
    let temp_png = format!("/tmp/editor_icon_{}.png", std::process::id());

    // Use sips to convert icns to PNG (32x32 for efficiency)
    #[cfg(target_os = "windows")]
    let sips_result = Command::new("sips")
        .args([
            "-s", "format", "png",
            "-z", "64", "64",  // 64x64 for retina displays
            &icns_path,
            "--out", &temp_png,
        ])
        .creation_flags(0x08000000)
        .output();

    #[cfg(not(target_os = "windows"))]
    let sips_result = Command::new("sips")
        .args([
            "-s", "format", "png",
            "-z", "64", "64",  // 64x64 for retina displays
            &icns_path,
            "--out", &temp_png,
        ])
        .output();

    if sips_result.is_err() || !sips_result.as_ref().unwrap().status.success() {
        return None;
    }

    // Read PNG and convert to base64
    let png_data = fs::read(&temp_png).ok()?;
    let _ = fs::remove_file(&temp_png);

    let base64_data = BASE64.encode(&png_data);
    Some(format!("data:image/png;base64,{}", base64_data))
}

pub fn open_in_external_editor(editor_id: &str, path: &str) -> Result<(), String> {
    let editor = EDITOR_DEFINITIONS
        .iter()
        .find(|e| e.id == editor_id)
        .ok_or_else(|| format!("Editor not found: {}", editor_id))?;

    if editor.open_cmd.is_empty() {
        return Err("Cannot open with built-in editor externally".to_string());
    }

    let parts: Vec<&str> = editor.open_cmd.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Invalid open command".to_string());
    }

    let mut cmd = Command::new(parts[0]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    for part in parts.iter().skip(1) {
        cmd.arg(part);
    }
    cmd.arg(path);

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
