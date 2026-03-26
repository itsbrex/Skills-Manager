use std::fs;
use std::path::PathBuf;

use crate::models::{AppConfig, SkillMetadata, SourceType, ToolConfig, SUPPORTED_TOOLS};
#[cfg(windows)]
use crate::services::linker::LinkerService;
use crate::services::linker::{is_symlink_or_junction, normalize_path, remove_symlink_or_junction};

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    fn normalize_skill_tags(tags: &[String]) -> Vec<String> {
        let mut normalized = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for tag in tags {
            let collapsed = tag.split_whitespace().collect::<Vec<_>>().join(" ");
            let value = collapsed.trim().to_lowercase();
            if value.is_empty() || !seen.insert(value.clone()) {
                continue;
            }
            normalized.push(value);
        }

        normalized
    }

    fn normalize_skill_metadata(
        metadata: &std::collections::HashMap<String, SkillMetadata>,
    ) -> std::collections::HashMap<String, SkillMetadata> {
        let mut normalized = std::collections::HashMap::new();

        for (skill_id, item) in metadata {
            let trimmed_id = skill_id.trim();
            if trimmed_id.is_empty() {
                continue;
            }

            let tags = Self::normalize_skill_tags(&item.tags);
            if tags.is_empty() {
                continue;
            }

            normalized.insert(trimmed_id.to_string(), SkillMetadata { tags });
        }

        normalized
    }

    pub fn new() -> Self {
        let config_path = Self::get_config_path();
        let manager = Self { config_path };
        // 自动迁移旧目录
        manager.migrate_from_old_directory();
        manager
    }

    fn get_config_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".skills-manager")
            .join("config.json")
    }

    fn get_old_config_dir() -> PathBuf {
        dirs::home_dir().unwrap_or_default().join(".skills-hub")
    }

    fn get_new_config_dir() -> PathBuf {
        dirs::home_dir().unwrap_or_default().join(".skills-manager")
    }

    /// 从旧目录 .skills-hub 迁移到新目录 .skills-manager
    fn migrate_from_old_directory(&self) {
        let old_dir = Self::get_old_config_dir();
        let new_dir = Self::get_new_config_dir();

        // 如果旧目录存在且新目录不存在，执行迁移
        if old_dir.exists() && !new_dir.exists() {
            if let Err(e) = fs::rename(&old_dir, &new_dir) {
                // 如果 rename 失败（跨文件系统），尝试复制后删除
                if let Err(copy_err) = Self::copy_dir_recursive(&old_dir, &new_dir) {
                    eprintln!(
                        "Failed to migrate config directory: rename={}, copy={}",
                        e, copy_err
                    );
                    return;
                }
                // 复制成功后删除旧目录
                let _ = fs::remove_dir_all(&old_dir);
            }
            println!("Migrated config from .skills-hub to .skills-manager");

            // 更新 config.json 中的 skills_dir 路径
            Self::update_config_paths(&new_dir, &old_dir);

            // 修复各工具目录中的软链接
            Self::fix_symlinks_after_migration(&old_dir, &new_dir);
        }
    }

    /// 更新 config.json 中的路径引用
    fn update_config_paths(new_dir: &PathBuf, old_dir: &PathBuf) {
        let config_path = new_dir.join("config.json");
        if let Ok(content) = fs::read_to_string(&config_path) {
            let old_path_str = old_dir.to_string_lossy();
            let new_path_str = new_dir.to_string_lossy();

            // In JSON, backslashes are escaped as \\, so we need to replace both forms:
            // 1. The JSON-escaped form (e.g. "C:\\Users\\yjw\\.skills-hub")
            // 2. The raw form (e.g. "C:\Users\yjw\.skills-hub") — for non-JSON contexts
            let old_escaped = old_path_str.replace('\\', "\\\\");
            let new_escaped = new_path_str.replace('\\', "\\\\");

            let mut updated_content = content.replace(&old_escaped, &new_escaped);
            // Also replace raw form in case paths are stored without JSON escaping
            updated_content = updated_content.replace(&*old_path_str, &*new_path_str);

            if updated_content != content {
                let _ = fs::write(&config_path, updated_content);
                println!("Updated paths in config.json");
            }
        }
    }

    /// 修复各工具目录中指向旧路径的软链接
    fn fix_symlinks_after_migration(old_dir: &PathBuf, new_dir: &PathBuf) {
        let home_dir = dirs::home_dir().unwrap_or_default();

        // 已知的工具 skills 目录
        let tool_skills_dirs = [
            home_dir.join(".claude").join("skills"),
            home_dir.join(".codex").join("skills"),
            home_dir.join(".codebuddy").join("skills"),
        ];

        for tool_dir in &tool_skills_dirs {
            if !tool_dir.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(tool_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();

                    // 检查是否是软链接或 Junction（Windows）
                    if is_symlink_or_junction(&path) {
                        if let Ok(target) = fs::read_link(&path) {
                            let target_str = target.to_string_lossy();
                            let old_dir_str = old_dir.to_string_lossy();

                            // 如果链接指向旧目录，更新为新目录
                            if target_str.contains(&*old_dir_str) {
                                let new_target_str =
                                    target_str.replace(&*old_dir_str, &*new_dir.to_string_lossy());
                                let new_target = PathBuf::from(new_target_str.to_string());

                                // 删除旧链接（兼容 symlink 和 Junction）
                                let _ = remove_symlink_or_junction(&path);

                                // 使用 LinkerService 重建链接（含 Junction fallback）
                                #[cfg(unix)]
                                {
                                    let _ = std::os::unix::fs::symlink(&new_target, &path);
                                }

                                #[cfg(windows)]
                                {
                                    let _ =
                                        LinkerService::create_windows_symlink(&new_target, &path);
                                }

                                println!("Fixed symlink: {:?} -> {:?}", path, new_target);
                            }
                        }
                    }
                }
            }
        }
    }

    /// 递归复制目录
    fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), std::io::Error> {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if src_path.is_dir() {
                Self::copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)?;
            }
        }
        Ok(())
    }

    pub fn load(&self) -> Result<AppConfig, String> {
        if !self.config_path.exists() {
            return self.init_default();
        }

        let content = fs::read_to_string(&self.config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;

        let mut config: AppConfig =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;

        // Version Check & Migration
        let current_version = AppConfig::default().version;
        let mut updated = false;

        if config.version != current_version {
            config.version = current_version;
            updated = true;
        }

        if config.marketplace_sources.is_none() {
            config.marketplace_sources = AppConfig::default().marketplace_sources;
            updated = true;
        }

        let normalized_skill_metadata = Self::normalize_skill_metadata(&config.skill_metadata);
        if normalized_skill_metadata != config.skill_metadata {
            config.skill_metadata = normalized_skill_metadata;
            updated = true;
        }

        // Keep marketplace sources constrained to supported providers.
        // Unknown legacy providers are removed during load to prevent stale config from surfacing.
        let default_sources = AppConfig::default().marketplace_sources.unwrap_or_default();
        let previous_sources = config.marketplace_sources.clone();
        let mut normalized_sources = previous_sources
            .clone()
            .unwrap_or_else(|| default_sources.clone());
        normalized_sources.retain(|source| source.source_type != SourceType::Unknown);
        if normalized_sources.is_empty() {
            normalized_sources = default_sources;
        }
        if previous_sources.as_ref() != Some(&normalized_sources) {
            config.marketplace_sources = Some(normalized_sources);
            updated = true;
        }

        let loaded_skills_dir = normalize_path(&config.skills_dir);
        let loaded_skills_dir_str = loaded_skills_dir.to_string_lossy().into_owned();
        let default_skills_dir = normalize_path(&AppConfig::default_skills_dir());
        if loaded_skills_dir != default_skills_dir {
            config.skills_dir = default_skills_dir.clone();
            updated = true;
        }

        // Fix stale .skills-hub references left by failed migration on Windows.
        // On Windows, update_config_paths may have failed because to_string_lossy()
        // produces single backslashes but JSON contains escaped double backslashes.
        // This fixes configs where skills_dir still points to the old .skills-hub directory.
        {
            if loaded_skills_dir_str.contains(".skills-hub") {
                // Also fix tool paths that reference the old directory
                for tool_config in config.tools.values_mut() {
                    let sp = tool_config.skills_path.to_string_lossy();
                    if sp.contains(".skills-hub") {
                        tool_config.skills_path =
                            PathBuf::from(sp.replace(".skills-hub", ".skills-manager").to_string());
                    }
                    let cp = tool_config.config_path.to_string_lossy();
                    if cp.contains(".skills-hub") {
                        tool_config.config_path =
                            PathBuf::from(cp.replace(".skills-hub", ".skills-manager").to_string());
                    }
                }
                // Ensure the new skills directory exists
                if !default_skills_dir.exists() {
                    let _ = fs::create_dir_all(&default_skills_dir);
                }
                updated = true;
                println!("Fixed stale .skills-hub references in config");
            }
        }

        if !default_skills_dir.exists() {
            fs::create_dir_all(&default_skills_dir)
                .map_err(|e| format!("Failed to create skills directory: {}", e))?;
        }

        for tool_config in config.tools.values_mut() {
            let norm_sp = normalize_path(&tool_config.skills_path);
            let norm_cp = normalize_path(&tool_config.config_path);
            if norm_sp != tool_config.skills_path || norm_cp != tool_config.config_path {
                tool_config.skills_path = norm_sp;
                tool_config.config_path = norm_cp;
                updated = true;
            }
        }
        for custom in config.custom_tools.values_mut() {
            let norm_sp = normalize_path(&custom.skills_path);
            let norm_cp = normalize_path(&custom.config_path);
            if norm_sp != custom.skills_path || norm_cp != custom.config_path {
                custom.skills_path = norm_sp;
                custom.config_path = norm_cp;
                updated = true;
            }
        }

        // Migrate legacy default directories for newly supported tools.
        // Only rewrite when paths still match the old defaults we generated earlier.
        let home_dir = dirs::home_dir().unwrap_or_default();
        for (tool_id, old_dir, new_dir) in [
            ("droid", ".droid", ".factory"),
            ("vercel-skills", ".vercel", ".agents"),
        ] {
            if let Some(tool_config) = config.tools.get_mut(tool_id) {
                let old_config_path = normalize_path(&home_dir.join(old_dir));
                let old_skills_path = old_config_path.join("skills");
                if tool_config.config_path == old_config_path
                    && tool_config.skills_path == old_skills_path
                {
                    let new_config_path = normalize_path(&home_dir.join(new_dir));
                    tool_config.config_path = new_config_path.clone();
                    tool_config.skills_path = new_config_path.join("skills");
                    tool_config.detected = tool_config.config_path.exists();
                    updated = true;
                }
            }
        }

        // Auto-add newly supported tools that aren't in the config yet
        for tool_def in SUPPORTED_TOOLS {
            if !config.tools.contains_key(tool_def.id) {
                let tool_dir = normalize_path(&home_dir.join(tool_def.config_dir));
                let detected = tool_dir.exists();
                let tool_config = ToolConfig {
                    enabled: detected,
                    detected,
                    skills_path: tool_dir.join("skills"),
                    config_path: tool_dir,
                };
                config.tools.insert(tool_def.id.to_string(), tool_config);
                updated = true;
            }
        }

        // Save updated config if new tools were added or version changed
        if updated {
            let _ = self.save(&config);
        }

        Ok(config)
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let mut normalized = config.clone();
        normalized.skills_dir = normalize_path(&AppConfig::default_skills_dir());
        normalized.skill_metadata = Self::normalize_skill_metadata(&normalized.skill_metadata);
        fs::create_dir_all(&normalized.skills_dir)
            .map_err(|e| format!("Failed to create skills directory: {}", e))?;

        let content = serde_json::to_string_pretty(&normalized)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&self.config_path, content).map_err(|e| format!("Failed to write config: {}", e))
    }

    pub fn init_default(&self) -> Result<AppConfig, String> {
        let home_dir = dirs::home_dir().unwrap_or_default();
        let mut config = AppConfig::default();

        for tool_def in SUPPORTED_TOOLS {
            let tool_dir = normalize_path(&home_dir.join(tool_def.config_dir));
            let detected = tool_dir.exists();
            let tool_config = ToolConfig {
                enabled: detected, // Enable by default if detected
                detected,
                skills_path: tool_dir.join("skills"),
                config_path: tool_dir,
            };
            config.tools.insert(tool_def.id.to_string(), tool_config);
        }

        self.save(&config)?;
        Ok(config)
    }

    pub fn is_initialized(&self) -> bool {
        match self.load() {
            Ok(config) => config.initialized,
            Err(_) => false,
        }
    }
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::ConfigManager;
    use crate::models::SkillMetadata;
    use crate::test_support::with_temp_home;
    use serde_json::json;
    use std::fs;

    #[test]
    fn load_migrates_legacy_droid_and_vercel_default_paths() {
        with_temp_home(|home_dir| {
            let config_dir = home_dir.join(".skills-manager");
            fs::create_dir_all(&config_dir).expect("create config dir");
            let config_path = config_dir.join("config.json");

            let config_json = json!({
                "version": "1.1.0",
                "skills_dir": config_dir.join("skills").to_string_lossy(),
                "tools": {
                    "droid": {
                        "enabled": false,
                        "detected": false,
                        "skills_path": home_dir.join(".droid").join("skills").to_string_lossy(),
                        "config_path": home_dir.join(".droid").to_string_lossy()
                    },
                    "vercel-skills": {
                        "enabled": false,
                        "detected": false,
                        "skills_path": home_dir.join(".vercel").join("skills").to_string_lossy(),
                        "config_path": home_dir.join(".vercel").to_string_lossy()
                    }
                },
                "custom_tools": {},
                "initialized": true
            });
            fs::write(
                &config_path,
                serde_json::to_string_pretty(&config_json).expect("serialize config"),
            )
            .expect("write config");

            let manager = ConfigManager::new();
            let loaded = manager.load().expect("load config");

            let droid = loaded.tools.get("droid").expect("droid config");
            assert_eq!(droid.config_path, home_dir.join(".factory"));
            assert_eq!(droid.skills_path, home_dir.join(".factory").join("skills"));

            let vercel_skills = loaded.tools.get("vercel-skills").expect("vercel config");
            assert_eq!(vercel_skills.config_path, home_dir.join(".agents"));
            assert_eq!(
                vercel_skills.skills_path,
                home_dir.join(".agents").join("skills")
            );
        });
    }

    #[test]
    fn load_preserves_non_github_marketplace_sources_enabled_state() {
        with_temp_home(|home_dir| {
            let config_dir = home_dir.join(".skills-manager");
            fs::create_dir_all(&config_dir).expect("create config dir");
            let config_path = config_dir.join("config.json");

            let config_json = json!({
                "version": "1.1.2",
                "skills_dir": config_dir.join("skills").to_string_lossy(),
                "tools": {},
                "custom_tools": {},
                "marketplace_sources": [
                    {
                        "id": "src_test_crawler",
                        "name": "Test Crawler Source",
                        "url": "https://example.com",
                        "source_type": "crawler",
                        "enabled": false,
                        "builtin": true,
                        "api_key": null
                    }
                ],
                "initialized": true
            });
            fs::write(
                &config_path,
                serde_json::to_string_pretty(&config_json).expect("serialize config"),
            )
            .expect("write config");

            let manager = ConfigManager::new();
            let loaded = manager.load().expect("load config");
            let sources = loaded
                .marketplace_sources
                .expect("marketplace sources should exist");

            assert_eq!(sources.len(), 1, "should keep configured source");
            assert_eq!(sources[0].id, "src_test_crawler");
            assert!(
                !sources[0].enabled,
                "enabled=false should persist after loading config"
            );
        });
    }

    #[test]
    fn save_and_load_force_default_skills_dir() {
        with_temp_home(|home_dir| {
            let manager = ConfigManager::new();
            let mut config = manager.init_default().expect("init default config");
            let config_path = home_dir.join(".skills-manager").join("config.json");
            let expected_skills_dir = home_dir.join(".skills-manager").join("skills");

            config.skills_dir = home_dir.join("custom-skills-dir");
            manager.save(&config).expect("save config");

            let saved: serde_json::Value =
                serde_json::from_str(&fs::read_to_string(&config_path).expect("read saved config"))
                    .expect("parse saved config");
            assert_eq!(
                saved.get("skills_dir").and_then(|value| value.as_str()),
                Some(expected_skills_dir.to_string_lossy().as_ref())
            );

            let loaded = manager.load().expect("load config");
            assert_eq!(loaded.skills_dir, expected_skills_dir);
        });
    }

    #[test]
    fn save_and_load_skill_tags_round_trip() {
        with_temp_home(|_home_dir| {
            let manager = ConfigManager::new();
            let mut config = manager.init_default().expect("init default config");
            config.skill_metadata.insert(
                "react-playground".to_string(),
                SkillMetadata {
                    tags: vec!["react".to_string(), "frontend".to_string()],
                },
            );

            manager.save(&config).expect("save config");

            let loaded = manager.load().expect("load config");
            assert_eq!(
                loaded.skill_metadata.get("react-playground"),
                Some(&SkillMetadata {
                    tags: vec!["react".to_string(), "frontend".to_string()],
                })
            );
        });
    }
}
