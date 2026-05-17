use crate::models::cloud_sync::{
    CloudSyncCustomTool, CloudSyncMarketplaceMeta, CloudSyncPayload, CloudSyncSkill,
    CloudSyncToolState, CloudSyncVaultMeta,
};
use crate::models::{AppConfig, Skill, SkillSource, VaultBackupConsent};
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CloudSyncSnapshot {
    pub revision: i64,
    pub payload: Option<CloudSyncPayload>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum CloudSyncPushResult {
    Synced {
        revision: i64,
    },
    Skipped {
        reason: String,
    },
    Conflict {
        revision: i64,
        payload: CloudSyncPayload,
        local_payload: CloudSyncPayload,
    },
}

pub fn build_payload(config: &AppConfig, skills: &[Skill]) -> CloudSyncPayload {
    let include_non_market = matches!(
        config
            .preferences
            .as_ref()
            .map(|prefs| &prefs.vault_backup_consent),
        Some(VaultBackupConsent::Granted)
    );
    let filtered_skills: Vec<&Skill> = if include_non_market {
        skills.iter().collect()
    } else {
        skills
            .iter()
            .filter(|skill| matches!(skill.source, SkillSource::Marketplace))
            .collect()
    };

    let device_id = config
        .cloud_sync
        .as_ref()
        .map(|state| state.device_id.clone())
        .unwrap_or_default();

    let mut tool_states: HashMap<String, CloudSyncToolState> = HashMap::new();
    for (tool_id, tool_config) in config.collect_tool_configs() {
        let enabled_skills: Vec<String> = filtered_skills
            .iter()
            .filter(|skill| skill.is_enabled_for(&tool_id))
            .map(|skill| skill.instance_id.clone())
            .collect();
        tool_states.insert(
            tool_id,
            CloudSyncToolState {
                enabled: tool_config.enabled,
                enabled_skills,
            },
        );
    }

    let custom_tools = config
        .custom_tools
        .iter()
        .map(|(id, tool)| CloudSyncCustomTool {
            id: id.clone(),
            name: tool.name.clone(),
            config_path: tool.config_path.to_string_lossy().into_owned(),
            skills_path: tool.skills_path.to_string_lossy().into_owned(),
            enabled: tool.enabled,
        })
        .collect();

    let skills_payload = filtered_skills
        .iter()
        .map(|skill| CloudSyncSkill {
            id: skill.id.clone(),
            instance_id: Some(skill.instance_id.clone()),
            scope: Some(skill.scope.clone()),
            project_id: skill.project_id.clone(),
            project_name: skill.project_name.clone(),
            name: skill.name.clone(),
            source: match skill.source {
                SkillSource::Local => "local".to_string(),
                SkillSource::Imported => "imported".to_string(),
                SkillSource::Marketplace => "marketplace".to_string(),
                SkillSource::Vault => "vault".to_string(),
            },
            version: skill.version.clone(),
            marketplace: skill
                .marketplace_meta
                .as_ref()
                .map(|meta| CloudSyncMarketplaceMeta {
                    marketplace_source_id: meta.marketplace_source_id.clone(),
                    marketplace_skill_id: meta.marketplace_skill_id.clone(),
                    marketplace_skill_slug: meta.marketplace_skill_slug.clone(),
                    repo_url: meta.repo_url.clone(),
                    skill_path: meta.skill_path.clone(),
                    remote_revision: meta.remote_revision.clone(),
                }),
            vault: skill.vault_meta.as_ref().map(|meta| CloudSyncVaultMeta {
                provider: meta.provider.clone(),
                user_id: meta.user_id.clone(),
                skill_id: meta.skill_id.clone(),
                version: meta.version.clone(),
                hash: meta.hash.clone(),
                size: meta.size,
                updated_at: meta.updated_at,
            }),
        })
        .collect();

    let updated_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs() as i64)
        .unwrap_or(0);

    CloudSyncPayload {
        version: 1,
        updated_at,
        device_id,
        skills: skills_payload,
        tool_states,
        custom_tools,
        preferences: Some(config.preferences.clone().unwrap_or_default()),
    }
}

