use reqwest::header::{ACCEPT, AUTHORIZATION};
use reqwest::Client;

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
}
