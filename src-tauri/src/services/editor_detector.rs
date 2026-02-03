use crate::models::{DetectedEditor, EDITOR_DEFINITIONS};
use std::process::Command;

pub fn detect_editors() -> Vec<DetectedEditor> {
    EDITOR_DEFINITIONS
        .iter()
        .filter_map(|def| {
            let available = if def.always_available {
                true
            } else if def.detect_cmd.is_empty() {
                false
            } else {
                check_command_exists(def.detect_cmd)
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
