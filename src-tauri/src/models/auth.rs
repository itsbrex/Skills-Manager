use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthProfile {
    pub username: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub provider: String,
    pub access_token: String,
    pub refresh_token: String,
    pub profile: AuthProfile,
}
