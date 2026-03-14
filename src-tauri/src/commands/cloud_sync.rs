use crate::models::auth::AuthSession;
use crate::models::cloud_sync::{CloudSyncPayload, CloudSyncState};
use crate::services::cloud_sync::{
    build_payload, sync_pull, sync_push, sync_resolve, CloudSyncPushResult, CloudSyncSnapshot,
};
use crate::services::secure_store::{token_store, AuthTokens};
use crate::services::{ConfigManager, ScannerService};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const DEFAULT_AUTH_API_BASE: &str = "https://skills-market-api.guardssl.info/api/v1";

fn sync_api_base_url() -> String {
    std::env::var("SKILLS_MARKET_API_BASE").unwrap_or_else(|_| DEFAULT_AUTH_API_BASE.to_string())
}

fn now_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs() as i64)
        .unwrap_or(0)
}

fn payload_hash(payload: &CloudSyncPayload) -> Result<String, String> {
    let json = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

fn ensure_cloud_sync_state(config: &mut crate::models::AppConfig) -> &mut CloudSyncState {
    if config.cloud_sync.is_none() {
        config.cloud_sync = Some(CloudSyncState::new());
    }
    config.cloud_sync.as_mut().expect("cloud sync state")
}

fn resolve_tokens(
    provider: &str,
    session: &AuthSession,
    config: &mut crate::models::AppConfig,
    manager: &ConfigManager,
) -> Result<AuthTokens, String> {
    if let Some(tokens) = token_store().load_tokens(provider)? {
        return Ok(tokens);
    }

    if let (Some(access), Some(refresh)) =
        (session.access_token.clone(), session.refresh_token.clone())
    {
        token_store().save_tokens(
            provider,
            AuthTokens {
                access_token: access.clone(),
                refresh_token: refresh.clone(),
            },
        )?;
        if let Some(session_mut) = config.auth_session.as_mut() {
            session_mut.access_token = None;
            session_mut.refresh_token = None;
        }
        manager.save(config)?;
        return Ok(AuthTokens {
            access_token: access,
            refresh_token: refresh,
        });
    }

    Err("auth tokens missing".to_string())
}

#[tauri::command]
pub async fn cloud_sync_pull() -> Result<CloudSyncSnapshot, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    let session = config
        .auth_session
        .clone()
        .ok_or_else(|| "not authenticated".to_string())?;

    let tokens = resolve_tokens(&session.provider, &session, &mut config, &manager)?;
    let base_url = sync_api_base_url();
    let snapshot = sync_pull(&base_url, &tokens.access_token).await?;

    let state = ensure_cloud_sync_state(&mut config);
    state.last_revision = snapshot.revision;
    state.last_synced_at = Some(now_timestamp());
    if let Some(payload) = snapshot.payload.as_ref() {
        state.last_payload_hash = Some(payload_hash(payload)?);
    }
    manager.save(&config)?;

    Ok(snapshot)
}

#[tauri::command]
pub async fn cloud_sync_push() -> Result<CloudSyncPushResult, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    let session = config
        .auth_session
        .clone()
        .ok_or_else(|| "not authenticated".to_string())?;

    let tokens = resolve_tokens(&session.provider, &session, &mut config, &manager)?;
    let skills = ScannerService::scan_skills(&config.skills_dir)?;
    let payload = build_payload(&config, &skills);
    let hash = payload_hash(&payload)?;

    let state = ensure_cloud_sync_state(&mut config);
    if state.last_payload_hash.as_deref() == Some(hash.as_str()) {
        return Ok(CloudSyncPushResult::Skipped {
            reason: "no_changes".to_string(),
        });
    }

    let base_revision = state.last_revision;
    let request_id = Uuid::new_v4().simple().to_string();
    let base_url = sync_api_base_url();
    let result = sync_push(
        &base_url,
        &tokens.access_token,
        base_revision,
        &payload,
        &request_id,
    )
    .await?;

    if let CloudSyncPushResult::Synced { revision } = result {
        state.last_revision = revision;
        state.last_payload_hash = Some(hash);
        state.last_synced_at = Some(now_timestamp());
        manager.save(&config)?;
        return Ok(CloudSyncPushResult::Synced { revision });
    }

    Ok(result)
}

#[tauri::command]
pub async fn cloud_sync_resolve(payload: CloudSyncPayload) -> Result<i64, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    let session = config
        .auth_session
        .clone()
        .ok_or_else(|| "not authenticated".to_string())?;

    let tokens = resolve_tokens(&session.provider, &session, &mut config, &manager)?;
    let base_url = sync_api_base_url();
    let revision = sync_resolve(&base_url, &tokens.access_token, &payload).await?;
    let state = ensure_cloud_sync_state(&mut config);
    state.last_revision = revision;
    state.last_payload_hash = Some(payload_hash(&payload)?);
    state.last_synced_at = Some(now_timestamp());
    manager.save(&config)?;
    Ok(revision)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::auth::{AuthProfile, AuthSession};
    use crate::services::ConfigManager;
    use crate::services::secure_store::{AuthTokens, MemoryTokenStore, TokenStore};

    #[test]
    fn cloud_sync_push_returns_conflict_payload() {
        crate::test_support::with_temp_home(|_| {
            let mut server = mockito::Server::new();
            std::env::set_var(
                "SKILLS_MARKET_API_BASE",
                format!("{}/api/v1", server.url()),
            );

            let _mock = server
                .mock("POST", "/api/v1/sync/push")
                .with_status(409)
                .with_header("content-type", "application/json")
                .with_body(
                    r#"{"error":{"code":"SYNC_CONFLICT","message":"conflict"},"revision":2,"payload":{"version":1,"updated_at":1,"device_id":"d1","skills":[],"tool_states":{},"custom_tools":[]}}"#,
                )
                .create();

            let store = MemoryTokenStore::default();
            crate::services::secure_store::set_token_store_for_tests(store.clone());
            store
                .save_tokens(
                    "github",
                    AuthTokens {
                        access_token: "at".to_string(),
                        refresh_token: "rt".to_string(),
                    },
                )
                .unwrap();

            let manager = ConfigManager::new();
            let mut config = manager.load().unwrap();
            config.auth_session = Some(AuthSession {
                provider: "github".to_string(),
                access_token: None,
                refresh_token: None,
                profile: AuthProfile {
                    username: "octo".to_string(),
                    avatar_url: None,
                },
            });
            manager.save(&config).unwrap();

            tauri::async_runtime::block_on(async {
                let result = cloud_sync_push().await.expect("push");
                match result {
                    CloudSyncPushResult::Conflict { revision, payload } => {
                        assert_eq!(revision, 2);
                        assert_eq!(payload.device_id, "d1");
                    }
                    _ => panic!("expected conflict"),
                }
            });
        });
    }
}
