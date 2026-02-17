use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE, ORIGIN, REFERER, USER_AGENT};
use reqwest::{Client, Method, StatusCode, Url};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use crate::models::PollClientState as ModelPollClientState;
use crate::services::ConfigManager;

const POLLS_API_BASE: &str = "https://skills-market-api.guardssl.info/api/v1";
const POLLS_SITE_ORIGIN: &str = "https://skills-market-api.guardssl.info";
const POLLS_SITE_REFERER: &str = "https://skills-market-api.guardssl.info/";
const BROWSER_LIKE_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const CURL_LIKE_USER_AGENT: &str = "curl/8.7.1";
const HTTP_STATUS_MARKER: &str = "__HTTP_STATUS__:";

#[derive(Debug, Deserialize)]
struct ApiSuccess<T> {
    data: T,
}

#[derive(Debug, Deserialize)]
struct ApiErrorResponse {
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    code: Option<String>,
    message: Option<String>,
}

struct RawHttpResponse {
    status_code: u16,
    body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollOption {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollOptionResult {
    pub id: String,
    pub label: String,
    pub votes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Poll {
    pub id: String,
    pub title: String,
    pub locale: String,
    pub default_locale: String,
    pub is_active: bool,
    pub options: Vec<PollOption>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollResult {
    pub id: String,
    pub title: String,
    pub locale: String,
    pub default_locale: String,
    pub is_active: bool,
    pub options: Vec<PollOptionResult>,
    pub total_votes: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollVoteRequest {
    pub voter_id: String,
    pub option_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollVote {
    pub id: String,
    pub poll_id: String,
    pub voter_id: String,
    pub option_id: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollClientStatePayload {
    pub voter_id: Option<String>,
    pub voted_options: HashMap<String, String>,
}

fn normalize_poll_client_state(
    state: PollClientStatePayload,
) -> PollClientStatePayload {
    let voter_id = state
        .voter_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let voted_options = state
        .voted_options
        .into_iter()
        .filter_map(|(poll_id, option_id)| {
            let poll_id = poll_id.trim().to_string();
            let option_id = option_id.trim().to_string();
            if poll_id.is_empty() || option_id.is_empty() {
                return None;
            }
            Some((poll_id, option_id))
        })
        .collect();

    PollClientStatePayload {
        voter_id,
        voted_options,
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn build_accept_language(locale: Option<&str>) -> String {
    match locale
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("en")
        .to_lowercase()
        .as_str()
    {
        "zh" | "zh-cn" | "zh-hans" => "zh-CN,zh;q=0.9,en;q=0.8".to_string(),
        "en" | "en-us" => "en-US,en;q=0.9,zh-CN;q=0.7".to_string(),
        other => format!("{other};q=0.9,en-US;q=0.8,zh-CN;q=0.7"),
    }
}

fn build_base_request(client: &Client, method: Method, url: Url, locale: Option<&str>) -> reqwest::RequestBuilder {
    client
        .request(method, url)
        .header(ACCEPT, "application/json, text/plain, */*")
        .header(ACCEPT_LANGUAGE, build_accept_language(locale))
        .header(ORIGIN, POLLS_SITE_ORIGIN)
        .header(REFERER, POLLS_SITE_REFERER)
}

fn is_cloudflare_challenge_html(body: &str) -> bool {
    body.contains("Just a moment...")
        || body.contains("/cdn-cgi/challenge-platform/")
        || body.contains("cf-browser-verification")
}

fn try_send_with_curl(
    method: Method,
    url: &Url,
    locale: Option<&str>,
    body: Option<serde_json::Value>,
) -> Result<RawHttpResponse, String> {
    let mut command = Command::new("curl");
    command
        .arg("-sS")
        .arg("-L")
        .arg("--http1.1")
        .arg("-X")
        .arg(method.as_str())
        .arg("-H")
        .arg("accept: application/json, text/plain, */*")
        .arg("-H")
        .arg(format!("accept-language: {}", build_accept_language(locale)))
        .arg("-H")
        .arg(format!("origin: {POLLS_SITE_ORIGIN}"))
        .arg("-H")
        .arg(format!("referer: {POLLS_SITE_REFERER}"))
        .arg("-H")
        .arg(format!("user-agent: {BROWSER_LIKE_USER_AGENT}"));

    if let Some(payload) = body {
        command
            .arg("-H")
            .arg("content-type: application/json")
            .arg("--data")
            .arg(payload.to_string());
    }

    command
        .arg("--write-out")
        .arg(format!("\n{HTTP_STATUS_MARKER}%{{http_code}}"))
        .arg(url.as_str());

    let output = command
        .output()
        .map_err(|_| "NETWORK_ERROR: 网络请求失败，请检查网络后重试".to_string())?;

    if !output.status.success() {
        return Err("NETWORK_ERROR: 网络请求失败，请检查网络后重试".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let marker = format!("\n{HTTP_STATUS_MARKER}");
    let marker_index = stdout
        .rfind(&marker)
        .ok_or_else(|| "INVALID_RESPONSE: 服务返回异常，请稍后重试".to_string())?;

    let body_text = stdout[..marker_index].to_string();
    let status_text = stdout[marker_index + marker.len()..].trim();
    let status_code = status_text
        .parse::<u16>()
        .map_err(|_| "INVALID_RESPONSE: 服务返回异常，请稍后重试".to_string())?;

    Ok(RawHttpResponse {
        status_code,
        body: body_text,
    })
}

async fn send_with_403_retry(
    client: &Client,
    method: Method,
    url: Url,
    locale: Option<&str>,
    body: Option<serde_json::Value>,
) -> Result<RawHttpResponse, String> {
    let user_agents = [BROWSER_LIKE_USER_AGENT, CURL_LIKE_USER_AGENT];

    for (index, user_agent) in user_agents.iter().enumerate() {
        let mut request =
            build_base_request(client, method.clone(), url.clone(), locale).header(USER_AGENT, *user_agent);

        if let Some(body) = body.as_ref() {
            request = request.json(body);
        }

        let response = request
            .send()
            .await
            .map_err(|_| "NETWORK_ERROR: 网络请求失败，请检查网络后重试".to_string())?;

        let status_code = response.status().as_u16();
        let body_text = response
            .text()
            .await
            .map_err(|_| "INVALID_RESPONSE: 服务返回异常，请稍后重试".to_string())?;
        let raw_response = RawHttpResponse {
            status_code,
            body: body_text,
        };

        if status_code == StatusCode::FORBIDDEN.as_u16()
            && is_cloudflare_challenge_html(&raw_response.body)
        {
            if index + 1 < user_agents.len() {
                continue;
            }
            if let Ok(curl_response) =
                try_send_with_curl(method.clone(), &url, locale, body.clone())
            {
                return Ok(curl_response);
            }
            return Ok(raw_response);
        }

        return Ok(raw_response);
    }

    Err("NETWORK_ERROR: 网络请求失败，请检查网络后重试".to_string())
}

fn format_api_error(status_code: u16, response_body: &str) -> String {
    if let Ok(payload) = serde_json::from_str::<ApiErrorResponse>(response_body) {
        if let Some(error) = payload.error {
            let code = error
                .code
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| format!("HTTP_{status_code}"));
            let message = error
                .message
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| format!("请求失败，状态码: {status_code}"));
            return format!("{code}: {message}");
        }
    }
    match status_code {
        400 => "BAD_REQUEST: 请求参数有误，请稍后重试".to_string(),
        401 => "UNAUTHORIZED: 请求未授权，请稍后重试".to_string(),
        403 => "ACCESS_DENIED: 请求被安全策略拦截，请稍后重试".to_string(),
        404 => "NOT_FOUND: 请求资源不存在".to_string(),
        409 => "CONFLICT: 当前操作已处理，请刷新后重试".to_string(),
        429 => "RATE_LIMITED: 请求过于频繁，请稍后重试".to_string(),
        500..=599 => "SERVER_ERROR: 服务暂时不可用，请稍后重试".to_string(),
        _ => "REQUEST_FAILED: 请求失败，请稍后重试".to_string(),
    }
}

fn parse_api_payload<T: DeserializeOwned>(response: RawHttpResponse) -> Result<T, String> {
    if !(200..300).contains(&response.status_code) {
        return Err(format_api_error(response.status_code, &response.body));
    }

    let parsed = serde_json::from_str::<ApiSuccess<T>>(&response.body)
        .map_err(|_| "INVALID_RESPONSE: 服务返回异常，请稍后重试".to_string())?;
    Ok(parsed.data)
}

fn polls_url(path: &str, locale: Option<String>) -> Result<Url, String> {
    let mut url = Url::parse(&format!("{POLLS_API_BASE}{path}"))
        .map_err(|_| "REQUEST_FAILED: 请求失败，请稍后重试".to_string())?;
    if let Some(locale) = normalize_optional_string(locale) {
        url.query_pairs_mut().append_pair("locale", &locale);
    }
    Ok(url)
}

#[tauri::command]
pub fn get_poll_client_state() -> Result<PollClientStatePayload, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    let existing = config
        .poll_client_state
        .clone()
        .unwrap_or_default();

    let normalized = normalize_poll_client_state(PollClientStatePayload {
        voter_id: existing.voter_id,
        voted_options: existing.voted_options,
    });

    let should_update = config
        .poll_client_state
        .as_ref()
        .map(|state| {
            state.voter_id != normalized.voter_id
                || state.voted_options != normalized.voted_options
        })
        .unwrap_or(true);
    if should_update {
        config.poll_client_state = Some(ModelPollClientState {
            voter_id: normalized.voter_id.clone(),
            voted_options: normalized.voted_options.clone(),
        });
        let _ = manager.save(&config);
    }

    Ok(normalized)
}

#[tauri::command]
pub fn save_poll_client_state(state: PollClientStatePayload) -> Result<(), String> {
    let normalized = normalize_poll_client_state(state);

    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.poll_client_state = Some(ModelPollClientState {
        voter_id: normalized.voter_id,
        voted_options: normalized.voted_options,
    });
    manager.save(&config)
}

#[tauri::command]
pub async fn fetch_polls(locale: Option<String>) -> Result<Vec<Poll>, String> {
    let normalized_locale = normalize_optional_string(locale);
    let client = Client::new();
    let url = polls_url("/polls", normalized_locale.clone())?;
    let response = send_with_403_retry(
        &client,
        Method::GET,
        url,
        normalized_locale.as_deref(),
        None,
    )
    .await?;
    parse_api_payload(response)
}

#[tauri::command]
pub async fn fetch_poll_results(
    poll_id: String,
    locale: Option<String>,
) -> Result<PollResult, String> {
    let normalized_poll_id = poll_id.trim().to_string();
    if normalized_poll_id.is_empty() {
        return Err("INVALID_POLL_ID: pollId 不能为空".to_string());
    }

    let normalized_locale = normalize_optional_string(locale);
    let client = Client::new();
    let path = format!("/polls/{}/results", normalized_poll_id);
    let url = polls_url(&path, normalized_locale.clone())?;
    let response = send_with_403_retry(
        &client,
        Method::GET,
        url,
        normalized_locale.as_deref(),
        None,
    )
    .await?;
    parse_api_payload(response)
}

#[tauri::command]
pub async fn submit_poll_vote(
    poll_id: String,
    request: PollVoteRequest,
) -> Result<PollVote, String> {
    let normalized_poll_id = poll_id.trim().to_string();
    if normalized_poll_id.is_empty() {
        return Err("INVALID_POLL_ID: pollId 不能为空".to_string());
    }

    let normalized_voter_id = request.voter_id.trim().to_string();
    if normalized_voter_id.is_empty() {
        return Err("INVALID_VOTER_ID: voterId 不能为空".to_string());
    }

    let normalized_option_id = request.option_id.trim().to_string();
    if normalized_option_id.is_empty() {
        return Err("INVALID_OPTION: optionId 不能为空".to_string());
    }

    let client = Client::new();
    let url = Url::parse(&format!("{POLLS_API_BASE}/polls/{}/votes", normalized_poll_id))
        .map_err(|_| "REQUEST_FAILED: 请求失败，请稍后重试".to_string())?;
    let payload = PollVoteRequest {
        voter_id: normalized_voter_id,
        option_id: normalized_option_id,
    };
    let body = serde_json::to_value(payload)
        .map_err(|_| "REQUEST_FAILED: 请求失败，请稍后重试".to_string())?;
    let response = send_with_403_retry(&client, Method::POST, url, None, Some(body)).await?;
    parse_api_payload(response)
}

#[cfg(test)]
mod tests {
    use super::{normalize_poll_client_state, PollClientStatePayload};
    use std::collections::HashMap;

    #[test]
    fn normalize_poll_client_state_trims_voter_and_filters_invalid_votes() {
        let mut voted_options = HashMap::new();
        voted_options.insert(" poll_a ".to_string(), " option_1 ".to_string());
        voted_options.insert("".to_string(), "option_2".to_string());
        voted_options.insert("poll_b".to_string(), "".to_string());

        let normalized = normalize_poll_client_state(PollClientStatePayload {
            voter_id: Some("  user-123  ".to_string()),
            voted_options,
        });

        assert_eq!(normalized.voter_id.as_deref(), Some("user-123"));
        assert_eq!(normalized.voted_options.len(), 1);
        assert_eq!(
            normalized.voted_options.get("poll_a").map(String::as_str),
            Some("option_1")
        );
    }
}