pub async fn sync_pull(_base_url: &str, _access_token: &str) -> Result<CloudSyncSnapshot, String> {
    let client = Client::new();
    let url = format!("{}/sync/pull", _base_url.trim_end_matches('/'));
    let response = client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {_access_token}"))
        .header(ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| format!("Sync pull request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Sync pull failed: HTTP {}", response.status()));
    }

    response
        .json::<CloudSyncSnapshot>()
        .await
        .map_err(|e| format!("Failed to parse sync pull response: {e}"))
}

pub async fn sync_push(
    base_url: &str,
    access_token: &str,
    base_revision: i64,
    payload: &CloudSyncPayload,
    request_id: &str,
) -> Result<CloudSyncPushResult, String> {
    let client = Client::new();
    let url = format!("{}/sync/push", base_url.trim_end_matches('/'));
    let response = client
        .post(url)
        .header(AUTHORIZATION, format!("Bearer {access_token}"))
        .header(CONTENT_TYPE, "application/json")
        .header(ACCEPT, "application/json")
        .json(&serde_json::json!({
            "base_revision": base_revision,
            "payload": payload,
            "request_id": request_id,
        }))
        .send()
        .await
        .map_err(|e| format!("Sync push request failed: {e}"))?;

    if response.status().as_u16() == 409 {
        #[derive(serde::Deserialize)]
        struct ConflictResponse {
            revision: i64,
            payload: CloudSyncPayload,
        }
        let conflict = response
            .json::<ConflictResponse>()
            .await
            .map_err(|e| format!("Failed to parse sync conflict response: {e}"))?;
        return Ok(CloudSyncPushResult::Conflict {
            revision: conflict.revision,
            payload: conflict.payload,
            local_payload: payload.clone(),
        });
    }

    if !response.status().is_success() {
        return Err(format!("Sync push failed: HTTP {}", response.status()));
    }

    #[derive(serde::Deserialize)]
    struct PushResponse {
        revision: i64,
    }
    let payload = response
        .json::<PushResponse>()
        .await
        .map_err(|e| format!("Failed to parse sync push response: {e}"))?;
    Ok(CloudSyncPushResult::Synced {
        revision: payload.revision,
    })
}

