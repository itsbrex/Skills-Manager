use crate::models::auth::AuthSession;
use crate::models::cloud_sync::{CloudSyncPayload, CloudSyncState, CloudSyncToolState};
use crate::services::cloud_sync::{
    build_payload, sync_pull, sync_push, sync_resolve, CloudSyncPushResult, CloudSyncSnapshot,
};
use crate::services::{ConfigManager, ScannerService};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
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
    let mut skills = payload.skills.clone();
    skills.sort_by(|a, b| {
        let a_identity = a.instance_id.as_deref().unwrap_or(a.id.as_str());
        let b_identity = b.instance_id.as_deref().unwrap_or(b.id.as_str());
        a_identity.cmp(b_identity).then_with(|| a.id.cmp(&b.id))
    });
    for skill in &mut skills {
        if let Some(meta) = skill.marketplace.as_mut() {
            if let Some(value) = meta.marketplace_source_id.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.marketplace_skill_id.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.marketplace_skill_slug.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.repo_url.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.skill_path.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.remote_revision.as_mut() {
                *value = value.trim().to_string();
            }
        }
        if let Some(meta) = skill.vault.as_mut() {
            if let Some(value) = meta.provider.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.user_id.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.skill_id.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.version.as_mut() {
                *value = value.trim().to_string();
            }
            if let Some(value) = meta.hash.as_mut() {
                *value = value.trim().to_string();
            }
        }
    }

    let mut custom_tools = payload.custom_tools.clone();
    custom_tools.sort_by(|a, b| a.id.cmp(&b.id));

    let mut tool_states: BTreeMap<String, CloudSyncToolState> =
        payload.tool_states.clone().into_iter().collect();
    for state in tool_states.values_mut() {
        state.enabled_skills.sort();
    }

    #[derive(serde::Serialize)]
    struct HashPayload {
        version: u8,
        updated_at: i64,
        device_id: String,
        skills: Vec<crate::models::cloud_sync::CloudSyncSkill>,
        tool_states: BTreeMap<String, CloudSyncToolState>,
        custom_tools: Vec<crate::models::cloud_sync::CloudSyncCustomTool>,
        preferences: Option<crate::models::config::UserPreferences>,
    }

    let normalized = HashPayload {
        version: payload.version,
        updated_at: 0,
        device_id: payload.device_id.clone(),
        skills,
        tool_states,
        custom_tools,
        preferences: payload.preferences.clone(),
    };

    let json = serde_json::to_string(&normalized).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

fn has_local_changes_since_last_sync(
    last_payload_hash: Option<&str>,
    current_payload_hash: &str,
    last_revision: i64,
    last_synced_at: Option<i64>,
) -> bool {
    match last_payload_hash {
        Some(last_hash) => last_hash != current_payload_hash,
        None => last_revision > 0 || last_synced_at.is_some(),
    }
}

fn ensure_cloud_sync_state(config: &mut crate::models::AppConfig) -> &mut CloudSyncState {
    if config.cloud_sync.is_none() {
        config.cloud_sync = Some(CloudSyncState::new());
    }
    config.cloud_sync.as_mut().expect("cloud sync state")
}

