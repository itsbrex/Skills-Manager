use crate::models::{LlmProvider, Skill};
use crate::services::llm::{self, LlmError};
use crate::services::scanner::ScannerService;
use crate::services::translation::{self, SkillTranslationInput, SkillTranslationOutput};
use crate::services::translation_cache::{CacheKey, TranslationCache};
use crate::services::ConfigManager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn get_llm_provider() -> Result<Option<LlmProvider>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    Ok(config.llm_provider)
}

#[tauri::command]
pub fn save_llm_provider(provider: LlmProvider) -> Result<(), String> {
    if provider.base_url.trim().is_empty() {
        return Err("base_url is required".to_string());
    }
    if provider.api_key.trim().is_empty() {
        return Err("api_key is required".to_string());
    }
    if provider.model.trim().is_empty() {
        return Err("model is required".to_string());
    }
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.llm_provider = Some(provider);
    manager.save(&config)
}

#[tauri::command]
pub fn clear_llm_provider() -> Result<(), String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.llm_provider = None;
    manager.save(&config)
}

#[tauri::command]
pub async fn test_llm_provider(provider: LlmProvider) -> Result<String, LlmError> {
    llm::test_connection(&provider).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceTranslationInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub content_md: Option<String>,
}

fn load_provider_or_error() -> Result<LlmProvider, LlmError> {
    let manager = ConfigManager::new();
    let config = manager.load().map_err(|e| LlmError::NetworkError(e))?;
    config.llm_provider.ok_or(LlmError::NotConfigured)
}

fn find_skill_by_instance(skills: &[Skill], instance_id: &str) -> Option<Skill> {
    skills.iter().find(|s| s.instance_id == instance_id).cloned()
}

fn find_installed_for_marketplace(skills: &[Skill], marketplace_skill_id: &str) -> Option<Skill> {
    skills
        .iter()
        .find(|s| {
            s.marketplace_meta
                .as_ref()
                .and_then(|m| m.marketplace_skill_id.as_deref())
                == Some(marketplace_skill_id)
        })
        .cloned()
}

fn find_skill_md(dir: &Path, max_depth: u32) -> Option<PathBuf> {
    if !dir.is_dir() {
        return None;
    }
    let direct_upper = dir.join("SKILL.md");
    if direct_upper.is_file() {
        return Some(direct_upper);
    }
    let direct_lower = dir.join("skill.md");
    if direct_lower.is_file() {
        return Some(direct_lower);
    }
    if max_depth == 0 {
        return None;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                if let Some(found) = find_skill_md(&p, max_depth - 1) {
                    return Some(found);
                }
            }
        }
    }
    None
}

fn read_skill_md(skill: &Skill) -> Option<String> {
    find_skill_md(&skill.path, 3).and_then(|p| fs::read_to_string(&p).ok())
}

#[tauri::command]
pub async fn translate_skill(
    instance_id: String,
    target_lang: String,
    force: Option<bool>,
) -> Result<SkillTranslationOutput, LlmError> {
    let provider = load_provider_or_error()?;
    let manager = ConfigManager::new();
    let config = manager.load().map_err(LlmError::NetworkError)?;
    let skills = ScannerService::scan_scoped_skills(&config).map_err(LlmError::NetworkError)?;
    let skill = find_skill_by_instance(&skills, &instance_id)
        .ok_or_else(|| LlmError::NetworkError(format!("skill not found: {instance_id}")))?;

    let input = SkillTranslationInput {
        name: skill.name.clone(),
        description: skill.description.clone().unwrap_or_default(),
        content_md: read_skill_md(&skill),
    };

    translation::translate_skill(&provider, &target_lang, input, force.unwrap_or(false)).await
}

