use crate::models::cloud_sync::{
    CloudSyncCustomTool, CloudSyncPayload, CloudSyncSkill, CloudSyncToolState,
};
use crate::models::{AppConfig, Skill, SkillSource};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn build_payload(config: &AppConfig, skills: &[Skill]) -> CloudSyncPayload {
    let device_id = config
        .cloud_sync
        .as_ref()
        .map(|state| state.device_id.clone())
        .unwrap_or_default();

    let mut tool_states: HashMap<String, CloudSyncToolState> = HashMap::new();
    for (tool_id, tool_config) in config.collect_tool_configs() {
        let enabled_skills: Vec<String> = skills
            .iter()
            .filter(|skill| skill.is_enabled_for(&tool_id))
            .map(|skill| skill.id.clone())
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

    let skills_payload = skills
        .iter()
        .map(|skill| CloudSyncSkill {
            id: skill.id.clone(),
            name: skill.name.clone(),
            source: match skill.source {
                SkillSource::Local => "local".to_string(),
                SkillSource::Imported => "imported".to_string(),
            },
            version: skill.version.clone(),
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
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CustomToolConfig, ToolConfig};

    #[test]
    fn build_payload_includes_enabled_skills_and_custom_tools() {
        let mut config = AppConfig::default();
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
            vec!["s1".to_string()]
        );
        assert_eq!(payload.custom_tools.len(), 1);
    }
}
