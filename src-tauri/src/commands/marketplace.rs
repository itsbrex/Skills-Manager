use tauri::State;

use crate::models::{
    AppConfig, InstallResult, MarketplaceSkill, MarketplaceSkillsResponse, MarketplaceSource,
    SkillFileNode,
};
use crate::services::{AppCache, ConfigManager, MarketplaceCache, MarketplaceService};

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
                    if let Some(ref q) = normalized_query {
                        let lower_q = q.to_lowercase();
                        let filtered: Vec<MarketplaceSkill> = filtered_by_source
                            .into_iter()
                            .filter(|skill| {
                                skill.name.to_lowercase().contains(&lower_q)
                                    || skill
                                        .description
                                        .as_ref()
                                        .map(|d| d.to_lowercase().contains(&lower_q))
                                        .unwrap_or(false)
                                    || skill
                                        .author
                                        .as_ref()
                                        .map(|a| a.to_lowercase().contains(&lower_q))
                                        .unwrap_or(false)
                                    || skill.source_name.to_lowercase().contains(&lower_q)
                            })
                            .collect();
                        return Ok(MarketplaceSkillsResponse {
                            skills: filtered,
                            has_more: false,
                        });
                    }
                    return Ok(MarketplaceSkillsResponse {
                        skills: filtered_by_source,
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
