use crate::models::auth::AuthSession;
use crate::services::ConfigManager;
use crate::services::vault::vault_download as fetch_vault_download;
use std::fs;
use std::path::Path;
use zip::ZipArchive;

fn resolve_access_token(session: &AuthSession) -> Result<String, String> {
    if let Some(access) = session.access_token.clone() {
        return Ok(access);
    }

    Err("auth tokens missing".to_string())
}

fn vault_api_base_url() -> String {
    const DEFAULT_VAULT_API_BASE: &str = "https://skills-market-api.guardssl.info/api/v1";
    std::env::var("SKILLS_MARKET_API_BASE")
        .unwrap_or_else(|_| DEFAULT_VAULT_API_BASE.to_string())
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
        fs::remove_dir_all(&install_dir)
            .map_err(|e| format!("无法覆盖已有 Skill: {}", e))?;
    }
    fs::create_dir_all(&install_dir).map_err(|e| format!("无法创建 Skills 目录: {}", e))?;
    extract_zip(&bytes, &install_dir)?;

    Ok(install_dir.to_string_lossy().to_string())
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
        std::io::copy(&mut file, &mut output)
            .map_err(|e| format!("写入文件失败: {}", e))?;
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
            std::env::set_var(
                "SKILLS_MARKET_API_BASE",
                format!("{}/api/v1", server.url()),
            );

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
                vault_download("skill-1".to_string()).await.expect("download")
            });
            let installed_path = std::path::Path::new(&install_dir).join("SKILL.md");
            let content = std::fs::read_to_string(installed_path).expect("read file");
            assert_eq!(content, "hello");
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
