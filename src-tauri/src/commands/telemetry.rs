use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::{TelemetryConfig, TelemetryConsent};
use crate::services::{ConfigManager, TelemetryService};
use serde_json::Value;

const TELEMETRY_API_BASE: &str = "https://skills-market-api.guardssl.info/api/v1";
const TELEMETRY_INGEST_PATH: &str = "/telemetry/ingest";

#[tauri::command]
pub fn telemetry_initialize() -> Result<(), String> {
    if !telemetry_collection_enabled()? {
        return Ok(());
    }

    let service = TelemetryService::new()?;
    service.initialize_session(&runtime_telemetry_config(), now_unix_seconds())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_record_heartbeat() -> Result<(), String> {
    if !telemetry_collection_enabled()? {
        return Ok(());
    }

    let service = TelemetryService::new()?;
    service.record_heartbeat(now_unix_seconds())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_end_session(reason: Option<String>) -> Result<(), String> {
    if !telemetry_collection_enabled()? {
        return Ok(());
    }

    let service = TelemetryService::new()?;
    service.end_session(now_unix_seconds(), reason.as_deref())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_flush_pending() -> Result<(), String> {
    if !telemetry_collection_enabled()? {
        return Ok(());
    }

    let service = TelemetryService::new()?;
    service.flush_pending(&runtime_telemetry_config(), now_unix_seconds())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_track_event(event_name: String, properties: Option<Value>) -> Result<(), String> {
    if !telemetry_collection_enabled()? {
        return Ok(());
    }

    if event_name.trim().is_empty() {
        return Err("Telemetry event name is required".to_string());
    }

    let service = TelemetryService::new()?;
    service.track_event(
        now_unix_seconds(),
        &event_name,
        &properties.unwrap_or(Value::Object(Default::default())),
    )?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_clear_local_data() -> Result<(), String> {
    let service = TelemetryService::new()?;
    service.clear_local_data()
}

fn runtime_telemetry_config() -> TelemetryConfig {
    TelemetryConfig {
        enabled: true,
        base_url: Some(TELEMETRY_API_BASE.to_string()),
        ingest_path: TELEMETRY_INGEST_PATH.to_string(),
        ingest_key: None,
        ..TelemetryConfig::default()
    }
}

fn now_unix_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn telemetry_collection_enabled() -> Result<bool, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let consent = config
        .preferences
        .as_ref()
        .map(|prefs| prefs.telemetry_consent.clone())
        .unwrap_or(TelemetryConsent::Unknown);
    Ok(consent == TelemetryConsent::Granted)
}

#[cfg(test)]
mod tests {
    use super::{
        telemetry_clear_local_data, telemetry_end_session, telemetry_initialize,
        telemetry_track_event,
    };
    use crate::models::TelemetryConsent;
    use crate::services::{ConfigManager, TelemetryService};
    use crate::test_support::with_temp_home;

    #[test]
    fn telemetry_command_initialize_skips_session_without_consent() {
        with_temp_home(|_| {
            telemetry_initialize().expect("telemetry initialize should not fail");

            let service = TelemetryService::new().expect("create telemetry service");
            assert_eq!(
                service.current_session().expect("read current session"),
                None,
                "unknown telemetry consent should skip creating a local session"
            );
        });
    }

    #[test]
    fn telemetry_command_initialize_creates_session_after_consent_granted() {
        with_temp_home(|_| {
            let manager = ConfigManager::new();
            let mut config = manager.init_default().expect("init default config");
            let prefs = config.preferences.get_or_insert_with(Default::default);
            prefs.telemetry_consent = TelemetryConsent::Granted;
            manager.save(&config).expect("save config");

            telemetry_initialize().expect("initialize telemetry");

            let service = TelemetryService::new().expect("create telemetry service");
            assert!(
                service
                    .current_session()
                    .expect("read current session")
                    .is_some(),
                "enabled telemetry should create a local session"
            );

            telemetry_end_session(Some("normal_close".to_string())).expect("end telemetry");
        });
    }

    #[test]
    fn telemetry_clear_local_data_removes_session_and_events() {
        with_temp_home(|_| {
            let manager = ConfigManager::new();
            let mut config = manager.init_default().expect("init default config");
            let prefs = config.preferences.get_or_insert_with(Default::default);
            prefs.telemetry_consent = TelemetryConsent::Granted;
            manager.save(&config).expect("save config");

            telemetry_initialize().expect("initialize telemetry");
            telemetry_track_event("settings_opened".to_string(), None).expect("track event");

            telemetry_clear_local_data().expect("clear telemetry data");

            let telemetry_dir = home_dir().join(".skills-manager").join("telemetry");
            let db_path = telemetry_dir.join("telemetry.sqlite3");
            assert!(
                !db_path.exists(),
                "clearing telemetry data should delete the local telemetry database"
            );

            let service = TelemetryService::new().expect("create telemetry service");
            assert_eq!(
                service.current_session().expect("read current session"),
                None,
                "clearing telemetry data should remove the active session"
            );
        });
    }

    fn home_dir() -> std::path::PathBuf {
        dirs::home_dir().expect("temp home should exist")
    }
}
