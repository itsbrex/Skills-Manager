use crate::models::auth::AuthSession;
use crate::models::SkillSource;
use crate::services::vault::{
    vault_download as fetch_vault_download, vault_upload as fetch_vault_upload, VaultUploadResult,
};
use crate::services::{ConfigManager, ScannerService};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(Debug, Clone, serde::Serialize)]
pub struct VaultBackupSummary {
    pub uploaded: usize,
    pub skipped: usize,
    pub failed: Vec<String>,
}

fn resolve_access_token(session: &AuthSession) -> Result<String, String> {
    if let Some(access) = session.access_token.clone() {
        return Ok(access);
    }

    Err("auth tokens missing".to_string())
}

fn vault_api_base_url() -> String {
    const DEFAULT_VAULT_API_BASE: &str = "https://skills-market-api.guardssl.info/api/v1";
    std::env::var("SKILLS_MARKET_API_BASE").unwrap_or_else(|_| DEFAULT_VAULT_API_BASE.to_string())
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn zip_skill_dir(skill_dir: &Path) -> Result<Vec<u8>, String> {
    let cursor = std::io::Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    let options = stable_zip_options();
    add_dir_to_zip(skill_dir, skill_dir, &mut zip, options)?;
    let cursor = zip.finish().map_err(|e| format!("写入 Zip 失败: {}", e))?;
    Ok(cursor.into_inner())
}

fn stable_zip_options() -> FileOptions {
    // 使用固定时间戳，避免每次备份因为当前时间不同导致 hash 变化
    FileOptions::default().last_modified_time(zip::DateTime::default())
}

fn add_dir_to_zip(
    base_dir: &Path,
    current_dir: &Path,
    zip: &mut ZipWriter<std::io::Cursor<Vec<u8>>>,
    options: FileOptions,
) -> Result<(), String> {
    let mut entries: Vec<(std::path::PathBuf, fs::FileType, String)> = Vec::new();
    for entry in fs::read_dir(current_dir).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录条目失败: {}", e))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("读取目录条目失败: {}", e))?;
        if file_type.is_symlink() {
            continue;
        }
        let rel_path = path
            .strip_prefix(base_dir)
            .map_err(|e| format!("计算相对路径失败: {}", e))?;
        let rel_name = rel_path.to_string_lossy().replace('\\', "/");
        entries.push((path, file_type, rel_name));
    }
    entries.sort_by(|a, b| a.2.cmp(&b.2));

    for (path, file_type, rel_name) in entries {
        if file_type.is_dir() {
            let dir_name = if rel_name.ends_with('/') {
                rel_name
            } else {
                format!("{}/", rel_name)
            };
            zip.add_directory(dir_name, options)
                .map_err(|e| format!("写入 Zip 目录失败: {}", e))?;
            add_dir_to_zip(base_dir, &path, zip, options)?;
            continue;
        }
        if file_type.is_file() {
            zip.start_file(rel_name, options)
                .map_err(|e| format!("写入 Zip 文件失败: {}", e))?;
            let mut file = fs::File::open(&path).map_err(|e| format!("读取文件失败: {}", e))?;
            std::io::copy(&mut file, zip).map_err(|e| format!("写入文件失败: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn vault_download(skill_id: String) -> Result<String, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let session = config
        .auth_session
        .clone()
        .ok_or_else(|| "not authenticated".to_string())?;
    let access_token = resolve_access_token(&session)?;
    let base_url = vault_api_base_url();
    let bytes = fetch_vault_download(&base_url, &access_token, &skill_id).await?;

    let install_dir = config.skills_dir.join(&skill_id);
    if install_dir.exists() {
        fs::remove_dir_all(&install_dir).map_err(|e| format!("无法覆盖已有 Skill: {}", e))?;
    }
    fs::create_dir_all(&install_dir).map_err(|e| format!("无法创建 Skills 目录: {}", e))?;
    extract_zip(&bytes, &install_dir)?;

    Ok(install_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn vault_backup() -> Result<VaultBackupSummary, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let session = config
        .auth_session
        .clone()
        .ok_or_else(|| "not authenticated".to_string())?;
    let access_token = resolve_access_token(&session)?;
    let base_url = vault_api_base_url();

    let skills = ScannerService::scan_skills(&config.skills_dir)?;
    let mut summary = VaultBackupSummary {
        uploaded: 0,
        skipped: 0,
        failed: Vec::new(),
    };

    for skill in skills
        .into_iter()
        .filter(|skill| skill.source != SkillSource::Marketplace)
    {
        let zip_bytes = match zip_skill_dir(&skill.path) {
            Ok(bytes) => bytes,
            Err(err) => {
                summary.failed.push(format!("{}: {}", skill.id, err));
                continue;
            }
        };
        let hash = hash_bytes(&zip_bytes);
        let size = zip_bytes.len() as u64;
        match fetch_vault_upload(&base_url, &access_token, &skill.id, &hash, size, &zip_bytes).await
        {
            Ok(VaultUploadResult::Uploaded { .. }) => summary.uploaded += 1,
            Ok(VaultUploadResult::Skipped { .. }) => summary.skipped += 1,
            Err(err) => summary.failed.push(format!("{}: {}", skill.id, err)),
        }
    }

    Ok(summary)
}

fn extract_zip(bytes: &[u8], target_dir: &Path) -> Result<(), String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| format!("读取 Zip 失败: {}", e))?;

    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|e| format!("读取 Zip 条目失败: {}", e))?;
        let Some(entry_path) = file.enclosed_name() else {
            continue;
        };
        let out_path = target_dir.join(entry_path);
        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| format!("无法创建目录: {}", e))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建目录: {}", e))?;
        }
        let mut output = fs::File::create(&out_path).map_err(|e| format!("写入文件失败: {}", e))?;
        std::io::copy(&mut file, &mut output).map_err(|e| format!("写入文件失败: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::auth::AuthProfile;
    use crate::services::ConfigManager;
    use crate::test_support::with_temp_home;
    use std::io::Write;
    use zip::write::FileOptions;

    #[test]
    fn vault_download_command_extracts_zip() {
        with_temp_home(|_| {
            let mut server = mockito::Server::new();
            std::env::set_var("SKILLS_MARKET_API_BASE", format!("{}/api/v1", server.url()));

            let zip_bytes = build_zip_bytes();
            let _mock = server
                .mock("GET", "/api/v1/vault/download")
                .match_header("authorization", "Bearer token")
                .match_query(mockito::Matcher::UrlEncoded(
                    "skill_id".to_string(),
                    "skill-1".to_string(),
                ))
                .with_status(200)
                .with_body(zip_bytes)
                .create();

            let manager = ConfigManager::new();
            let mut config = manager.load().expect("load config");
            config.auth_session = Some(AuthSession {
                provider: "github".to_string(),
                access_token: Some("token".to_string()),
                refresh_token: None,
                profile: AuthProfile {
                    username: "octo".to_string(),
                    avatar_url: None,
                },
            });
            manager.save(&config).expect("save config");

            let install_dir = tauri::async_runtime::block_on(async {
                vault_download("skill-1".to_string())
                    .await
                    .expect("download")
            });
            let installed_path = std::path::Path::new(&install_dir).join("SKILL.md");
            let content = std::fs::read_to_string(installed_path).expect("read file");
            assert_eq!(content, "hello");
        });
    }

    #[test]
    fn vault_backup_skips_when_hash_same() {
        with_temp_home(|_| {
            let mut server = mockito::Server::new();
            std::env::set_var("SKILLS_MARKET_API_BASE", format!("{}/api/v1", server.url()));

            let _mock = server
                .mock("POST", "/api/v1/vault/upload")
                .match_header("authorization", "Bearer token")
                .match_query(mockito::Matcher::Any)
                .with_status(200)
                .with_body(r#"{"status":"skipped","reason":"hash_same"}"#)
                .create();

            let manager = ConfigManager::new();
            let mut config = manager.load().expect("load config");
            config.auth_session = Some(AuthSession {
                provider: "github".to_string(),
                access_token: Some("token".to_string()),
                refresh_token: None,
                profile: AuthProfile {
                    username: "octo".to_string(),
                    avatar_url: None,
                },
            });
            manager.save(&config).expect("save config");

            let skill_dir = config.skills_dir.join("local-skill");
            std::fs::create_dir_all(&skill_dir).expect("create skill dir");
            std::fs::write(
                skill_dir.join("SKILL.md"),
                "---\nname: local-skill\ndescription: test\n---\n",
            )
            .expect("write SKILL.md");

            let summary =
                tauri::async_runtime::block_on(async { vault_backup().await.expect("backup") });

            assert_eq!(summary.skipped, 1);
            assert_eq!(summary.failed.len(), 0);
        });
    }

    #[test]
    fn zip_skill_dir_is_deterministic_across_runs() {
        with_temp_home(|_| {
            let manager = ConfigManager::new();
            let config = manager.load().expect("load config");

            let skill_dir = config.skills_dir.join("local-skill");
            std::fs::create_dir_all(skill_dir.join("sub")).expect("create skill dir");
            std::fs::write(
                skill_dir.join("SKILL.md"),
                "---\nname: local-skill\ndescription: test\n---\n",
            )
            .expect("write SKILL.md");
            std::fs::write(skill_dir.join("sub/extra.txt"), "hello").expect("write extra");

            let first = zip_skill_dir(&skill_dir).expect("zip 1");
            std::thread::sleep(std::time::Duration::from_secs(2));
            let second = zip_skill_dir(&skill_dir).expect("zip 2");

            assert_eq!(hash_bytes(&first), hash_bytes(&second));
            assert_eq!(first, second);
        });
    }

    fn build_zip_bytes() -> Vec<u8> {
        let cursor = std::io::Cursor::new(Vec::new());
        let mut zip = zip::ZipWriter::new(cursor);
        let options = FileOptions::default();
        zip.start_file("SKILL.md", options).expect("start file");
        zip.write_all(b"hello").expect("write file");
        let cursor = zip.finish().expect("finish zip");
        cursor.into_inner()
    }
}
