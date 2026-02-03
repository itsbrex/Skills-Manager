use crate::models::DetectedEditor;
use crate::services::{detect_editors as do_detect, open_in_external_editor};
use std::sync::Mutex;
use tauri::State;

pub struct EditorState {
    pub editors: Mutex<Vec<DetectedEditor>>,
}

impl Default for EditorState {
    fn default() -> Self {
        Self {
            editors: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn detect_available_editors(state: State<EditorState>) -> Vec<DetectedEditor> {
    let editors = do_detect();
    let mut cached = state.editors.lock().unwrap();
    *cached = editors.clone();
    editors
}

#[tauri::command]
pub fn get_available_editors(state: State<EditorState>) -> Vec<DetectedEditor> {
    let cached = state.editors.lock().unwrap();
    if cached.is_empty() {
        drop(cached);
        let editors = do_detect();
        let mut cached = state.editors.lock().unwrap();
        *cached = editors.clone();
        editors
    } else {
        cached.clone()
    }
}

#[tauri::command]
pub fn open_in_editor(editor_id: String, path: String) -> Result<(), String> {
    open_in_external_editor(&editor_id, &path)
}
