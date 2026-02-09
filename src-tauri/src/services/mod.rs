pub mod cache;
pub mod config_manager;
pub mod detector;
pub mod editor_detector;
pub mod file_ops;
pub mod linker;
pub mod scanner;
pub mod updater;

pub use cache::AppCache;
pub use config_manager::ConfigManager;
pub use detector::DetectorService;
pub use editor_detector::{detect_editors, open_in_external_editor};
pub use file_ops::{read_directory_tree, read_file_content, write_file_content, FileNode};
pub use linker::{LinkReport, LinkStatus, LinkerService};
pub use scanner::ScannerService;
