use crate::services::{read_directory_tree as do_read_tree, read_file_content, write_file_content, FileNode};

#[tauri::command]
pub fn read_directory_tree(path: String) -> Result<FileNode, String> {
    println!("[Rust] read_directory_tree called for: {}", path);
    do_read_tree(&path)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    println!("[Rust] read_file called for: {}", path);
    read_file_content(&path)
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    write_file_content(&path, &content)
}
