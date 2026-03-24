use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::TelemetryConfig;
use crate::services::TelemetryService;
use serde_json::Value;

const TELEMETRY_API_BASE: &str = "https://skills-market-api.guardssl.info/api/v1";
const TELEMETRY_INGEST_PATH: &str = "/telemetry/ingest";

#[tauri::command]
pub fn telemetry_initialize() -> Result<(), String> {
    let service = TelemetryService::new()?;
    service.initialize_session(&runtime_telemetry_config(), now_unix_seconds())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_record_heartbeat() -> Result<(), String> {
    let service = TelemetryService::new()?;
    service.record_heartbeat(now_unix_seconds())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_end_session(reason: Option<String>) -> Result<(), String> {
    let service = TelemetryService::new()?;
    service.end_session(now_unix_seconds(), reason.as_deref())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_flush_pending() -> Result<(), String> {
    let service = TelemetryService::new()?;
    service.flush_pending(&runtime_telemetry_config(), now_unix_seconds())?;
    Ok(())
}

#[tauri::command]
pub fn telemetry_track_event(event_name: String, properties: Option<Value>) -> Result<(), String> {
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

#[cfg(test)]
mod tests {
    use super::{telemetry_end_session, telemetry_initialize};
    use crate::services::TelemetryService;
    use crate::test_support::with_temp_home;

    #[test]
    fn telemetry_command_initialize_creates_session_by_default() {
        with_temp_home(|_| {
            telemetry_initialize().expect("telemetry initialize should not fail");

            let service = TelemetryService::new().expect("create telemetry service");
            assert!(
                service
                    .current_session()
                    .expect("read current session")
                    .is_some(),
                "telemetry initialize should create a local session"
            );

            telemetry_end_session(Some("normal_close".to_string())).expect("end telemetry");
        });
    }

    #[test]
    fn telemetry_command_initialize_creates_session_without_config_toggle() {
        with_temp_home(|_| {
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
}
