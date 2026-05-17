use crate::models::LlmProvider;
use crate::services::llm::{chat, ChatMessage, ChatRequest, LlmError};
use crate::services::translation_cache::{CacheKey, CachedTranslation, TranslationCache};
use serde::{Deserialize, Serialize};

const MAX_CONTENT_CHARS: usize = 32_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillTranslationInput {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub content_md: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillTranslationOutput {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub content_md: Option<String>,
    pub cached: bool,
}

fn lang_name(code: &str) -> &'static str {
    match code {
        "zh" => "Simplified Chinese",
        "en" => "English",
        _ => "English",
    }
}

fn build_prompt(target_lang: &str, input: &SkillTranslationInput) -> Vec<ChatMessage> {
    let system = format!(
        "You translate developer-tool documentation to {target}.\n\
Preserve markdown formatting, code blocks, YAML frontmatter, and links.\n\
Do NOT translate: code identifiers, YAML keys, file paths, URLs, or commands.\n\
Reply ONLY with a JSON object with this shape: {{\"name\": string, \"description\": string, \"content_md\": string|null}}.\n\
If a field was not provided in the input, return null for it.",
        target = lang_name(target_lang)
    );

    let user_json = serde_json::json!({
        "name": input.name,
        "description": input.description,
        "content_md": input.content_md,
    });

    vec![
        ChatMessage {
            role: "system",
            content: system,
        },
        ChatMessage {
            role: "user",
            content: serde_json::to_string(&user_json).unwrap_or_default(),
        },
    ]
}

#[derive(Deserialize)]
struct LlmReply {
    name: Option<String>,
    description: Option<String>,
    #[serde(default)]
    content_md: Option<String>,
}

fn extract_json_block(text: &str) -> &str {
    let trimmed = text.trim();
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if end >= start {
                return &trimmed[start..=end];
            }
        }
    }
    trimmed
}

pub async fn translate_skill(
    provider: &LlmProvider,
    target_lang: &str,
    input: SkillTranslationInput,
) -> Result<SkillTranslationOutput, LlmError> {
    let total_chars = input.name.chars().count()
        + input.description.chars().count()
        + input
            .content_md
            .as_ref()
            .map(|s| s.chars().count())
            .unwrap_or(0);
    if total_chars > MAX_CONTENT_CHARS {
        return Err(LlmError::ContentTooLarge);
    }

    let cache = TranslationCache::new();
    let key = CacheKey {
        base_url: &provider.base_url,
        model: &provider.model,
        target_lang,
        source_name: &input.name,
        source_description: &input.description,
        source_content_md: input.content_md.as_deref(),
    };
    if let Some(hit) = cache.get(&key) {
        return Ok(SkillTranslationOutput {
            name: hit.name,
            description: hit.description,
            content_md: hit.content_md,
            cached: true,
        });
    }

    let messages = build_prompt(target_lang, &input);
    let raw = chat(
        provider,
        ChatRequest {
            messages,
            json_mode: true,
        },
    )
    .await?;

    let json_text = extract_json_block(&raw);
    let parsed: LlmReply = serde_json::from_str(json_text)
        .map_err(|e| LlmError::ParseError(format!("{e}; raw: {}", truncate(&raw, 200))))?;

    let output = CachedTranslation {
        name: parsed.name.unwrap_or_else(|| input.name.clone()),
        description: parsed
            .description
            .unwrap_or_else(|| input.description.clone()),
        content_md: parsed.content_md.or(input.content_md.clone()),
    };

    let _ = cache.put(&key, &output);

    Ok(SkillTranslationOutput {
        name: output.name,
        description: output.description,
        content_md: output.content_md,
        cached: false,
    })
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max).collect();
        format!("{truncated}…")
    }
}

pub fn clear_cache() -> std::io::Result<()> {
    TranslationCache::new().clear()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_json_block_handles_plain() {
        assert_eq!(extract_json_block(r#"{"a":1}"#), r#"{"a":1}"#);
    }

    #[test]
    fn extract_json_block_strips_surrounding_text() {
        let raw = "Sure, here is the JSON:\n```json\n{\"name\":\"x\"}\n```";
        assert_eq!(extract_json_block(raw), r#"{"name":"x"}"#);
    }

    #[test]
    fn extract_json_block_returns_input_when_no_braces() {
        assert_eq!(extract_json_block("no json"), "no json");
    }

    #[test]
    fn build_prompt_includes_target_language_name() {
        let messages = build_prompt(
            "zh",
            &SkillTranslationInput {
                name: "Foo".to_string(),
                description: "Bar".to_string(),
                content_md: None,
            },
        );
        assert_eq!(messages.len(), 2);
        assert!(messages[0].content.contains("Simplified Chinese"));
        assert!(messages[1].content.contains("Foo"));
        assert!(messages[1].content.contains("Bar"));
    }

    #[test]
    fn truncate_handles_short_string() {
        assert_eq!(truncate("hi", 10), "hi");
    }

    #[test]
    fn truncate_appends_ellipsis_when_too_long() {
        let result = truncate("abcdefgh", 4);
        assert_eq!(result, "abcd…");
    }
}
