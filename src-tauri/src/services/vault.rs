use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum VaultUploadResult {
    Uploaded { skill_id: String },
    Skipped { reason: String },
}

#[derive(Debug, serde::Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
enum VaultUploadResponse {
    Uploaded { skill_id: String },
    Skipped { reason: Option<String> },
}

pub async fn vault_download(
    base_url: &str,
    access_token: &str,
    skill_id: &str,
) -> Result<Vec<u8>, String> {
    let client = Client::new();
    let url = format!("{}/vault/download", base_url.trim_end_matches('/'));
    let response = client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {access_token}"))
        .header(ACCEPT, "application/zip")
        .query(&[("skill_id", skill_id)])
        .send()
        .await
        .map_err(|e| format!("Vault download request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Vault download failed: HTTP {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read vault download response: {e}"))?;
    Ok(bytes.to_vec())
}

pub async fn vault_upload(
    base_url: &str,
    access_token: &str,
    skill_id: &str,
    hash: &str,
    size: u64,
    zip_bytes: &[u8],
) -> Result<VaultUploadResult, String> {
    let client = Client::new();
    let url = format!("{}/vault/upload", base_url.trim_end_matches('/'));
    let response = client
        .post(url)
        .header(AUTHORIZATION, format!("Bearer {access_token}"))
        .header(CONTENT_TYPE, "application/zip")
        .header(ACCEPT, "application/json")
        .query(&[
            ("skill_id", skill_id),
            ("hash", hash),
            ("size", &size.to_string()),
        ])
        .body(zip_bytes.to_vec())
        .send()
        .await
        .map_err(|e| format!("Vault upload request failed: {e}"))?;

    if response.status().as_u16() == 409 {
        return Ok(VaultUploadResult::Skipped {
            reason: "hash_same".to_string(),
        });
    }

    if !response.status().is_success() {
        return Err(format!("Vault upload failed: HTTP {}", response.status()));
    }

    let payload = response
        .json::<VaultUploadResponse>()
        .await
        .map_err(|e| format!("Failed to parse vault upload response: {e}"))?;

    Ok(match payload {
        VaultUploadResponse::Uploaded { skill_id } => VaultUploadResult::Uploaded { skill_id },
        VaultUploadResponse::Skipped { reason } => VaultUploadResult::Skipped {
            reason: reason.unwrap_or_else(|| "hash_same".to_string()),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_download_fetches_zip() {
        let mut server = mockito::Server::new();
        let _mock = server
            .mock("GET", "/api/v1/vault/download")
            .match_header("authorization", "Bearer token")
            .match_query(mockito::Matcher::UrlEncoded(
                "skill_id".to_string(),
                "skill-1".to_string(),
            ))
            .with_status(200)
            .with_body("zip-bytes")
            .create();

        let bytes = tauri::async_runtime::block_on(async {
            vault_download(&format!("{}/api/v1", server.url()), "token", "skill-1")
                .await
                .expect("download")
        });
        assert_eq!(bytes, b"zip-bytes");
    }

    #[test]
    fn vault_upload_skips_when_hash_same() {
        let mut server = mockito::Server::new();
        let _mock = server
            .mock("POST", "/api/v1/vault/upload")
            .match_header("authorization", "Bearer token")
            .match_header("content-type", "application/zip")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("skill_id".to_string(), "skill-1".to_string()),
                mockito::Matcher::UrlEncoded("hash".to_string(), "hash-1".to_string()),
                mockito::Matcher::UrlEncoded("size".to_string(), "3".to_string()),
            ]))
            .with_status(200)
            .with_body(r#"{"status":"skipped","reason":"hash_same"}"#)
            .create();

        let result = tauri::async_runtime::block_on(async {
            vault_upload(
                &format!("{}/api/v1", server.url()),
                "token",
                "skill-1",
                "hash-1",
                3,
                b"zip",
            )
            .await
            .expect("upload")
        });

        assert_eq!(
            result,
            VaultUploadResult::Skipped {
                reason: "hash_same".to_string()
            }
        );
    }
}
