use std::path::PathBuf;
use std::sync::OnceLock;

use crate::models::TelemetryConfig;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

pub struct TelemetryService {
    #[allow(dead_code)]
    db_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSessionRecord {
    pub session_id: String,
    pub install_id: String,
    pub started_at: i64,
    pub last_seen_at: i64,
    pub ended_at: Option<i64>,
    pub end_reason: Option<String>,
    pub needs_upload: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TelemetryFlushResult {
    pub sessions_uploaded: usize,
    pub events_uploaded: usize,
}

#[derive(Debug, Clone, Serialize)]
struct TelemetryBatchPayload {
    schema_version: u32,
    request_id: String,
    sent_at: i64,
    client: TelemetryClientPayload,
    sessions: Vec<TelemetrySessionPayload>,
    events: Vec<TelemetryEventPayload>,
}

#[derive(Debug, Clone, Serialize)]
struct TelemetryClientPayload {
    install_id: String,
    user_id: Option<String>,
    platform: String,
    os_version: Option<String>,
    app_version: String,
}

#[derive(Debug, Clone, Serialize)]
struct TelemetrySessionPayload {
    session_id: String,
    started_at: i64,
    last_seen_at: i64,
    ended_at: Option<i64>,
    end_reason: Option<String>,
    heartbeat_interval_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
struct TelemetryEventPayload {
    event_id: String,
    session_id: Option<String>,
    event_name: String,
    event_time: i64,
    properties: Value,
}

#[derive(Debug, Clone)]
struct PendingSessionRow {
    session_id: String,
    started_at: i64,
    last_seen_at: i64,
    ended_at: Option<i64>,
    end_reason: Option<String>,
    heartbeat_interval_secs: i64,
}

#[derive(Debug, Clone)]
struct PendingEventRow {
    event_id: String,
    session_id: Option<String>,
    event_name: String,
    event_time: i64,
    properties: Value,
}

trait TelemetryTransport {
    fn send(
        &self,
        endpoint: &str,
        ingest_key: Option<&str>,
        request_id: &str,
        payload: &TelemetryBatchPayload,
    ) -> Result<(), String>;
}

impl TelemetryService {
    pub fn new() -> Result<Self, String> {
        let base_dir = dirs::home_dir()
            .unwrap_or_default()
            .join(".skills-manager")
            .join("telemetry");
        std::fs::create_dir_all(&base_dir)
            .map_err(|e| format!("Failed to create telemetry directory: {}", e))?;

        Ok(Self {
            db_path: base_dir.join("telemetry.sqlite3"),
        })
    }

    pub fn initialize_session(
        &self,
        config: &TelemetryConfig,
        now: i64,
    ) -> Result<LocalSessionRecord, String> {
        self.initialize_session_for_runtime(config, now, process_runtime_id())
    }

    fn initialize_session_for_runtime(
        &self,
        config: &TelemetryConfig,
        now: i64,
        runtime_id: &str,
    ) -> Result<LocalSessionRecord, String> {
        let conn = self.connection()?;

        let current_session_id = self.get_meta_value(&conn, META_CURRENT_SESSION_ID)?;
        let current_runtime_id = self.get_meta_value(&conn, META_CURRENT_RUNTIME_ID)?;

        if let Some(session_id) = current_session_id.as_deref() {
            let current_session = self.load_session_by_id(&conn, session_id)?;

            if current_runtime_id.as_deref() == Some(runtime_id) {
                if let Some(current) = current_session {
                    if current.ended_at.is_none() {
                        return Ok(current);
                    }
                }

                self.clear_current_session_meta(&conn)?;
            } else {
                if let Some(current) = current_session {
                    if current.ended_at.is_none() {
                        self.end_session_in_connection(
                            &conn,
                            &current.session_id,
                            now,
                            Some("unknown"),
                        )?;
                    }
                }

                self.clear_current_session_meta(&conn)?;
            }
        }

        let install_id = self.get_or_create_install_id(&conn)?;
        let session_id = Uuid::new_v4().to_string();
        let app_version = env!("CARGO_PKG_VERSION").to_string();
        let platform = std::env::consts::OS.to_string();
        let os_version = Some(format!(
            "{}-{}",
            std::env::consts::OS,
            std::env::consts::ARCH
        ));

        conn.execute(
            r#"
            insert into sessions (
              session_id,
              install_id,
              user_id,
              app_version,
              platform,
              os_version,
              started_at,
              last_seen_at,
              ended_at,
              end_reason,
              heartbeat_interval_secs,
              needs_upload,
              uploaded_at,
              created_at,
              updated_at
            ) values (?1, ?2, null, ?3, ?4, ?5, ?6, ?6, null, null, ?7, 1, null, ?6, ?6)
            "#,
            params![
                session_id,
                install_id,
                app_version,
                platform,
                os_version,
                now,
                config.heartbeat_interval_secs as i64
            ],
        )
        .map_err(|e| format!("Failed to insert telemetry session: {}", e))?;

        self.set_meta_value(&conn, META_CURRENT_SESSION_ID, &session_id)?;
        self.set_meta_value(&conn, META_CURRENT_RUNTIME_ID, runtime_id)?;
        self.load_session_by_id(&conn, &session_id)?
            .ok_or_else(|| "Inserted telemetry session could not be loaded".to_string())
    }

    pub fn record_heartbeat(&self, now: i64) -> Result<(), String> {
        let conn = self.connection()?;
        let Some(session_id) = self.get_meta_value(&conn, META_CURRENT_SESSION_ID)? else {
            return Ok(());
        };

        conn.execute(
            r#"
            update sessions
            set
              last_seen_at = max(last_seen_at, ?2),
              needs_upload = 1,
              updated_at = ?2
            where session_id = ?1 and ended_at is null
            "#,
            params![session_id, now],
        )
        .map_err(|e| format!("Failed to update telemetry heartbeat: {}", e))?;

        Ok(())
    }

    pub fn end_session(&self, now: i64, reason: Option<&str>) -> Result<(), String> {
        let conn = self.connection()?;
        let Some(session_id) = self.get_meta_value(&conn, META_CURRENT_SESSION_ID)? else {
            return Ok(());
        };

        self.end_session_in_connection(&conn, &session_id, now, reason)?;
        self.clear_current_session_meta(&conn)?;
        Ok(())
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn current_session(&self) -> Result<Option<LocalSessionRecord>, String> {
        let conn = self.connection()?;
        self.current_session_from_connection(&conn)
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn install_id(&self) -> Result<Option<String>, String> {
        let conn = self.connection()?;
        self.get_meta_value(&conn, META_INSTALL_ID)
    }

    pub fn track_event(
        &self,
        _now: i64,
        _event_name: &str,
        _properties: &Value,
    ) -> Result<(), String> {
        let conn = self.connection()?;
        let install_id = self.get_or_create_install_id(&conn)?;
        let session_id = self.get_meta_value(&conn, META_CURRENT_SESSION_ID)?;
        let event_id = Uuid::new_v4().to_string();
        let app_version = env!("CARGO_PKG_VERSION").to_string();
        let platform = std::env::consts::OS.to_string();
        let properties = serde_json::to_string(_properties)
            .map_err(|e| format!("Failed to serialize telemetry event properties: {}", e))?;

        conn.execute(
            r#"
            insert into events (
              event_id,
              install_id,
              session_id,
              user_id,
              event_name,
              event_time,
              app_version,
              platform,
              properties,
              needs_upload,
              uploaded_at,
              created_at
            ) values (?1, ?2, ?3, null, ?4, ?5, ?6, ?7, ?8, 1, null, ?5)
            "#,
            params![
                event_id,
                install_id,
                session_id,
                _event_name,
                _now,
                app_version,
                platform,
                properties
            ],
        )
        .map_err(|e| format!("Failed to insert telemetry event: {}", e))?;

        Ok(())
    }

    pub fn flush_pending(
        &self,
        config: &TelemetryConfig,
        now: i64,
    ) -> Result<TelemetryFlushResult, String> {
        let transport = BlockingReqwestTransport::default();
        self.flush_pending_with(config, now, &transport)
    }

    fn flush_pending_with<T: TelemetryTransport>(
        &self,
        config: &TelemetryConfig,
        now: i64,
        transport: &T,
    ) -> Result<TelemetryFlushResult, String> {
        let endpoint = self.ingest_endpoint(config)?;
        let ingest_key = config
            .ingest_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let conn = self.connection()?;
        let install_id = self.get_or_create_install_id(&conn)?;
        let sessions = self.pending_sessions(&conn, config.batch_size)?;
        let events = self.pending_events(&conn, config.batch_size)?;

        if sessions.is_empty() && events.is_empty() {
            return Ok(TelemetryFlushResult {
                sessions_uploaded: 0,
                events_uploaded: 0,
            });
        }

        let request_id = Uuid::new_v4().to_string();
        let payload = TelemetryBatchPayload {
            schema_version: 1,
            request_id: request_id.clone(),
            sent_at: now,
            client: TelemetryClientPayload {
                install_id,
                user_id: None,
                platform: std::env::consts::OS.to_string(),
                os_version: Some(format!(
                    "{}-{}",
                    std::env::consts::OS,
                    std::env::consts::ARCH
                )),
                app_version: env!("CARGO_PKG_VERSION").to_string(),
            },
            sessions: sessions
                .iter()
                .map(|session| TelemetrySessionPayload {
                    session_id: session.session_id.clone(),
                    started_at: session.started_at,
                    last_seen_at: session.last_seen_at,
                    ended_at: session.ended_at,
                    end_reason: session.end_reason.clone(),
                    heartbeat_interval_secs: session.heartbeat_interval_secs,
                })
                .collect(),
            events: events
                .iter()
                .map(|event| TelemetryEventPayload {
                    event_id: event.event_id.clone(),
                    session_id: event.session_id.clone(),
                    event_name: event.event_name.clone(),
                    event_time: event.event_time,
                    properties: event.properties.clone(),
                })
                .collect(),
        };

        transport.send(&endpoint, ingest_key, &request_id, &payload)?;
        self.mark_sessions_uploaded(&conn, &sessions, now)?;
        self.mark_events_uploaded(&conn, &events, now)?;

        Ok(TelemetryFlushResult {
            sessions_uploaded: sessions.len(),
            events_uploaded: events.len(),
        })
    }

    #[cfg_attr(not(test), allow(dead_code))]
    fn pending_counts(&self) -> Result<(usize, usize), String> {
        let conn = self.connection()?;
        let pending_sessions = conn
            .query_row(
                "select count(*) from sessions where needs_upload = 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| format!("Failed to count pending telemetry sessions: {}", e))?;
        let pending_events = conn
            .query_row(
                "select count(*) from events where needs_upload = 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| format!("Failed to count pending telemetry events: {}", e))?;

        Ok((pending_sessions as usize, pending_events as usize))
    }

    fn connection(&self) -> Result<Connection, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to open telemetry database: {}", e))?;
        self.ensure_schema(&conn)?;
        Ok(conn)
    }

    fn ensure_schema(&self, conn: &Connection) -> Result<(), String> {
        conn.execute_batch(
            r#"
            create table if not exists meta (
              key text primary key,
              value text not null
            );

            create table if not exists sessions (
              session_id text primary key,
              install_id text not null,
              user_id text,
              app_version text not null,
              platform text not null,
              os_version text,
              started_at integer not null,
              last_seen_at integer not null,
              ended_at integer,
              end_reason text,
              heartbeat_interval_secs integer not null,
              needs_upload integer not null default 1,
              uploaded_at integer,
              created_at integer not null,
              updated_at integer not null
            );

            create index if not exists idx_sessions_needs_upload_started
              on sessions (needs_upload, started_at);

            create table if not exists events (
              event_id text primary key,
              install_id text not null,
              session_id text,
              user_id text,
              event_name text not null,
              event_time integer not null,
              app_version text not null,
              platform text not null,
              properties text not null,
              needs_upload integer not null default 1,
              uploaded_at integer,
              created_at integer not null
            );

            create index if not exists idx_events_needs_upload_time
              on events (needs_upload, event_time);
            "#,
        )
        .map_err(|e| format!("Failed to initialize telemetry schema: {}", e))
    }

    fn current_session_from_connection(
        &self,
        conn: &Connection,
    ) -> Result<Option<LocalSessionRecord>, String> {
        let Some(session_id) = self.get_meta_value(conn, META_CURRENT_SESSION_ID)? else {
            return Ok(None);
        };

        let current = self.load_session_by_id(conn, &session_id)?;
        match current {
            Some(session) if session.ended_at.is_none() => Ok(Some(session)),
            _ => {
                self.clear_current_session_meta(conn)?;
                Ok(None)
            }
        }
    }

    fn load_session_by_id(
        &self,
        conn: &Connection,
        session_id: &str,
    ) -> Result<Option<LocalSessionRecord>, String> {
        conn.query_row(
            r#"
            select
              session_id,
              install_id,
              started_at,
              last_seen_at,
              ended_at,
              end_reason,
              needs_upload
            from sessions
            where session_id = ?1
            "#,
            params![session_id],
            |row| {
                Ok(LocalSessionRecord {
                    session_id: row.get(0)?,
                    install_id: row.get(1)?,
                    started_at: row.get(2)?,
                    last_seen_at: row.get(3)?,
                    ended_at: row.get(4)?,
                    end_reason: row.get(5)?,
                    needs_upload: row.get::<_, i64>(6)? != 0,
                })
            },
        )
        .optional()
        .map_err(|e| format!("Failed to load telemetry session: {}", e))
    }

    fn get_or_create_install_id(&self, conn: &Connection) -> Result<String, String> {
        if let Some(install_id) = self.get_meta_value(conn, META_INSTALL_ID)? {
            return Ok(install_id);
        }

        let install_id = Uuid::new_v4().to_string();
        self.set_meta_value(conn, META_INSTALL_ID, &install_id)?;
        Ok(install_id)
    }

    fn get_meta_value(&self, conn: &Connection, key: &str) -> Result<Option<String>, String> {
        conn.query_row(
            "select value from meta where key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read telemetry meta value: {}", e))
    }

    fn set_meta_value(&self, conn: &Connection, key: &str, value: &str) -> Result<(), String> {
        conn.execute(
            r#"
            insert into meta (key, value) values (?1, ?2)
            on conflict(key) do update set value = excluded.value
            "#,
            params![key, value],
        )
        .map_err(|e| format!("Failed to write telemetry meta value: {}", e))?;

        Ok(())
    }

    fn delete_meta_value(&self, conn: &Connection, key: &str) -> Result<(), String> {
        conn.execute("delete from meta where key = ?1", params![key])
            .map_err(|e| format!("Failed to delete telemetry meta value: {}", e))?;
        Ok(())
    }

    fn clear_current_session_meta(&self, conn: &Connection) -> Result<(), String> {
        self.delete_meta_value(conn, META_CURRENT_SESSION_ID)?;
        self.delete_meta_value(conn, META_CURRENT_RUNTIME_ID)?;
        Ok(())
    }

    fn end_session_in_connection(
        &self,
        conn: &Connection,
        session_id: &str,
        now: i64,
        reason: Option<&str>,
    ) -> Result<(), String> {
        conn.execute(
            r#"
            update sessions
            set
              last_seen_at = max(last_seen_at, ?2),
              ended_at = case
                when ended_at is null then ?2
                else max(ended_at, ?2)
              end,
              end_reason = coalesce(?3, end_reason),
              needs_upload = 1,
              updated_at = ?2
            where session_id = ?1
            "#,
            params![session_id, now, reason],
        )
        .map_err(|e| format!("Failed to end telemetry session: {}", e))?;

        Ok(())
    }

    fn ingest_endpoint(&self, config: &TelemetryConfig) -> Result<String, String> {
        let base_url = config
            .base_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "Telemetry base URL is not configured".to_string())?;

        let path = if config.ingest_path.starts_with('/') {
            config.ingest_path.clone()
        } else {
            format!("/{}", config.ingest_path)
        };

        Ok(format!("{}{}", base_url.trim_end_matches('/'), path))
    }

    fn pending_sessions(
        &self,
        conn: &Connection,
        batch_size: u32,
    ) -> Result<Vec<PendingSessionRow>, String> {
        let mut stmt = conn
            .prepare(
                r#"
                select
                  session_id,
                  started_at,
                  last_seen_at,
                  ended_at,
                  end_reason,
                  heartbeat_interval_secs
                from sessions
                where needs_upload = 1
                order by started_at asc
                limit ?1
                "#,
            )
            .map_err(|e| format!("Failed to prepare pending sessions query: {}", e))?;
        let rows = stmt
            .query_map(params![batch_size as i64], |row| {
                Ok(PendingSessionRow {
                    session_id: row.get(0)?,
                    started_at: row.get(1)?,
                    last_seen_at: row.get(2)?,
                    ended_at: row.get(3)?,
                    end_reason: row.get(4)?,
                    heartbeat_interval_secs: row.get(5)?,
                })
            })
            .map_err(|e| format!("Failed to query pending telemetry sessions: {}", e))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect pending telemetry sessions: {}", e))
    }

    fn pending_events(
        &self,
        conn: &Connection,
        batch_size: u32,
    ) -> Result<Vec<PendingEventRow>, String> {
        let mut stmt = conn
            .prepare(
                r#"
                select
                  event_id,
                  session_id,
                  event_name,
                  event_time,
                  properties
                from events
                where needs_upload = 1
                order by event_time asc
                limit ?1
                "#,
            )
            .map_err(|e| format!("Failed to prepare pending events query: {}", e))?;
        let rows = stmt
            .query_map(params![batch_size as i64], |row| {
                let raw_properties: String = row.get(4)?;
                let properties = serde_json::from_str(&raw_properties).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        raw_properties.len(),
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
                Ok(PendingEventRow {
                    event_id: row.get(0)?,
                    session_id: row.get(1)?,
                    event_name: row.get(2)?,
                    event_time: row.get(3)?,
                    properties,
                })
            })
            .map_err(|e| format!("Failed to query pending telemetry events: {}", e))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect pending telemetry events: {}", e))
    }

    fn mark_sessions_uploaded(
        &self,
        conn: &Connection,
        sessions: &[PendingSessionRow],
        now: i64,
    ) -> Result<(), String> {
        let mut stmt = conn
            .prepare(
                "update sessions set needs_upload = 0, uploaded_at = ?2, updated_at = ?2 where session_id = ?1",
            )
            .map_err(|e| format!("Failed to prepare telemetry session upload marker: {}", e))?;

        for session in sessions {
            stmt.execute(params![session.session_id, now])
                .map_err(|e| format!("Failed to mark telemetry session uploaded: {}", e))?;
        }

        Ok(())
    }

    fn mark_events_uploaded(
        &self,
        conn: &Connection,
        events: &[PendingEventRow],
        now: i64,
    ) -> Result<(), String> {
        let mut stmt = conn
            .prepare("update events set needs_upload = 0, uploaded_at = ?2 where event_id = ?1")
            .map_err(|e| format!("Failed to prepare telemetry event upload marker: {}", e))?;

        for event in events {
            stmt.execute(params![event.event_id, now])
                .map_err(|e| format!("Failed to mark telemetry event uploaded: {}", e))?;
        }

        Ok(())
    }
}

const META_INSTALL_ID: &str = "install_id";
const META_CURRENT_SESSION_ID: &str = "current_session_id";
const META_CURRENT_RUNTIME_ID: &str = "current_runtime_id";

fn process_runtime_id() -> &'static str {
    static PROCESS_RUNTIME_ID: OnceLock<String> = OnceLock::new();
    PROCESS_RUNTIME_ID
        .get_or_init(|| Uuid::new_v4().to_string())
        .as_str()
}

#[derive(Default)]
struct BlockingReqwestTransport;

impl TelemetryTransport for BlockingReqwestTransport {
    fn send(
        &self,
        endpoint: &str,
        ingest_key: Option<&str>,
        request_id: &str,
        payload: &TelemetryBatchPayload,
    ) -> Result<(), String> {
        let mut request = reqwest::blocking::Client::new()
            .post(endpoint)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/plain, */*")
            .header("X-Request-Id", request_id)
            .header("Origin", "https://skills-market-api.guardssl.info")
            .header("Referer", "https://skills-market-api.guardssl.info/")
            .header(
                "User-Agent",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            )
            .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
            .json(payload)
            ;

        if let Some(value) = ingest_key {
            request = request.header("X-Ingest-Key", value);
        }

        let response = request
            .send()
            .map_err(|e| format!("Failed to send telemetry payload: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Telemetry ingest request failed with status {}",
                response.status()
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        TelemetryBatchPayload, TelemetryFlushResult, TelemetryService, TelemetryTransport,
    };
    use crate::models::TelemetryConfig;
    use crate::test_support::with_temp_home;
    use serde_json::json;
    use std::sync::{Arc, Mutex};

    fn enabled_config() -> TelemetryConfig {
        TelemetryConfig {
            enabled: true,
            base_url: Some("https://skills-market-api.guardssl.info/api/v1".to_string()),
            ingest_path: "/telemetry/ingest".to_string(),
            ingest_key: None,
            ..TelemetryConfig::default()
        }
    }

    #[test]
    fn telemetry_initialize_creates_install_and_session() {
        with_temp_home(|_| {
            let service = TelemetryService::new().expect("create service");
            let session = service
                .initialize_session(&enabled_config(), 1_741_338_000)
                .expect("initialize telemetry session");

            let install_id = service
                .install_id()
                .expect("read install id")
                .expect("install id should be created");

            assert_eq!(session.install_id, install_id);
            assert_eq!(session.started_at, 1_741_338_000);
            assert_eq!(session.last_seen_at, 1_741_338_000);
            assert!(session.ended_at.is_none());
            assert!(session.needs_upload);
        });
    }

    #[test]
    fn telemetry_heartbeat_updates_last_seen_at() {
        with_temp_home(|_| {
            let service = TelemetryService::new().expect("create service");
            service
                .initialize_session(&enabled_config(), 1_741_338_000)
                .expect("initialize telemetry session");

            service
                .record_heartbeat(1_741_338_060)
                .expect("record heartbeat");

            let session = service
                .current_session()
                .expect("load current session")
                .expect("current session should exist");
            assert_eq!(session.last_seen_at, 1_741_338_060);
            assert!(session.ended_at.is_none());
            assert!(session.needs_upload);
        });
    }

    #[test]
    fn telemetry_initialize_replaces_stale_session_from_previous_runtime() {
        with_temp_home(|_| {
            let service = TelemetryService::new().expect("create service");
            let config = enabled_config();

            let first = service
                .initialize_session_for_runtime(&config, 1_741_338_000, "runtime-a")
                .expect("initialize first runtime session");

            let same_runtime = service
                .initialize_session_for_runtime(&config, 1_741_338_030, "runtime-a")
                .expect("reuse session in same runtime");
            assert_eq!(same_runtime.session_id, first.session_id);

            let second = service
                .initialize_session_for_runtime(&config, 1_741_338_120, "runtime-b")
                .expect("initialize second runtime session");

            assert_ne!(second.session_id, first.session_id);

            let conn = service.connection().expect("open telemetry database");
            let original = service
                .load_session_by_id(&conn, &first.session_id)
                .expect("load original session")
                .expect("original session should still exist");
            assert_eq!(original.ended_at, Some(1_741_338_120));
            assert_eq!(original.end_reason.as_deref(), Some("unknown"));

            let current = service
                .current_session()
                .expect("load current session")
                .expect("current session should exist");
            assert_eq!(current.session_id, second.session_id);
            assert!(current.ended_at.is_none());
        });
    }

    #[test]
    fn telemetry_end_session_marks_session_complete() {
        with_temp_home(|_| {
            let service = TelemetryService::new().expect("create service");
            service
                .initialize_session(&enabled_config(), 1_741_338_000)
                .expect("initialize telemetry session");

            service
                .end_session(1_741_338_120, Some("normal_close"))
                .expect("end telemetry session");

            let current = service.current_session().expect("load current session");
            assert!(
                current.is_none(),
                "current session should be cleared after end"
            );
        });
    }

    #[derive(Default, Clone)]
    struct RecordingTransport {
        payloads: Arc<Mutex<Vec<TelemetryBatchPayload>>>,
    }

    impl TelemetryTransport for RecordingTransport {
        fn send(
            &self,
            _endpoint: &str,
            _ingest_key: Option<&str>,
            _request_id: &str,
            payload: &TelemetryBatchPayload,
        ) -> Result<(), String> {
            self.payloads
                .lock()
                .expect("lock payload recorder")
                .push(payload.clone());
            Ok(())
        }
    }

    #[test]
    fn telemetry_flush_builds_batch_payload() {
        with_temp_home(|_| {
            let service = TelemetryService::new().expect("create service");
            let config = enabled_config();
            let transport = RecordingTransport::default();

            service
                .initialize_session(&config, 1_741_338_000)
                .expect("initialize telemetry session");
            service
                .track_event(1_741_338_030, "app_opened", &json!({ "screen": "skills" }))
                .expect("track telemetry event");
            service
                .end_session(1_741_338_120, Some("normal_close"))
                .expect("end telemetry session");

            let result = service
                .flush_pending_with(&config, 1_741_338_180, &transport)
                .expect("flush telemetry data");

            assert_eq!(
                result,
                TelemetryFlushResult {
                    sessions_uploaded: 1,
                    events_uploaded: 1
                }
            );

            let payloads = transport.payloads.lock().expect("lock payloads");
            assert_eq!(payloads.len(), 1);
            assert_eq!(payloads[0].sessions.len(), 1);
            assert_eq!(payloads[0].events.len(), 1);
            assert_eq!(payloads[0].sessions[0].ended_at, Some(1_741_338_120));
            assert_eq!(payloads[0].events[0].event_name, "app_opened");
        });
    }

    #[test]
    fn telemetry_flush_marks_uploaded_records_on_success() {
        with_temp_home(|_| {
            let service = TelemetryService::new().expect("create service");
            let config = enabled_config();
            let transport = RecordingTransport::default();

            service
                .initialize_session(&config, 1_741_338_000)
                .expect("initialize telemetry session");
            service
                .track_event(1_741_338_030, "app_opened", &json!({ "screen": "skills" }))
                .expect("track telemetry event");
            service
                .end_session(1_741_338_120, Some("normal_close"))
                .expect("end telemetry session");

            service
                .flush_pending_with(&config, 1_741_338_180, &transport)
                .expect("flush telemetry data");

            let (pending_sessions, pending_events) =
                service.pending_counts().expect("load pending counts");
            assert_eq!(pending_sessions, 0);
            assert_eq!(pending_events, 0);
        });
    }
}