fn resolve_access_token(session: &AuthSession) -> Result<String, String> {
    if let Some(access) = session.access_token.clone() {
        return Ok(access);
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

    let access_token = resolve_access_token(&session)?;
    let base_url = sync_api_base_url();
    let snapshot = sync_pull(&base_url, &access_token).await?;

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

    let access_token = resolve_access_token(&session)?;
    let skills = ScannerService::scan_scoped_skills(&config)?;
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
        &access_token,
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

    let access_token = resolve_access_token(&session)?;
    let base_url = sync_api_base_url();
    let revision = sync_resolve(&base_url, &access_token, &payload).await?;
    let state = ensure_cloud_sync_state(&mut config);
    state.last_revision = revision;
    state.last_payload_hash = Some(payload_hash(&payload)?);
    state.last_synced_at = Some(now_timestamp());
    manager.save(&config)?;
    Ok(revision)
}

#[tauri::command]
pub fn cloud_sync_has_local_changes() -> Result<bool, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let skills = ScannerService::scan_scoped_skills(&config)?;
    let payload = build_payload(&config, &skills);
    let current_hash = payload_hash(&payload)?;
    let state = config.cloud_sync.as_ref();

    Ok(has_local_changes_since_last_sync(
        state.and_then(|value| value.last_payload_hash.as_deref()),
        &current_hash,
        state.map(|value| value.last_revision).unwrap_or(0),
        state.and_then(|value| value.last_synced_at),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::auth::{AuthProfile, AuthSession};
    use crate::models::cloud_sync::{
        CloudSyncCustomTool, CloudSyncSkill, CloudSyncState, CloudSyncToolState,
    };
    use crate::models::{ProjectBinding, ToolConfig};
    use crate::models::config::UserPreferences;
    use crate::services::ConfigManager;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn cloud_sync_push_returns_conflict_payload() {
        crate::test_support::with_temp_home(|_| {
            let mut server = mockito::Server::new();
            std::env::set_var("SKILLS_MARKET_API_BASE", format!("{}/api/v1", server.url()));

            let _mock = server
                .mock("POST", "/api/v1/sync/push")
                .with_status(409)
                .with_header("content-type", "application/json")
                .with_body(
                    r#"{"error":{"code":"SYNC_CONFLICT","message":"conflict"},"revision":2,"payload":{"version":1,"updated_at":1,"device_id":"d1","skills":[],"tool_states":{},"custom_tools":[]}}"#,
                )
                .create();

            let manager = ConfigManager::new();
            let mut config = manager.load().unwrap();
            let local_device_id = config
                .cloud_sync
                .as_ref()
                .expect("cloud sync state")
                .device_id
                .clone();
            config.auth_session = Some(AuthSession {
                provider: "github".to_string(),
                access_token: Some("at".to_string()),
                refresh_token: Some("rt".to_string()),
                profile: AuthProfile {
                    username: "octo".to_string(),
                    avatar_url: None,
                },
            });
            manager.save(&config).unwrap();

            tauri::async_runtime::block_on(async {
                let result = cloud_sync_push().await.expect("push");
                match result {
                    CloudSyncPushResult::Conflict {
                        revision,
                        payload,
                        local_payload,
                    } => {
                        assert_eq!(revision, 2);
                        assert_eq!(payload.device_id, "d1");
                        assert_eq!(local_payload.device_id, local_device_id);
                    }
                    _ => panic!("expected conflict"),
                }
            });
        });
    }

    #[test]
    fn cloud_sync_push_includes_scoped_enabled_skills() {
        crate::test_support::with_temp_home(|home| {
            let global_skills_dir = home.join(".skills-manager").join("skills");
            fs::create_dir_all(&global_skills_dir).expect("create global skills dir");

            let project_root = home.join("code").join("project-alpha");
            let project_skills_dir = project_root.join(".claude").join("skills");
            let project_skill_dir = project_skills_dir.join("shared-skill");
            fs::create_dir_all(&project_skill_dir).expect("create project skill dir");
            fs::write(
                project_skill_dir.join("SKILL.md"),
                "---\nname: shared-skill\n---\n",
            )
            .expect("write project skill");

            let tool_skills_dir = home.join(".codex").join("skills");
            fs::create_dir_all(&tool_skills_dir).expect("create tool skills dir");
            std::os::unix::fs::symlink(&project_skill_dir, tool_skills_dir.join("shared-skill"))
                .expect("link project skill");

            let mut server = mockito::Server::new();
            std::env::set_var("SKILLS_MARKET_API_BASE", format!("{}/api/v1", server.url()));
            let _mock = server
                .mock("POST", "/api/v1/sync/push")
                .match_body(mockito::Matcher::Regex(
                    "(?s).*project:project-alpha:shared-skill.*".to_string(),
                ))
                .with_status(200)
                .with_header("content-type", "application/json")
                .with_body(r#"{"revision":2}"#)
                .create();

            let manager = ConfigManager::new();
            let mut config = manager.load().expect("load config");
            if let Some(preferences) = config.preferences.as_mut() {
                preferences.vault_backup_consent = crate::models::VaultBackupConsent::Granted;
            }
            config.auth_session = Some(AuthSession {
                provider: "github".to_string(),
                access_token: Some("at".to_string()),
                refresh_token: Some("rt".to_string()),
                profile: AuthProfile {
                    username: "octo".to_string(),
                    avatar_url: None,
                },
            });
            config.skills_dir = global_skills_dir;
            config.tools = HashMap::from([(
                "codex".to_string(),
                ToolConfig {
                    enabled: true,
                    detected: true,
                    skills_path: tool_skills_dir,
                    config_path: PathBuf::from("/tmp/codex/config"),
                },
            )]);
            config.projects = vec![ProjectBinding {
                id: "project-alpha".to_string(),
                name: "Project Alpha".to_string(),
                skills_dir: project_skills_dir,
            }];
            config.active_project_id = Some("project-alpha".to_string());
            manager.save(&config).expect("save config");

            tauri::async_runtime::block_on(async {
                let result = cloud_sync_push().await.expect("push");
                match result {
                    CloudSyncPushResult::Synced { revision } => assert_eq!(revision, 2),
                    other => panic!("expected synced result, got: {other:?}"),
                }
            });
        });
    }

    #[test]
    fn payload_hash_ignores_updated_at() {
        let payload = CloudSyncPayload {
            version: 1,
            updated_at: 100,
            device_id: "d1".to_string(),
            skills: Vec::new(),
            tool_states: HashMap::new(),
            custom_tools: Vec::new(),
            preferences: None,
        };
        let mut later_payload = payload.clone();
        later_payload.updated_at = 200;

        let hash1 = payload_hash(&payload).expect("hash payload");
        let hash2 = payload_hash(&later_payload).expect("hash payload later");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn payload_hash_is_order_invariant() {
        let payload = CloudSyncPayload {
            version: 1,
            updated_at: 100,
            device_id: "d1".to_string(),
            skills: vec![
                CloudSyncSkill {
                    id: "s1".to_string(),
                    instance_id: None,
                    scope: None,
                    project_id: None,
                    project_name: None,
                    name: "S1".to_string(),
                    source: "local".to_string(),
                    version: "1.0".to_string(),
                    marketplace: None,
                    vault: None,
                },
                CloudSyncSkill {
                    id: "s2".to_string(),
                    instance_id: None,
                    scope: None,
                    project_id: None,
                    project_name: None,
                    name: "S2".to_string(),
                    source: "local".to_string(),
                    version: "1.0".to_string(),
                    marketplace: None,
                    vault: None,
                },
            ],
            tool_states: HashMap::from([
                (
                    "t1".to_string(),
                    CloudSyncToolState {
                        enabled: true,
                        enabled_skills: vec!["s1".to_string(), "s2".to_string()],
                    },
                ),
                (
                    "t2".to_string(),
                    CloudSyncToolState {
                        enabled: false,
                        enabled_skills: vec!["s2".to_string()],
                    },
                ),
            ]),
            custom_tools: vec![
                CloudSyncCustomTool {
                    id: "c1".to_string(),
                    name: "C1".to_string(),
                    config_path: "/tmp/c1".to_string(),
                    skills_path: "/tmp/c1/skills".to_string(),
                    enabled: true,
                },
                CloudSyncCustomTool {
                    id: "c2".to_string(),
                    name: "C2".to_string(),
                    config_path: "/tmp/c2".to_string(),
                    skills_path: "/tmp/c2/skills".to_string(),
                    enabled: false,
                },
            ],
            preferences: None,
        };

        let payload_reordered = CloudSyncPayload {
            version: 1,
            updated_at: 200,
            device_id: "d1".to_string(),
            skills: vec![
                CloudSyncSkill {
                    id: "s2".to_string(),
                    instance_id: None,
                    scope: None,
                    project_id: None,
                    project_name: None,
                    name: "S2".to_string(),
                    source: "local".to_string(),
                    version: "1.0".to_string(),
                    marketplace: None,
                    vault: None,
                },
                CloudSyncSkill {
                    id: "s1".to_string(),
                    instance_id: None,
                    scope: None,
                    project_id: None,
                    project_name: None,
                    name: "S1".to_string(),
                    source: "local".to_string(),
                    version: "1.0".to_string(),
                    marketplace: None,
                    vault: None,
                },
            ],
            tool_states: HashMap::from([
                (
                    "t2".to_string(),
                    CloudSyncToolState {
                        enabled: false,
                        enabled_skills: vec!["s2".to_string()],
                    },
                ),
                (
                    "t1".to_string(),
                    CloudSyncToolState {
                        enabled: true,
                        enabled_skills: vec!["s2".to_string(), "s1".to_string()],
                    },
                ),
            ]),
            custom_tools: vec![
                CloudSyncCustomTool {
                    id: "c2".to_string(),
                    name: "C2".to_string(),
                    config_path: "/tmp/c2".to_string(),
                    skills_path: "/tmp/c2/skills".to_string(),
                    enabled: false,
                },
                CloudSyncCustomTool {
                    id: "c1".to_string(),
                    name: "C1".to_string(),
                    config_path: "/tmp/c1".to_string(),
                    skills_path: "/tmp/c1/skills".to_string(),
                    enabled: true,
                },
            ],
            preferences: None,
        };

        let hash1 = payload_hash(&payload).expect("hash payload");
        let hash2 = payload_hash(&payload_reordered).expect("hash payload reordered");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn has_local_changes_since_last_sync_detects_hash_mismatch() {
        assert!(has_local_changes_since_last_sync(
            Some("old"),
            "new",
            1,
            Some(1)
        ));
        assert!(!has_local_changes_since_last_sync(
            Some("same"),
            "same",
            1,
            Some(1)
        ));
    }

    #[test]
    fn has_local_changes_since_last_sync_ignores_missing_baseline_before_first_sync() {
        assert!(!has_local_changes_since_last_sync(None, "hash", 0, None));
        assert!(has_local_changes_since_last_sync(None, "hash", 2, Some(1)));
    }

    #[test]
    fn cloud_sync_has_local_changes_detects_active_project_skill_enablement() {
        crate::test_support::with_temp_home(|home| {
            let global_skills_dir = home.join(".skills-manager").join("skills");
            fs::create_dir_all(&global_skills_dir).expect("create global skills dir");

            let project_root = home.join("code").join("project-alpha");
            let project_skills_dir = project_root.join(".claude").join("skills");
            let project_skill_dir = project_skills_dir.join("shared-skill");
            fs::create_dir_all(&project_skill_dir).expect("create project skill dir");
            fs::write(
                project_skill_dir.join("SKILL.md"),
                "---\nname: shared-skill\n---\n",
            )
            .expect("write project skill");

            let tool_skills_dir = home.join(".codex").join("skills");
            fs::create_dir_all(&tool_skills_dir).expect("create tool skills dir");
            std::os::unix::fs::symlink(&project_skill_dir, tool_skills_dir.join("shared-skill"))
                .expect("link project skill");

            let manager = ConfigManager::new();
            let mut config = manager.load().expect("load config");
            let device_id = config
                .cloud_sync
                .as_ref()
                .expect("cloud sync state")
                .device_id
                .clone();
            if let Some(preferences) = config.preferences.as_mut() {
                preferences.vault_backup_consent = crate::models::VaultBackupConsent::Granted;
            }

            config.skills_dir = global_skills_dir;
            config.tools = HashMap::from([(
                "codex".to_string(),
                ToolConfig {
                    enabled: true,
                    detected: true,
                    skills_path: tool_skills_dir,
                    config_path: PathBuf::from("/tmp/codex/config"),
                },
            )]);
            config.projects = vec![ProjectBinding {
                id: "project-alpha".to_string(),
                name: "Project Alpha".to_string(),
                skills_dir: project_skills_dir,
            }];
            config.active_project_id = Some("project-alpha".to_string());

            let baseline_payload = build_payload(&config, &[]);
            config.cloud_sync = Some(CloudSyncState {
                device_id,
                last_revision: 1,
                last_synced_at: Some(1),
                last_payload_hash: Some(payload_hash(&baseline_payload).expect("baseline hash")),
            });
            manager.save(&config).expect("save config");

            assert!(cloud_sync_has_local_changes().expect("detect local changes"));
        });
    }

    #[test]
    fn payload_hash_changes_when_marketplace_meta_changes() {
        let payload = CloudSyncPayload {
            version: 1,
            updated_at: 100,
            device_id: "d1".to_string(),
            skills: vec![CloudSyncSkill {
                id: "s1".to_string(),
                instance_id: None,
                scope: None,
                project_id: None,
                project_name: None,
                name: "S1".to_string(),
                source: "marketplace".to_string(),
                version: "1.0".to_string(),
                marketplace: Some(crate::models::cloud_sync::CloudSyncMarketplaceMeta {
                    marketplace_source_id: Some("source-1".to_string()),
                    marketplace_skill_id: Some("mkt-1".to_string()),
                    marketplace_skill_slug: Some("slug-1".to_string()),
                    repo_url: Some("https://github.com/acme/repo".to_string()),
                    skill_path: Some(".claude/skills/s1".to_string()),
                    remote_revision: Some("rev-1".to_string()),
                }),
                vault: None,
            }],
            tool_states: HashMap::new(),
            custom_tools: Vec::new(),
            preferences: None,
        };

        let hash1 = payload_hash(&payload).expect("hash payload");
        let mut updated = payload.clone();
        if let Some(meta) = updated.skills[0].marketplace.as_mut() {
            meta.marketplace_skill_id = Some("mkt-2".to_string());
        }
        let hash2 = payload_hash(&updated).expect("hash payload updated");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn payload_hash_changes_when_preferences_change() {
        crate::test_support::with_temp_home(|_| {
            let payload = CloudSyncPayload {
                version: 1,
                updated_at: 1,
                device_id: "d1".to_string(),
                skills: vec![],
                tool_states: Default::default(),
                custom_tools: vec![],
                preferences: Some(UserPreferences::default()),
            };

            let mut updated = payload.clone();
            let mut prefs = UserPreferences::default();
            prefs.language = "zh".to_string();
            updated.preferences = Some(prefs);

            let hash1 = payload_hash(&payload).expect("hash payload");
            let hash2 = payload_hash(&updated).expect("hash updated");
            assert_ne!(hash1, hash2);
        });
    }
}