#[tauri::command]
pub async fn translate_marketplace_skill(
    input: MarketplaceTranslationInput,
    target_lang: String,
    force: Option<bool>,
) -> Result<SkillTranslationOutput, LlmError> {
    let provider = load_provider_or_error()?;
    let manager = ConfigManager::new();
    let installed_match = manager
        .load()
        .ok()
        .and_then(|config| {
            ScannerService::scan_scoped_skills(&config)
                .ok()
                .and_then(|skills| find_installed_for_marketplace(&skills, &input.id))
        });

    let payload = if let Some(skill) = installed_match {
        SkillTranslationInput {
            name: skill.name.clone(),
            description: skill.description.clone().unwrap_or_default(),
            content_md: read_skill_md(&skill),
        }
    } else {
        SkillTranslationInput {
            name: input.name,
            description: input.description.unwrap_or_default(),
            content_md: input.content_md,
        }
    };
    translation::translate_skill(&provider, &target_lang, payload, force.unwrap_or(false)).await
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchTranslationProgress {
    pub current: usize,
    pub total: usize,
    pub instance_id: String,
    pub skill_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchTranslationFailure {
    pub instance_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchTranslationResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<BatchTranslationFailure>,
}

const BATCH_PROGRESS_EVENT: &str = "llm:batch-progress";

#[tauri::command]
pub async fn translate_skills_batch(
    instance_ids: Vec<String>,
    target_lang: String,
    force: Option<bool>,
    app: AppHandle,
) -> Result<BatchTranslationResult, String> {
    let provider = load_provider_or_error().map_err(|e| e.to_string())?;
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let skills = ScannerService::scan_scoped_skills(&config)?;

    let total = instance_ids.len();
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for (idx, instance_id) in instance_ids.iter().enumerate() {
        let skill = match find_skill_by_instance(&skills, instance_id) {
            Some(s) => s,
            None => {
                failed.push(BatchTranslationFailure {
                    instance_id: instance_id.clone(),
                    reason: "skill not found".to_string(),
                });
                continue;
            }
        };

        let _ = app.emit(
            BATCH_PROGRESS_EVENT,
            BatchTranslationProgress {
                current: idx + 1,
                total,
                instance_id: instance_id.clone(),
                skill_name: skill.name.clone(),
            },
        );

        let input = SkillTranslationInput {
            name: skill.name.clone(),
            description: skill.description.clone().unwrap_or_default(),
            content_md: read_skill_md(&skill),
        };

        match translation::translate_skill(&provider, &target_lang, input, force.unwrap_or(false)).await {
            Ok(_) => succeeded.push(instance_id.clone()),
            Err(err) => failed.push(BatchTranslationFailure {
                instance_id: instance_id.clone(),
                reason: err.to_string(),
            }),
        }
    }

    Ok(BatchTranslationResult { succeeded, failed })
}

#[tauri::command]
pub fn clear_translation_cache() -> Result<(), String> {
    translation::clear_cache().map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize)]
pub struct CachedTranslationEntry {
    pub key: String,
    pub translation: Option<SkillTranslationOutput>,
}

fn lookup_skill_cache(
    provider: &LlmProvider,
    target_lang: &str,
    skill: &Skill,
    cache: &TranslationCache,
) -> Option<SkillTranslationOutput> {
    let content_md = read_skill_md(skill);
    let description = skill.description.clone().unwrap_or_default();
    let key = CacheKey {
        base_url: &provider.base_url,
        model: &provider.model,
        target_lang,
        source_name: &skill.name,
        source_description: &description,
        source_content_md: content_md.as_deref(),
    };
    cache.get(&key).map(|hit| SkillTranslationOutput {
        name: hit.name,
        description: hit.description,
        content_md: hit.content_md,
        cached: true,
    })
}

#[tauri::command]
pub fn get_cached_skill_translations(
    instance_ids: Vec<String>,
    target_lang: String,
) -> Result<Vec<CachedTranslationEntry>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let provider = match config.llm_provider.clone() {
        Some(p) => p,
        None => {
            return Ok(instance_ids
                .into_iter()
                .map(|id| CachedTranslationEntry {
                    key: id,
                    translation: None,
                })
                .collect());
        }
    };
    let skills = ScannerService::scan_scoped_skills(&config)?;
    let cache = TranslationCache::new();
    let entries = instance_ids
        .into_iter()
        .map(|id| {
            let translation = skills
                .iter()
                .find(|s| s.instance_id == id)
                .and_then(|skill| lookup_skill_cache(&provider, &target_lang, skill, &cache));
            CachedTranslationEntry {
                key: id,
                translation,
            }
        })
        .collect();
    Ok(entries)
}

#[tauri::command]
pub fn get_cached_marketplace_translations(
    inputs: Vec<MarketplaceTranslationInput>,
    target_lang: String,
) -> Result<Vec<CachedTranslationEntry>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let provider = match config.llm_provider.clone() {
        Some(p) => p,
        None => {
            return Ok(inputs
                .into_iter()
                .map(|input| CachedTranslationEntry {
                    key: input.id,
                    translation: None,
                })
                .collect());
        }
    };
    let installed_skills = ScannerService::scan_scoped_skills(&config).unwrap_or_default();
    let cache = TranslationCache::new();
    let entries = inputs
        .into_iter()
        .map(|input| {
            let translation = if let Some(skill) = find_installed_for_marketplace(&installed_skills, &input.id) {
                lookup_skill_cache(&provider, &target_lang, &skill, &cache)
            } else {
                let description = input.description.clone().unwrap_or_default();
                let key = CacheKey {
                    base_url: &provider.base_url,
                    model: &provider.model,
                    target_lang: &target_lang,
                    source_name: &input.name,
                    source_description: &description,
                    source_content_md: input.content_md.as_deref(),
                };
                cache.get(&key).map(|hit| SkillTranslationOutput {
                    name: hit.name,
                    description: hit.description,
                    content_md: hit.content_md,
                    cached: true,
                })
            };
            CachedTranslationEntry {
                key: input.id,
                translation,
            }
        })
        .collect();
    Ok(entries)
}

#[tauri::command]
pub async fn translate_text_content(
    label: String,
    content: String,
    target_lang: String,
    force: Option<bool>,
) -> Result<SkillTranslationOutput, LlmError> {
    let provider = load_provider_or_error()?;
    let payload = SkillTranslationInput {
        name: label,
        description: String::new(),
        content_md: Some(content),
    };
    translation::translate_skill(&provider, &target_lang, payload, force.unwrap_or(false)).await
}

#[tauri::command]
pub fn get_cached_text_translation(
    label: String,
    content: String,
    target_lang: String,
) -> Result<Option<SkillTranslationOutput>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let provider = match config.llm_provider {
        Some(p) => p,
        None => return Ok(None),
    };
    let cache = TranslationCache::new();
    let key = CacheKey {
        base_url: &provider.base_url,
        model: &provider.model,
        target_lang: &target_lang,
        source_name: &label,
        source_description: "",
        source_content_md: Some(&content),
    };
    Ok(cache.get(&key).map(|hit| SkillTranslationOutput {
        name: hit.name,
        description: hit.description,
        content_md: hit.content_md,
        cached: true,
    }))
}
