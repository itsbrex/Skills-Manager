use crate::models::{DetectedEditor, EDITOR_DEFINITIONS};
use std::path::Path;
use std::process::Command;

pub fn detect_editors() -> Vec<DetectedEditor> {
    EDITOR_DEFINITIONS
        .iter()
        .filter_map(|def| {
            let available = if def.always_available {
                true
            } else {
                // Check command line tool first
                let cmd_exists = !def.detect_cmd.is_empty() && check_command_exists(def.detect_cmd);
                // If not found, check macOS app
                let app_exists = !def.app_name.is_empty() && check_app_exists(def.app_name);
                cmd_exists || app_exists
            };

            if available {
                Some(DetectedEditor {
                    id: def.id.to_string(),
                    name: def.name.to_string(),
                    command: def.open_cmd.to_string(),
                    available: true,
                    icon: def.icon.to_string(),
                })
            } else {
                None
            }
        })
        .collect()
}

fn check_command_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn check_app_exists(app_name: &str) -> bool {
    // Check /Applications folder
    let app_path = format!("/Applications/{}.app", app_name);
    if Path::new(&app_path).exists() {
        return true;
    }

    // Check ~/Applications folder
    if let Some(home) = dirs::home_dir() {
        let user_app_path = home.join("Applications").join(format!("{}.app", app_name));
        if user_app_path.exists() {
            return true;
        }
    }

    false
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
    for part in parts.iter().skip(1) {
        cmd.arg(part);
    }
    cmd.arg(path);

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
