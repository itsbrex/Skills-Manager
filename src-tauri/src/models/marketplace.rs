use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceSource {
    pub id: String,
    pub name: String,
    pub url: String,
    pub source_type: SourceType,
    pub enabled: bool,
    pub builtin: bool,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SourceType {
    #[serde(rename = "github_repo")]
    GithubRepo,
    #[serde(rename = "skillsmp")]
    SkillsMp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceSkill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub source_id: String,
    pub source_name: String,
    pub repo_url: Option<String>,
    pub skill_path: Option<String>,
    pub tags: Vec<String>,
    pub install_status: InstallStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceSkillsResponse {
    pub skills: Vec<MarketplaceSkill>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InstallStatus {
    NotInstalled,
    Installed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillFileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub download_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<SkillFileNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub success: bool,
    pub skill_id: String,
    pub message: Option<String>,
    pub installed_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubContent {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub download_url: Option<String>,
    pub url: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillsMPSearchResult {
    #[serde(default, alias = "skill_id", alias = "slug")]
    pub id: Option<String>,
    #[serde(default, alias = "title")]
    pub name: Option<String>,
    #[serde(default, alias = "summary")]
    pub description: Option<String>,
    #[serde(default, alias = "owner", alias = "author")]
    pub author: Option<String>,
    #[serde(
        default,
        alias = "repo_url",
        alias = "repoUrl",
        alias = "github_url",
        alias = "githubUrl",
        alias = "url",
        alias = "github",
        alias = "link",
        alias = "repository",
        alias = "repository_url"
    )]
    pub repo_url: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillsMPResponse {
    #[serde(default)]
    pub data: Vec<SkillsMPSearchResult>,
    #[serde(default)]
    pub results: Vec<SkillsMPSearchResult>,
    #[serde(default)]
    pub success: Option<bool>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}
