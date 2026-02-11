use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

pub fn read_directory_tree(root_path: &str) -> Result<FileNode, String> {
    let path = Path::new(root_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", root_path));
    }

    build_tree(path, path)
}

fn build_tree(path: &Path, root: &Path) -> Result<FileNode, String> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let relative_path = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    let relative_path = if relative_path.is_empty() {
        ".".to_string()
    } else {
        relative_path
    };

    if path.is_dir() {
        let mut children: Vec<FileNode> = fs::read_dir(path)
            .map_err(|e| e.to_string())?
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                // Skip symlinks to avoid recursion loops and issues with external paths
                let is_symlink = entry.file_type().map(|ft| ft.is_symlink()).unwrap_or(false);

                !is_symlink
                    && !name_str.starts_with('.')
                    && name_str != "node_modules"
                    && name_str != "target"
                    && name_str != "dist"
                    && name_str != "build"
            })
            .filter_map(|entry| build_tree(&entry.path(), root).ok())
            .collect();

        // Sort: directories first, then files, alphabetically
        children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Ok(FileNode {
            name,
            path: relative_path,
            is_dir: true,
            children: Some(children),
        })
    } else {
        // Ensure it is a regular file (not a pipe, socket, block device, etc.)
        // This is critical on Linux where reading a named pipe can block indefinitely
        if !path.is_file() {
            return Err("Not a regular file".to_string());
        }

        Ok(FileNode {
            name,
            path: relative_path,
            is_dir: false,
            children: None,
        })
    }
}

pub fn read_file_content(path: &str) -> Result<String, String> {
    println!("[Rust] Reading file content: {}", path);
    match fs::read_to_string(path) {
        Ok(content) => {
            println!("[Rust] Read success, {} bytes", content.len());
            Ok(content)
        }
        Err(e) => {
            println!("[Rust] Read failed: {}", e);
            Err(format!("Failed to read file: {}", e))
        }
    }
}

pub fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}
