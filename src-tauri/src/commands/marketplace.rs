use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::models::{
    AppConfig, InstallResult, InstallStatus, MarketplaceSkill, MarketplaceSkillsResponse,
    MarketplaceSource, MarketplaceSyncResult, MarketplaceUpdateCheckResult, SkillFileNode,
};
use crate::services::{AppCache, ConfigManager, MarketplaceCache, MarketplaceService};

#[derive(Debug, Clone, Deserialize)]
pub struct MarketplaceSkillDescriptionRequest {
    pub id: String,
    pub repo_url: String,
    pub skill_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedMarketplaceUpdateCheckState {
    last_checked_at_unix_secs: u64,
}

const MARKETPLACE_UPDATE_CHECK_INTERVAL: Duration = Duration::from_secs(12 * 60 * 60);

fn github_token_from_config(config: &AppConfig) -> Option<String> {
    config
        .preferences
        .as_ref()
        .and_then(|prefs| prefs.github_token.clone())
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty())
}

fn normalize_source_filter(source_ids: Option<Vec<String>>) -> Option<Vec<String>> {
    let mut ids: Vec<String> = source_ids
        .unwrap_or_default()
        .into_iter()
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect();
    ids.sort();
    ids.dedup();
    if ids.is_empty() {
        None
    } else {
        Some(ids)
    }
}

fn marketplace_update_check_state_path() -> Option<PathBuf> {
    Some(
        dirs::home_dir()?
            .join(".skills-manager")
            .join("cache")
            .join("marketplace-update-check.json"),
    )
}

fn load_last_update_check_time() -> Option<SystemTime> {
    let path = marketplace_update_check_state_path()?;
    let content = fs::read_to_string(path).ok()?;
    let state: PersistedMarketplaceUpdateCheckState = serde_json::from_str(&content).ok()?;
    Some(UNIX_EPOCH + Duration::from_secs(state.last_checked_at_unix_secs))
}

fn persist_update_check_time(checked_at: SystemTime) {
    let Some(path) = marketplace_update_check_state_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        if fs::create_dir_all(parent).is_err() {
            return;
        }
    }

    let state = PersistedMarketplaceUpdateCheckState {
        last_checked_at_unix_secs: checked_at
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|duration| duration.as_secs())
            .unwrap_or_default(),
    };

    if let Ok(content) = serde_json::to_string(&state) {
        let _ = fs::write(path, content);
    }
}

fn should_run_marketplace_update_check(last_checked: Option<SystemTime>, now: SystemTime) -> bool {
    match last_checked {
        None => true,
        Some(last) => now
            .duration_since(last)
            .map(|elapsed| elapsed >= MARKETPLACE_UPDATE_CHECK_INTERVAL)
            .unwrap_or(true),
    }
}

#[tauri::command]
pub async fn fetch_marketplace_skills(
    force_refresh: bool,
    query: Option<String>,
    page: Option<u32>,
    source_ids: Option<Vec<String>>,
    cache: State<'_, MarketplaceCache>,
) -> Result<MarketplaceSkillsResponse, String> {
    let normalized_query = query
        .as_ref()
        .map(|q| q.trim().to_string())
        .filter(|q| !q.is_empty());
    let normalized_source_filter = normalize_source_filter(source_ids);
    let page = page.unwrap_or(1).max(1);

    if page == 1 && !force_refresh {
        if let Some(cached) =
            cache.get_fresh_with_meta(&normalized_query, &normalized_source_filter)
        {
            return Ok(cached);
        }
    }

    let manager = ConfigManager::new();
    let config = manager.load()?;
    let github_token = github_token_from_config(&config);
    let mut sources = config
        .marketplace_sources
        .clone()
        .unwrap_or_else(|| AppConfig::default().marketplace_sources.unwrap_or_default());
    if let Some(ids) = &normalized_source_filter {
        sources.retain(|source| ids.contains(&source.id));
    }

    let result = match MarketplaceService::fetch_marketplace_skills_page(
        &sources,
        &config.skills_dir,
        normalized_query.clone(),
        github_token.as_deref(),
        page,
    )
    .await
    {
        Ok(result) => result,
        Err(err) => {
            if page == 1 {
                if let Some(cached) = cache.get_any() {
                    let filtered_by_source: Vec<MarketplaceSkill> =
                        if let Some(ids) = &normalized_source_filter {
                            cached
                                .into_iter()
                                .filter(|skill| ids.contains(&skill.source_id))
                                .collect()
                        } else {
                            cached
                        };
                    let filtered = MarketplaceService::filter_marketplace_skills_by_query(
                        filtered_by_source,
                        normalized_query.as_deref(),
                    );
                    return Ok(MarketplaceSkillsResponse {
                        skills: filtered,
                        has_more: false,
                    });
                }
            }
            return Err(err);
        }
    };

    if page == 1 {
        cache.set(
            result.skills.clone(),
            normalized_query.clone(),
            result.has_more,
            normalized_source_filter,
        );
    }

    Ok(result)
}