pub async fn sync_resolve(
    base_url: &str,
    access_token: &str,
    payload: &CloudSyncPayload,
) -> Result<i64, String> {
    let client = Client::new();
    let url = format!("{}/sync/resolve", base_url.trim_end_matches('/'));
    let response = client
        .post(url)
        .header(AUTHORIZATION, format!("Bearer {access_token}"))
        .header(CONTENT_TYPE, "application/json")
        .header(ACCEPT, "application/json")
        .json(&serde_json::json!({
            "payload": payload,
        }))
        .send()
        .await
        .map_err(|e| format!("Sync resolve request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Sync resolve failed: HTTP {}", response.status()));
    }

    #[derive(serde::Deserialize)]
    struct ResolveResponse {
        revision: i64,
    }
    let payload = response
        .json::<ResolveResponse>()
        .await
        .map_err(|e| format!("Failed to parse sync resolve response: {e}"))?;
    Ok(payload.revision)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CustomToolConfig, SkillScope, ToolConfig};
    use std::collections::HashMap;

    #[test]
    fn build_payload_excludes_llm_provider() {
        let mut config = AppConfig::default();
        config.llm_provider = Some(crate::models::LlmProvider {
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: "sk-secret-must-not-leak".to_string(),
            model: "gpt-4o-mini".to_string(),
            temperature: None,
            max_tokens: None,
            timeout_secs: None,
        });

        let payload = super::build_payload(&config, &[]);
        let json = serde_json::to_string(&payload).expect("serialize payload");
        assert!(
            !json.contains("llm_provider"),
            "cloud sync payload must not contain llm_provider"
        );
        assert!(
            !json.contains("sk-secret-must-not-leak"),
            "cloud sync payload must not contain api_key"
        );
    }

    #[test]
    fn sync_pull_accepts_missing_skills() {
        let mut server = mockito::Server::new();
        let _mock = server
            .mock("GET", "/sync/pull")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"revision":1,"payload":{"version":1,"updated_at":1,"device_id":"d1","tool_states":{},"custom_tools":[]}}"#,
            )
            .create();

        tauri::async_runtime::block_on(async {
            let result = sync_pull(&server.url(), "token").await;
            assert!(
                result.is_ok(),
                "expected sync_pull to succeed, got: {result:?}"
            );
            let snapshot = result.unwrap();
            assert_eq!(snapshot.revision, 1);
            let payload = snapshot.payload.expect("payload");
            assert!(payload.skills.is_empty());
        });
    }

    #[test]
    fn sync_push_conflict_accepts_missing_tool_states() {
        let mut server = mockito::Server::new();
        let _mock = server
            .mock("POST", "/sync/push")
            .with_status(409)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"error":{"code":"SYNC_CONFLICT","message":"conflict"},"revision":2,"payload":{"version":1,"updated_at":1,"device_id":"d1","skills":[],"custom_tools":[]}}"#,
            )
            .create();

        tauri::async_runtime::block_on(async {
            let payload = CloudSyncPayload {
                version: 1,
                updated_at: 1,
                device_id: "d1".to_string(),
                skills: Vec::new(),
                tool_states: HashMap::new(),
                custom_tools: Vec::new(),
                preferences: None,
            };
            let result = sync_push(&server.url(), "token", 1, &payload, "req1").await;
            assert!(
                result.is_ok(),
                "expected sync_push to succeed, got: {result:?}"
            );
            let conflict = result.unwrap();
            match conflict {
                CloudSyncPushResult::Conflict { payload, .. } => {
                    assert!(payload.tool_states.is_empty());
                }
                other => panic!("expected conflict, got: {other:?}"),
            }
        });
    }

    #[test]
    fn sync_push_conflict_accepts_missing_custom_tools() {
        let mut server = mockito::Server::new();
        let _mock = server
            .mock("POST", "/sync/push")
            .with_status(409)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"error":{"code":"SYNC_CONFLICT","message":"conflict"},"revision":2,"payload":{"version":1,"updated_at":1,"device_id":"d1","skills":[],"tool_states":{}}}"#,
            )
            .create();

        tauri::async_runtime::block_on(async {
            let payload = CloudSyncPayload {
                version: 1,
                updated_at: 1,
                device_id: "d1".to_string(),
                skills: Vec::new(),
                tool_states: HashMap::new(),
                custom_tools: Vec::new(),
                preferences: None,
            };
            let result = sync_push(&server.url(), "token", 1, &payload, "req1").await;
            assert!(
                result.is_ok(),
                "expected sync_push to succeed, got: {result:?}"
            );
            let conflict = result.unwrap();
            match conflict {
                CloudSyncPushResult::Conflict { payload, .. } => {
                    assert!(payload.custom_tools.is_empty());
                }
                other => panic!("expected conflict, got: {other:?}"),
            }
        });
    }

    #[test]
    fn sync_push_conflict_accepts_missing_enabled_skills() {
        let mut server = mockito::Server::new();
        let _mock = server
            .mock("POST", "/sync/push")
            .with_status(409)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"error":{"code":"SYNC_CONFLICT","message":"conflict"},"revision":2,"payload":{"version":1,"updated_at":1,"device_id":"d1","skills":[],"tool_states":{"codex":{"enabled":true}},"custom_tools":[]}}"#,
            )
            .create();

        tauri::async_runtime::block_on(async {
            let payload = CloudSyncPayload {
                version: 1,
                updated_at: 1,
                device_id: "d1".to_string(),
                skills: Vec::new(),
                tool_states: HashMap::new(),
                custom_tools: Vec::new(),
                preferences: None,
            };
            let result = sync_push(&server.url(), "token", 1, &payload, "req1").await;
            assert!(
                result.is_ok(),
                "expected sync_push to succeed, got: {result:?}"
            );
            let conflict = result.unwrap();
            match conflict {
                CloudSyncPushResult::Conflict { payload, .. } => {
                    let state = payload.tool_states.get("codex").expect("codex");
                    assert!(state.enabled_skills.is_empty());
                }
                other => panic!("expected conflict, got: {other:?}"),
            }
        });
    }

    #[test]
    fn build_payload_includes_enabled_skills_and_custom_tools() {
        let mut config = AppConfig::default();
        if let Some(prefs) = config.preferences.as_mut() {
            prefs.vault_backup_consent = VaultBackupConsent::Granted;
        }
        config.tools.insert(
            "codex".to_string(),
            ToolConfig {
                enabled: true,
                detected: true,
                skills_path: std::path::PathBuf::from("/tmp/codex/skills"),
                config_path: std::path::PathBuf::from("/tmp/codex/config"),
            },
        );
        config.custom_tools.insert(
            "custom1".to_string(),
            CustomToolConfig {
                name: "My Tool".to_string(),
                config_path: std::path::PathBuf::from("/tmp/custom/config"),
                skills_path: std::path::PathBuf::from("/tmp/custom/skills"),
                enabled: true,
                icon_path: None,
            },
        );

        let mut skill = Skill::new("s1".to_string(), "Skill 1".to_string(), "/tmp/s1".into());
        skill.enabled.insert("codex".to_string(), true);
        let payload = super::build_payload(&config, &[skill]);

        assert_eq!(
            payload.device_id,
            config.cloud_sync.as_ref().unwrap().device_id
        );
        assert_eq!(
            payload.tool_states["codex"].enabled_skills,
            vec!["global:s1".to_string()]
        );
        assert_eq!(payload.custom_tools.len(), 1);
        assert!(payload.preferences.is_some());
    }

    #[test]
    fn build_payload_uses_instance_ids_for_scoped_enabled_skills() {
        let mut config = AppConfig::default();
        if let Some(prefs) = config.preferences.as_mut() {
            prefs.vault_backup_consent = VaultBackupConsent::Granted;
        }
        config.tools.insert(
            "codex".to_string(),
            ToolConfig {
                enabled: true,
                detected: true,
                skills_path: std::path::PathBuf::from("/tmp/codex/skills"),
                config_path: std::path::PathBuf::from("/tmp/codex/config"),
            },
        );

        let mut global = Skill::new("shared".to_string(), "Shared".to_string(), "/tmp/global".into());
        global.enabled.insert("codex".to_string(), true);

        let mut project = Skill::new("shared".to_string(), "Shared".to_string(), "/tmp/project".into())
            .with_scope(
                SkillScope::Project,
                Some("project-alpha".to_string()),
                Some("Project Alpha".to_string()),
            );
        project.enabled.insert("codex".to_string(), true);

        let payload = super::build_payload(&config, &[global, project]);

        assert_eq!(
            payload.tool_states["codex"].enabled_skills,
            vec![
                "global:shared".to_string(),
                "project:project-alpha:shared".to_string(),
            ]
        );
    }

    #[test]
    fn build_payload_excludes_non_market_skills_without_consent() {
        let mut config = AppConfig::default();
        if let Some(prefs) = config.preferences.as_mut() {
            prefs.vault_backup_consent = VaultBackupConsent::Denied;
        }
        config.tools.insert(
            "codex".to_string(),
            ToolConfig {
                enabled: true,
                detected: true,
                skills_path: std::path::PathBuf::from("/tmp/codex/skills"),
                config_path: std::path::PathBuf::from("/tmp/codex/config"),
            },
        );

        let mut market = Skill::new("m1".to_string(), "Market 1".to_string(), "/tmp/m1".into());
        market.source = SkillSource::Marketplace;
        market.enabled.insert("codex".to_string(), true);

        let mut local = Skill::new("l1".to_string(), "Local 1".to_string(), "/tmp/l1".into());
        local.source = SkillSource::Local;
        local.enabled.insert("codex".to_string(), true);

        let payload = super::build_payload(&config, &[market, local]);
        assert_eq!(payload.skills.len(), 1);
        assert_eq!(payload.skills[0].id, "m1");
        assert_eq!(
            payload.tool_states["codex"].enabled_skills,
            vec!["global:m1".to_string()]
        );
    }
}
