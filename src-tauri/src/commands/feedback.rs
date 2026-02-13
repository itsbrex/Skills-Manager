use serde::Deserialize;
use serde_json::json;

const FEISHU_WEBHOOK_URL: &str =
    "https://open.feishu.cn/open-apis/bot/v2/hook/31a9a8c2-64a7-4e40-a854-16b2dfb458c1";

#[derive(Debug, Clone, Deserialize)]
pub struct FeedbackRequest {
    pub user_info: String,
    pub content: String,
    pub source: Option<String>,
    pub language: Option<String>,
}

fn sanitize_input(value: &str) -> String {
    value.trim().to_string()
}

fn normalized_optional(value: &Option<String>, fallback: &str) -> String {
    value
        .as_deref()
        .map(sanitize_input)
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn validate_feedback_request(request: &FeedbackRequest) -> Result<(), String> {
    if sanitize_input(&request.user_info).is_empty() {
        return Err("用户信息不能为空".to_string());
    }

    if sanitize_input(&request.content).is_empty() {
        return Err("反馈内容不能为空".to_string());
    }

    Ok(())
}

fn build_feedback_message_text(request: &FeedbackRequest) -> String {
    let user_info = sanitize_input(&request.user_info);
    let content = sanitize_input(&request.content);
    let source = normalized_optional(&request.source, "desktop-feedback-page");
    let language = normalized_optional(&request.language, "unknown");

    format!(
        "Skills Manager 用户反馈\n用户信息: {user_info}\n来源: {source}\n语言: {language}\n反馈内容:\n{content}"
    )
}

fn build_feishu_payload(request: &FeedbackRequest) -> serde_json::Value {
    json!({
      "msg_type": "text",
      "content": {
        "text": build_feedback_message_text(request)
      }
    })
}

#[tauri::command]
pub async fn submit_feedback(request: FeedbackRequest) -> Result<(), String> {
    validate_feedback_request(&request)?;
    let payload = build_feishu_payload(&request);

    let response = reqwest::Client::new()
        .post(FEISHU_WEBHOOK_URL)
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("发送反馈失败: {err}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "反馈提交失败，HTTP 状态码: {}",
            response.status().as_u16()
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|err| format!("反馈提交失败: {err}"))?;

    if body.trim().is_empty() {
        return Ok(());
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) {
        let code = value.get("code").and_then(|v| v.as_i64());
        let status_code = value.get("StatusCode").and_then(|v| v.as_i64());
        let msg = value
            .get("msg")
            .or_else(|| value.get("StatusMessage"))
            .and_then(|v| v.as_str())
            .unwrap_or("未知错误");

        if let Some(code) = code {
            if code != 0 {
                return Err(format!("反馈提交失败: {msg}"));
            }
        } else if let Some(status_code) = status_code {
            if status_code != 0 {
                return Err(format!("反馈提交失败: {msg}"));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_feedback_message_text_should_include_trimmed_fields() {
        let request = FeedbackRequest {
            user_info: "  Alice <alice@example.com>  ".to_string(),
            content: "  希望支持批量启用技能  ".to_string(),
            source: Some("desktop-feedback-page".to_string()),
            language: Some("zh".to_string()),
        };

        let text = build_feedback_message_text(&request);

        assert!(text.contains("Skills Manager 用户反馈"));
        assert!(text.contains("用户信息: Alice <alice@example.com>"));
        assert!(text.contains("来源: desktop-feedback-page"));
        assert!(text.contains("语言: zh"));
        assert!(text.contains("反馈内容:\n希望支持批量启用技能"));
    }

    #[test]
    fn build_feishu_payload_should_wrap_message_as_text_card() {
        let request = FeedbackRequest {
            user_info: "Tester".to_string(),
            content: "Feedback body".to_string(),
            source: None,
            language: None,
        };

        let payload = build_feishu_payload(&request);
        let msg_type = payload.get("msg_type").and_then(|v| v.as_str());
        let text = payload
            .get("content")
            .and_then(|v| v.get("text"))
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        assert_eq!(msg_type, Some("text"));
        assert!(text.contains("Tester"));
        assert!(text.contains("Feedback body"));
    }

    #[test]
    fn validate_feedback_request_should_reject_blank_fields() {
        let blank_user = FeedbackRequest {
            user_info: "   ".to_string(),
            content: "content".to_string(),
            source: None,
            language: None,
        };
        let blank_content = FeedbackRequest {
            user_info: "user".to_string(),
            content: "   ".to_string(),
            source: None,
            language: None,
        };

        assert!(validate_feedback_request(&blank_user).is_err());
        assert!(validate_feedback_request(&blank_content).is_err());
    }
}