#[tauri::command]
pub async fn fetch_skill_files(
    repo_url: String,
    skill_path: String,
) -> Result<SkillFileNode, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let github_token = github_token_from_config(&config);
    MarketplaceService::fetch_skill_files(&repo_url, &skill_path, github_token.as_deref()).await
}

#[tauri::command]
pub async fn fetch_skill_file_content(download_url: String) -> Result<String, String> {
    MarketplaceService::fetch_skill_file_content(&download_url).await
}

#[tauri::command]
pub async fn fetch_marketplace_skill_descriptions(
    skills: Vec<MarketplaceSkillDescriptionRequest>,
) -> Result<HashMap<String, Option<String>>, String> {
    if skills.is_empty() {
        return Ok(HashMap::new());
    }

    let manager = ConfigManager::new();
    let config = manager.load()?;
    let github_token = github_token_from_config(&config);

    let mut descriptions = HashMap::with_capacity(skills.len());
    for skill in skills {
        if skill.repo_url.trim().is_empty() || skill.skill_path.trim().is_empty() {
            descriptions.insert(skill.id, None);
            continue;
        }
        let description = MarketplaceService::fetch_skill_description(
            &skill.repo_url,
            &skill.skill_path,
            github_token.as_deref(),
        )
        .await;
        descriptions.insert(skill.id, description);
    }

    Ok(descriptions)
}

#[tauri::command]
pub async fn install_marketplace_skill(
    skill_id: String,
    marketplace_cache: State<'_, MarketplaceCache>,
    app_cache: State<'_, AppCache>,
) -> Result<InstallResult, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let github_token = github_token_from_config(&config);

    let skill = if let Some(skill) = marketplace_cache.get_cached_skill(&skill_id) {
        skill
    } else {
        let sources = config
            .marketplace_sources
            .clone()
            .unwrap_or_else(|| AppConfig::default().marketplace_sources.unwrap_or_default());
        let skills = MarketplaceService::fetch_marketplace_skills(
            &sources,
            &config.skills_dir,
            None,
            github_token.as_deref(),
        )
        .await?;
        marketplace_cache.set(skills.clone(), None, false, None);
        skills
            .into_iter()
            .find(|s| s.id == skill_id)
            .ok_or_else(|| "未找到对应的 Skill，请刷新后重试".to_string())?
    };

    let result =
        MarketplaceService::install_skill(&skill, &config.skills_dir, github_token.as_deref())
            .await?;

    // Invalidate caches so UI can refresh
    app_cache.invalidate_skills();
    marketplace_cache.invalidate();

    Ok(result)
}

#[tauri::command]
pub async fn sync_marketplace_installed_skills(
    source_ids: Option<Vec<String>>,
    marketplace_cache: State<'_, MarketplaceCache>,
    app_cache: State<'_, AppCache>,
) -> Result<MarketplaceSyncResult, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let github_token = github_token_from_config(&config);
    let normalized_source_filter = normalize_source_filter(source_ids);
    let mut sources = config
        .marketplace_sources
        .clone()
        .unwrap_or_else(|| AppConfig::default().marketplace_sources.unwrap_or_default());
    if let Some(ids) = &normalized_source_filter {
        sources.retain(|source| ids.contains(&source.id));
    }

    let listing = MarketplaceService::fetch_marketplace_skills_page(
        &sources,
        &config.skills_dir,
        None,
        github_token.as_deref(),
        1,
    )
    .await?;

    let mut result = MarketplaceSyncResult {
        checked: 0,
        updated: 0,
        failed: Vec::new(),
    };

    for skill in listing
        .skills
        .into_iter()
        .filter(|skill| skill.install_status == InstallStatus::UpdateAvailable)
    {
        result.checked += 1;
        match MarketplaceService::install_skill(&skill, &config.skills_dir, github_token.as_deref())
            .await
        {
            Ok(_) => {
                result.updated += 1;
            }
            Err(err) => {
                result.failed.push(format!("{}: {}", skill.name, err));
            }
        }
    }

    if result.updated > 0 {
        app_cache.invalidate_skills();
        marketplace_cache.invalidate();
    }

    Ok(result)
}

#[tauri::command]
pub async fn check_marketplace_updates_if_stale(
    marketplace_cache: State<'_, MarketplaceCache>,
) -> Result<MarketplaceUpdateCheckResult, String> {
    let now = SystemTime::now();
    let last_checked = load_last_update_check_time();
    if !should_run_marketplace_update_check(last_checked, now) {
        return Ok(MarketplaceUpdateCheckResult {
            performed: false,
            checked: 0,
            update_available: 0,
        });
    }

    let manager = ConfigManager::new();
    let config = manager.load()?;
    let github_token = github_token_from_config(&config);
    let sources = config
        .marketplace_sources
        .clone()
        .unwrap_or_else(|| AppConfig::default().marketplace_sources.unwrap_or_default());

    let listing = MarketplaceService::fetch_marketplace_skills_page(
        &sources,
        &config.skills_dir,
        None,
        github_token.as_deref(),
        1,
    )
    .await?;

    marketplace_cache.set(listing.skills.clone(), None, listing.has_more, None);
    persist_update_check_time(now);

    let checked = listing
        .skills
        .iter()
        .filter(|skill| skill.install_status != InstallStatus::NotInstalled)
        .count();
    let update_available = listing
        .skills
        .iter()
        .filter(|skill| skill.install_status == InstallStatus::UpdateAvailable)
        .count();

    Ok(MarketplaceUpdateCheckResult {
        performed: true,
        checked,
        update_available,
    })
}

#[tauri::command]
pub fn get_marketplace_sources() -> Result<Vec<MarketplaceSource>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    Ok(config
        .marketplace_sources
        .clone()
        .unwrap_or_else(|| AppConfig::default().marketplace_sources.unwrap_or_default()))
}

#[tauri::command]
pub fn toggle_marketplace_source(source_id: String, enabled: bool) -> Result<(), String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;

    let sources = config
        .marketplace_sources
        .get_or_insert_with(|| AppConfig::default().marketplace_sources.unwrap_or_default());

    let mut found = false;
    for source in sources.iter_mut() {
        if source.id == source_id {
            source.enabled = enabled;
            found = true;
            break;
        }
    }

    if !found {
        return Err(format!("未找到市场源: {}", source_id));
    }

    manager.save(&config)
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, SystemTime};

    use crate::test_support::with_temp_home;

    use super::{
        load_last_update_check_time, persist_update_check_time, should_run_marketplace_update_check,
        MARKETPLACE_UPDATE_CHECK_INTERVAL,
    };

    #[test]
    fn should_run_marketplace_update_check_respects_interval() {
        let now = SystemTime::now();
        let just_checked = now
            .checked_sub(Duration::from_secs(60))
            .expect("time should be valid");
        let stale_checked = now
            .checked_sub(MARKETPLACE_UPDATE_CHECK_INTERVAL + Duration::from_secs(1))
            .expect("time should be valid");

        assert!(
            !should_run_marketplace_update_check(Some(just_checked), now),
            "recent check should be skipped"
        );
        assert!(
            should_run_marketplace_update_check(Some(stale_checked), now),
            "stale check should run"
        );
        assert!(
            should_run_marketplace_update_check(None, now),
            "missing check timestamp should run"
        );
    }

    #[test]
    fn update_check_time_round_trip_persists() {
        with_temp_home(|_| {
            let now = SystemTime::now();
            persist_update_check_time(now);
            let loaded = load_last_update_check_time();
            assert!(loaded.is_some(), "expected persisted timestamp");
        });
    }
}
