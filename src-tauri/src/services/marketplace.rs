use std::collections::{HashMap, HashSet};
use std::fs;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime};

use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;

use crate::models::{
    GitHubContent, InstallResult, InstallStatus, MarketplaceSkill, MarketplaceSkillsResponse,
    MarketplaceSource, SkillFileNode, SourceType,
};

const CACHE_TTL: Duration = Duration::from_secs(15 * 60);
const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_TREE_CACHE_TTL: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Clone, Deserialize)]
struct GitHubTreeEntry {
    path: String,
    #[serde(rename = "type")]
    kind: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubTreeResponse {
    tree: Vec<GitHubTreeEntry>,
}

#[derive(Debug, Clone)]
struct CachedGitHubTree {
    fetched_at: SystemTime,
    branch: String,
    tree: Vec<GitHubTreeEntry>,
}

static GITHUB_TREE_CACHE: OnceLock<Mutex<HashMap<String, CachedGitHubTree>>> = OnceLock::new();

pub struct MarketplaceCache {
    state: Mutex<Option<CachedMarketplaceState>>,
}

struct CachedMarketplaceState {
    fetched_at: SystemTime,
    skills: Vec<MarketplaceSkill>,
    query: Option<String>,
    has_more: bool,
    source_filter: Option<Vec<String>>,
}

impl Default for MarketplaceCache {
    fn default() -> Self {
        Self {
            state: Mutex::new(None),
        }
    }
}

impl MarketplaceCache {
    pub fn get_fresh_with_meta(
        &self,
        query: &Option<String>,
        source_filter: &Option<Vec<String>>,
    ) -> Option<MarketplaceSkillsResponse> {
        let guard = self.state.lock().ok()?;
        let cached = guard.as_ref()?;
        if cached.query != *query {
            return None;
        }
        if cached.source_filter != *source_filter {
            return None;
        }
        if cached.fetched_at.elapsed().ok()? > CACHE_TTL {
            return None;
        }
        Some(MarketplaceSkillsResponse {
            skills: cached.skills.clone(),
            has_more: cached.has_more,
        })
    }

    pub fn set(
        &self,
        skills: Vec<MarketplaceSkill>,
        query: Option<String>,
        has_more: bool,
        source_filter: Option<Vec<String>>,
    ) {
        if let Ok(mut guard) = self.state.lock() {
            *guard = Some(CachedMarketplaceState {
                fetched_at: SystemTime::now(),
                skills,
                query,
                has_more,
                source_filter,
            });
        }
    }

    pub fn invalidate(&self) {
        if let Ok(mut guard) = self.state.lock() {
            *guard = None;
        }
    }

    pub fn get_cached_skill(&self, skill_id: &str) -> Option<MarketplaceSkill> {
        let guard = self.state.lock().ok()?;
        let cached = guard.as_ref()?;
        cached.skills.iter().find(|s| s.id == skill_id).cloned()
    }

    pub fn get_any(&self) -> Option<Vec<MarketplaceSkill>> {
        let guard = self.state.lock().ok()?;
        let cached = guard.as_ref()?;
        Some(cached.skills.clone())
    }
}

pub struct MarketplaceService;

impl MarketplaceService {
    pub async fn fetch_marketplace_skills(
        sources: &[MarketplaceSource],
        skills_dir: &Path,
        query: Option<String>,
        github_token: Option<&str>,
    ) -> Result<Vec<MarketplaceSkill>, String> {
        let result =
            Self::fetch_marketplace_skills_page(sources, skills_dir, query, github_token, 1)
                .await?;
        Ok(result.skills)
    }

    pub async fn fetch_marketplace_skills_page(
        sources: &[MarketplaceSource],
        skills_dir: &Path,
        _query: Option<String>,
        github_token: Option<&str>,
        page: u32,
    ) -> Result<MarketplaceSkillsResponse, String> {
        let page = page.max(1);
        let mut skills = Vec::new();
        let mut errors: Vec<String> = Vec::new();
        let has_more = false;

        for source in sources.iter().filter(|s| s.enabled) {
            if source.source_type != SourceType::GithubRepo {
                continue;
            }
            if page > 1 {
                continue;
            }

            match Self::fetch_github_repo(source, github_token).await {
                Ok(mut fetched) => skills.append(&mut fetched),
                Err(err) => {
                    errors.push(format!("{}: {}", source.name, err));
                }
            }
        }

        for skill in skills.iter_mut() {
            if Self::check_install_status(&skill.id, &skill.source_id, skills_dir) {
                skill.install_status = InstallStatus::Installed;
            }
        }

        if skills.is_empty() && !errors.is_empty() {
            return Err(errors.join("; "));
        }

        Ok(MarketplaceSkillsResponse { skills, has_more })
    }

    pub async fn fetch_github_repo(
        source: &MarketplaceSource,
        github_token: Option<&str>,
    ) -> Result<Vec<MarketplaceSkill>, String> {
        let (owner, repo) = parse_github_repo_url(&source.url)?;
        let client = github_client()?;
        let hinted_skill_dirs =
            fetch_github_root_skill_dirs_from_tree(&client, &owner, &repo, github_token).await;
        let contents = match fetch_github_contents(&client, &owner, &repo, "", github_token).await {
            Ok(contents) => contents,
            Err(err) => {
                if err.contains("GitHub API 请求受限") {
                    let dirs = fetch_github_root_dirs_from_html(&client, &owner, &repo).await?;
                    dirs.into_iter()
                        .map(|dir| GitHubContent {
                            name: dir.clone(),
                            path: dir,
                            kind: "dir".to_string(),
                            download_url: None,
                            url: None,
                            size: None,
                        })
                        .collect()
                } else {
                    return Err(err);
                }
            }
        };

        let mut skills = Vec::new();
        for item in contents
            .into_iter()
            .filter(|item| should_include_github_root_dir(item, hinted_skill_dirs.as_ref()))
        {
            let skill_path = item.path.clone();
            let repo_url = Some(source.url.clone());
            let skill_path_opt = Some(skill_path.clone());
            skills.push(MarketplaceSkill {
                id: make_marketplace_skill_id(&source.id, &skill_path),
                name: item.name.clone(),
                description: None,
                author: Some(owner.clone()),
                source_id: source.id.clone(),
                source_name: source.name.clone(),
                repo_url: repo_url.clone(),
                skill_path: skill_path_opt.clone(),
                external_url: build_marketplace_external_url(
                    None,
                    repo_url.as_deref(),
                    skill_path_opt.as_deref(),
                ),
                tags: Vec::new(),
                install_status: InstallStatus::NotInstalled,
            });
        }

        Ok(skills)
    }

    pub async fn fetch_skill_files(
        repo_url: &str,
        skill_path: &str,
        github_token: Option<&str>,
    ) -> Result<SkillFileNode, String> {
        let (owner, repo) = parse_github_repo_url(repo_url)?;
        let client = github_client()?;
        if let Some(tree) =
            fetch_skill_files_from_tree_api(&client, &owner, &repo, skill_path, github_token)
                .await?
        {
            return Ok(tree);
        }
        match build_github_tree(&client, &owner, &repo, skill_path, github_token).await {
            Ok(tree) => Ok(tree),
            Err(err) => {
                if err.contains("GitHub API 请求受限") {
                    if let Some(tree) =
                        fetch_skill_files_from_raw(&owner, &repo, skill_path).await?
                    {
                        return Ok(tree);
                    }
                }
                Err(err)
            }
        }
    }

    pub async fn fetch_skill_file_content(download_url: &str) -> Result<String, String> {
        let client = Client::new();
        let response = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| format!("文件请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("文件请求失败: HTTP {}", response.status()));
        }

        response
            .text()
            .await
            .map_err(|e| format!("文件读取失败: {}", e))
    }

    pub async fn install_skill(
        skill: &MarketplaceSkill,
        skills_dir: &Path,
        github_token: Option<&str>,
    ) -> Result<InstallResult, String> {
        let repo_url = skill
            .repo_url
            .as_deref()
            .ok_or_else(|| "Skill 缺少仓库地址，暂不支持安装".to_string())?;

        let skill_path = skill.skill_path.clone().unwrap_or_default();
        let install_dir = skills_dir.join(&skill.id);

        if install_dir.exists() {
            if !is_same_marketplace_skill(&install_dir, &skill.source_id)? {
                return Err("本地已存在同名 Skill（非市场来源），请重命名".to_string());
            }
            fs::remove_dir_all(&install_dir).map_err(|e| format!("无法覆盖已有 Skill: {}", e))?;
        }

        if !skills_dir.exists() {
            fs::create_dir_all(skills_dir).map_err(|e| format!("无法创建 Skills 目录: {}", e))?;
        }

        let tree = Self::fetch_skill_files(repo_url, &skill_path, github_token).await?;
        let mut files = Vec::new();
        collect_file_nodes(&tree, &mut files);

        let client = Client::new();
        for file in files {
            let download_url = match &file.download_url {
                Some(url) => url,
                None => continue,
            };

            let relative_path = normalize_local_path(&file.path, &skill_path);
            if relative_path.trim().is_empty() || relative_path == "." {
                continue;
            }

            let target_path = install_dir.join(&relative_path);
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("无法创建目录: {}", e))?;
            }

            let bytes = client
                .get(download_url)
                .send()
                .await
                .map_err(|e| format!("下载文件失败: {}", e))?
                .bytes()
                .await
                .map_err(|e| format!("读取文件失败: {}", e))?;

            fs::write(&target_path, &bytes).map_err(|e| format!("写入文件失败: {}", e))?;
        }

        write_marketplace_meta(&install_dir, skill)?;

        Ok(InstallResult {
            success: true,
            skill_id: skill.id.clone(),
            message: None,
            installed_path: Some(install_dir.to_string_lossy().to_string()),
        })
    }

    pub fn check_install_status(skill_id: &str, source_id: &str, skills_dir: &Path) -> bool {
        let dir = skills_dir.join(skill_id);
        if !dir.exists() {
            return false;
        }
        is_same_marketplace_skill(&dir, source_id).unwrap_or(false)
    }
}

fn github_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("skills-manager")
        .build()
        .map_err(|e| format!("无法创建 HTTP 客户端: {}", e))
}

fn github_tree_cache() -> &'static Mutex<HashMap<String, CachedGitHubTree>> {
    GITHUB_TREE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn github_tree_cache_key(owner: &str, repo: &str) -> String {
    format!("{}/{}", owner, repo)
}

fn get_cached_github_tree(owner: &str, repo: &str) -> Option<CachedGitHubTree> {
    let mut guard = github_tree_cache().lock().ok()?;
    let key = github_tree_cache_key(owner, repo);
    let cached = guard.get(&key).cloned()?;
    if cached.fetched_at.elapsed().ok()? > GITHUB_TREE_CACHE_TTL {
        guard.remove(&key);
        return None;
    }
    Some(cached)
}

fn set_cached_github_tree(owner: &str, repo: &str, branch: &str, tree: &[GitHubTreeEntry]) {
    if let Ok(mut guard) = github_tree_cache().lock() {
        guard.insert(
            github_tree_cache_key(owner, repo),
            CachedGitHubTree {
                fetched_at: SystemTime::now(),
                branch: branch.to_string(),
                tree: tree.to_vec(),
            },
        );
    }
}

fn parse_github_repo_url(url: &str) -> Result<(String, String), String> {
    let trimmed = url.trim_end_matches('/').trim_end_matches(".git");
    let parts: Vec<&str> = trimmed.split('/').collect();
    if parts.len() < 2 {
        return Err(format!("无效的 GitHub 仓库地址: {}", url));
    }
    let owner = parts[parts.len() - 2].to_string();
    let repo = parts[parts.len() - 1].to_string();
    Ok((owner, repo))
}

async fn fetch_github_root_skill_dirs_from_tree(
    client: &Client,
    owner: &str,
    repo: &str,
    github_token: Option<&str>,
) -> Option<HashSet<String>> {
    let branches = ["main", "master"];

    for branch in branches {
        let url = format!(
            "{}/repos/{}/{}/git/trees/{}?recursive=1",
            GITHUB_API_BASE, owner, repo, branch
        );
        let response = match with_github_auth(client.get(url), github_token).send().await {
            Ok(resp) => resp,
            Err(_) => continue,
        };

        if response.status().as_u16() == 404 {
            continue;
        }
        if !response.status().is_success() {
            continue;
        }

        let payload = match response.json::<GitHubTreeResponse>().await {
            Ok(value) => value,
            Err(_) => continue,
        };
        let dirs = extract_root_skill_dirs_from_tree_entries(&payload.tree);
        if !dirs.is_empty() {
            return Some(dirs);
        }
    }

    None
}

async fn fetch_skill_files_from_tree_api(
    client: &Client,
    owner: &str,
    repo: &str,
    skill_path: &str,
    github_token: Option<&str>,
) -> Result<Option<SkillFileNode>, String> {
    if let Some(cached) = get_cached_github_tree(owner, repo) {
        if let Some(tree) = build_skill_tree_from_tree_entries(
            &cached.tree,
            skill_path,
            owner,
            repo,
            &cached.branch,
        ) {
            return Ok(Some(tree));
        }
    }

    let branches = ["main", "master"];
    let mut rate_limited = false;

    for branch in branches {
        let url = format!(
            "{}/repos/{}/{}/git/trees/{}?recursive=1",
            GITHUB_API_BASE, owner, repo, branch
        );
        let response = with_github_auth(client.get(url), github_token)
            .send()
            .await
            .map_err(|e| format!("GitHub 请求失败: {}", e))?;

        if response.status().as_u16() == 404 {
            continue;
        }
        if response.status().as_u16() == 403 {
            rate_limited = true;
            continue;
        }
        if !response.status().is_success() {
            continue;
        }

        let payload = response
            .json::<GitHubTreeResponse>()
            .await
            .map_err(|e| format!("GitHub 响应解析失败: {}", e))?;
        set_cached_github_tree(owner, repo, branch, &payload.tree);
        let tree =
            build_skill_tree_from_tree_entries(&payload.tree, skill_path, owner, repo, branch);
        if tree.is_some() {
            return Ok(tree);
        }
    }

    if rate_limited {
        return Ok(None);
    }

    Ok(None)
}

fn build_skill_tree_from_tree_entries(
    entries: &[GitHubTreeEntry],
    skill_path: &str,
    owner: &str,
    repo: &str,
    branch: &str,
) -> Option<SkillFileNode> {
    let normalized_skill_path = skill_path.trim_matches('/');
    let prefix = if normalized_skill_path.is_empty() {
        String::new()
    } else {
        format!("{}/", normalized_skill_path)
    };

    let mut files: Vec<(String, String)> = entries
        .iter()
        .filter(|entry| entry.kind == "blob")
        .filter_map(|entry| {
            let normalized_path = entry.path.trim_matches('/').to_string();
            if normalized_skill_path.is_empty() {
                return Some(normalized_path);
            }
            if normalized_path.starts_with(&prefix) {
                return Some(normalized_path);
            }
            None
        })
        .map(|path| {
            let url = format!(
                "https://raw.githubusercontent.com/{}/{}/{}/{}",
                owner, repo, branch, path
            );
            (path, url)
        })
        .collect();

    if files.is_empty() {
        return None;
    }

    files.sort_by(|a, b| a.0.cmp(&b.0));

    let root_name = if normalized_skill_path.is_empty() {
        repo.to_string()
    } else {
        repo_path_name(normalized_skill_path)
    };
    let mut root = SkillFileNode {
        name: root_name,
        path: normalized_skill_path.to_string(),
        is_dir: true,
        download_url: None,
        children: Some(Vec::new()),
    };

    for (full_path, download_url) in files {
        insert_file_into_skill_tree(&mut root, normalized_skill_path, &full_path, download_url);
    }

    sort_skill_tree_children(&mut root);
    Some(root)
}

fn insert_file_into_skill_tree(
    root: &mut SkillFileNode,
    root_path: &str,
    full_path: &str,
    download_url: String,
) {
    let relative_path = if root_path.is_empty() {
        full_path.to_string()
    } else {
        full_path
            .strip_prefix(&format!("{}/", root_path))
            .unwrap_or(full_path)
            .to_string()
    };
    let segments: Vec<&str> = relative_path.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return;
    }

    insert_segments(root, root_path, &segments, full_path, download_url);
}

fn insert_segments(
    current: &mut SkillFileNode,
    current_path: &str,
    segments: &[&str],
    full_path: &str,
    download_url: String,
) {
    let Some((first, rest)) = segments.split_first() else {
        return;
    };

    let children = current.children.get_or_insert_with(Vec::new);
    if rest.is_empty() {
        if !children.iter().any(|n| !n.is_dir && n.path == full_path) {
            children.push(SkillFileNode {
                name: (*first).to_string(),
                path: full_path.to_string(),
                is_dir: false,
                download_url: Some(download_url),
                children: None,
            });
        }
        return;
    }

    let dir_path = if current_path.is_empty() {
        (*first).to_string()
    } else {
        format!("{}/{}", current_path, first)
    };

    let index = children
        .iter()
        .position(|node| node.is_dir && node.name == *first)
        .unwrap_or_else(|| {
            children.push(SkillFileNode {
                name: (*first).to_string(),
                path: dir_path.clone(),
                is_dir: true,
                download_url: None,
                children: Some(Vec::new()),
            });
            children.len() - 1
        });

    if !children[index].is_dir {
        children[index] = SkillFileNode {
            name: (*first).to_string(),
            path: dir_path.clone(),
            is_dir: true,
            download_url: None,
            children: Some(Vec::new()),
        };
    }

    let child = children.get_mut(index).expect("child index should exist");
    insert_segments(child, &dir_path, rest, full_path, download_url);
}

fn sort_skill_tree_children(node: &mut SkillFileNode) {
    if let Some(children) = node.children.as_mut() {
        for child in children.iter_mut().filter(|child| child.is_dir) {
            sort_skill_tree_children(child);
        }
        children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
    }
}

fn should_include_github_root_dir(
    item: &GitHubContent,
    hinted_skill_dirs: Option<&HashSet<String>>,
) -> bool {
    if item.kind != "dir" {
        return false;
    }
    if item.name.starts_with('.') || item.path.starts_with('.') {
        return false;
    }
    if let Some(hints) = hinted_skill_dirs {
        return hints.contains(&item.path) || hints.contains(&item.name);
    }
    true
}

fn extract_root_skill_dirs_from_tree_entries(entries: &[GitHubTreeEntry]) -> HashSet<String> {
    let mut dirs = HashSet::new();
    for entry in entries {
        if entry.kind != "blob" {
            continue;
        }

        let path = entry.path.trim_matches('/');
        let mut parts = path.split('/').filter(|part| !part.is_empty());
        let Some(root) = parts.next() else {
            continue;
        };
        let Some(file) = parts.next() else {
            continue;
        };
        if parts.next().is_some() {
            continue;
        }
        if root.starts_with('.') {
            continue;
        }

        if is_skill_manifest_file(file) {
            dirs.insert(root.to_string());
        }
    }
    dirs
}

fn is_skill_manifest_file(file_name: &str) -> bool {
    matches!(
        file_name.to_ascii_lowercase().as_str(),
        "skill.md" | "readme.md"
    )
}

async fn fetch_github_root_dirs_from_html(
    client: &Client,
    owner: &str,
    repo: &str,
) -> Result<Vec<String>, String> {
    let branches = ["main", "master"];
    let mut result: HashSet<String> = HashSet::new();

    for branch in branches {
        let url = format!("https://github.com/{}/{}/tree/{}", owner, repo, branch);
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("GitHub 页面请求失败: {}", e))?;
        if !response.status().is_success() {
            continue;
        }
        let html = response
            .text()
            .await
            .map_err(|e| format!("GitHub 页面读取失败: {}", e))?;
        extract_root_dirs_from_html(&html, owner, repo, branch, &mut result);
        if !result.is_empty() {
            break;
        }
    }

    if result.is_empty() {
        return Err("GitHub API 请求受限，且页面兜底未获取到目录".to_string());
    }

    let mut dirs: Vec<String> = result.into_iter().collect();
    dirs.sort();
    Ok(dirs)
}

fn extract_root_dirs_from_html(
    html: &str,
    owner: &str,
    repo: &str,
    branch: &str,
    out: &mut HashSet<String>,
) {
    let marker = format!("href=\"/{}/{}/tree/{}/", owner, repo, branch);
    let mut search_start = 0usize;
    while let Some(pos) = html[search_start..].find(&marker) {
        let start = search_start + pos + marker.len();
        let rest = &html[start..];
        let Some(end_quote) = rest.find('"') else {
            break;
        };
        let raw_path = &rest[..end_quote];
        if !raw_path.is_empty() && !raw_path.contains('/') {
            let decoded = raw_path.replace("%20", " ");
            if !decoded.starts_with('.') {
                out.insert(decoded);
            }
        }
        search_start = start + end_quote;
    }
}

async fn fetch_github_contents(
    client: &Client,
    owner: &str,
    repo: &str,
    path: &str,
    github_token: Option<&str>,
) -> Result<Vec<GitHubContent>, String> {
    let url = if path.is_empty() {
        format!("{}/repos/{}/{}/contents", GITHUB_API_BASE, owner, repo)
    } else {
        format!(
            "{}/repos/{}/{}/contents/{}",
            GITHUB_API_BASE, owner, repo, path
        )
    };

    let response = with_github_auth(client.get(url), github_token)
        .send()
        .await
        .map_err(|e| format!("GitHub 请求失败: {}", e))?;

    if response.status().as_u16() == 403 {
        return Err("GitHub API 请求受限，请稍后再试".to_string());
    }

    if !response.status().is_success() {
        return Err(format!("GitHub 响应错误: HTTP {}", response.status()));
    }

    let value: Value = response
        .json()
        .await
        .map_err(|e| format!("GitHub 响应解析失败: {}", e))?;

    let list = value
        .as_array()
        .ok_or_else(|| "GitHub 响应格式异常".to_string())?;

    let mut contents = Vec::new();
    for item in list {
        let parsed: GitHubContent = serde_json::from_value(item.clone())
            .map_err(|e| format!("GitHub 内容解析失败: {}", e))?;
        contents.push(parsed);
    }

    Ok(contents)
}

async fn fetch_skill_files_from_raw(
    owner: &str,
    repo: &str,
    skill_path: &str,
) -> Result<Option<SkillFileNode>, String> {
    let client = Client::new();
    let branches = ["main", "master"];
    let candidates = ["SKILL.md", "README.md", "skill.md", "readme.md"];
    let mut files: Vec<SkillFileNode> = Vec::new();

    for candidate in candidates {
        if let Some(raw_url) =
            find_raw_file_url(&client, owner, repo, skill_path, candidate, &branches).await?
        {
            files.push(SkillFileNode {
                name: candidate.to_string(),
                path: join_repo_path(skill_path, candidate),
                is_dir: false,
                download_url: Some(raw_url),
                children: None,
            });
        }
    }

    if files.is_empty() {
        return Ok(None);
    }

    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(Some(SkillFileNode {
        name: repo_path_name(skill_path),
        path: skill_path.to_string(),
        is_dir: true,
        download_url: None,
        children: Some(files),
    }))
}

async fn find_raw_file_url(
    client: &Client,
    owner: &str,
    repo: &str,
    skill_path: &str,
    file_name: &str,
    branches: &[&str],
) -> Result<Option<String>, String> {
    let path = join_repo_path(skill_path, file_name);
    for branch in branches {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/{}/{}",
            owner, repo, branch, path
        );
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("raw 文件请求失败: {}", e))?;
        if response.status().is_success() {
            return Ok(Some(url));
        }
    }
    Ok(None)
}

fn join_repo_path(base: &str, name: &str) -> String {
    if base.is_empty() {
        name.to_string()
    } else {
        format!("{}/{}", base.trim_end_matches('/'), name)
    }
}

fn repo_path_name(path: &str) -> String {
    path.split('/')
        .last()
        .filter(|s| !s.is_empty())
        .unwrap_or(path)
        .to_string()
}

fn build_github_tree<'a>(
    client: &'a Client,
    owner: &'a str,
    repo: &'a str,
    path: &'a str,
    github_token: Option<&'a str>,
) -> Pin<Box<dyn Future<Output = Result<SkillFileNode, String>> + Send + 'a>> {
    Box::pin(async move {
        let contents = fetch_github_contents(client, owner, repo, path, github_token).await?;
        let mut children = Vec::new();

        for item in contents {
            if item.kind == "dir" {
                let child =
                    build_github_tree(client, owner, repo, &item.path, github_token).await?;
                children.push(child);
            } else {
                children.push(SkillFileNode {
                    name: item.name,
                    path: item.path,
                    is_dir: false,
                    download_url: item.download_url,
                    children: None,
                });
            }
        }

        children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        let name = path
            .split('/')
            .last()
            .filter(|s| !s.is_empty())
            .unwrap_or(path)
            .to_string();

        Ok(SkillFileNode {
            name,
            path: path.to_string(),
            is_dir: true,
            download_url: None,
            children: Some(children),
        })
    })
}

fn normalize_github_token(github_token: Option<&str>) -> Option<String> {
    github_token
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty())
}

fn with_github_auth(
    request: reqwest::RequestBuilder,
    github_token: Option<&str>,
) -> reqwest::RequestBuilder {
    if let Some(token) = normalize_github_token(github_token) {
        request.bearer_auth(token)
    } else {
        request
    }
}

fn build_marketplace_external_url(
    raw_url: Option<&str>,
    repo_url: Option<&str>,
    skill_path: Option<&str>,
) -> Option<String> {
    if let Some(raw) = raw_url.map(str::trim).filter(|url| !url.is_empty()) {
        return Some(raw.to_string());
    }

    let repo = repo_url.map(str::trim).filter(|url| !url.is_empty())?;

    if !repo.contains("github.com") {
        return Some(repo.to_string());
    }

    let (owner, repository) = match parse_github_repo_url(repo) {
        Ok(tuple) => tuple,
        Err(_) => return Some(repo.to_string()),
    };
    let base = format!("https://github.com/{}/{}", owner, repository);

    if let Some(path) = skill_path.map(str::trim).filter(|path| !path.is_empty()) {
        return Some(format!("{}/tree/HEAD/{}", base, path.trim_matches('/')));
    }

    Some(base)
}

fn make_marketplace_skill_id(source_id: &str, raw: &str) -> String {
    let combined = format!("{}-{}", source_id, raw);
    combined
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn collect_file_nodes(node: &SkillFileNode, files: &mut Vec<SkillFileNode>) {
    if node.is_dir {
        if let Some(children) = &node.children {
            for child in children {
                collect_file_nodes(child, files);
            }
        }
    } else {
        files.push(node.clone());
    }
}

fn normalize_local_path(path: &str, skill_path: &str) -> String {
    if skill_path.is_empty() {
        return path.to_string();
    }
    if path == skill_path {
        return ".".to_string();
    }
    let prefix = format!("{}/", skill_path.trim_end_matches('/'));
    if let Some(stripped) = path.strip_prefix(&prefix) {
        return stripped.to_string();
    }
    path.to_string()
}

fn write_marketplace_meta(dir: &Path, skill: &MarketplaceSkill) -> Result<(), String> {
    let meta = serde_json::json!({
        "name": skill.name,
        "description": skill.description,
        "version": "1.0",
        "source": "marketplace",
        "marketplace_source_id": skill.source_id,
        "marketplace_skill_id": skill.id,
        "repo_url": skill.repo_url,
        "skill_path": skill.skill_path,
        "author": skill.author,
        "tags": skill.tags,
    });

    let content =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("写入 meta.json 失败: {}", e))?;
    fs::write(dir.join("meta.json"), content).map_err(|e| format!("写入 meta.json 失败: {}", e))?;
    Ok(())
}

fn is_same_marketplace_skill(dir: &PathBuf, source_id: &str) -> Result<bool, String> {
    let meta_path = dir.join("meta.json");
    if !meta_path.exists() {
        return Ok(false);
    }
    let content =
        fs::read_to_string(&meta_path).map_err(|e| format!("读取 meta.json 失败: {}", e))?;
    let value: Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 meta.json 失败: {}", e))?;

    let source = value.get("source").and_then(|v| v.as_str());
    let stored_source_id = value.get("marketplace_source_id").and_then(|v| v.as_str());
    Ok(source == Some("marketplace") && stored_source_id == Some(source_id))
}

#[cfg(test)]
mod tests {
    use super::{
        build_marketplace_external_url, build_skill_tree_from_tree_entries, collect_file_nodes,
        extract_root_skill_dirs_from_tree_entries, get_cached_github_tree, github_tree_cache,
        github_tree_cache_key, normalize_github_token, set_cached_github_tree,
        should_include_github_root_dir, CachedGitHubTree, GitHubContent, GitHubTreeEntry,
        GITHUB_TREE_CACHE_TTL,
    };
    use std::collections::HashSet;
    use std::time::{Duration, SystemTime};

    #[test]
    fn normalize_github_token_returns_none_for_missing_or_blank_token() {
        assert_eq!(normalize_github_token(None), None);
        assert_eq!(normalize_github_token(Some("")), None);
        assert_eq!(normalize_github_token(Some("   ")), None);
    }

    #[test]
    fn normalize_github_token_trims_valid_token() {
        assert_eq!(
            normalize_github_token(Some("  ghp_example_token  ")),
            Some("ghp_example_token".to_string())
        );
    }

    #[test]
    fn build_marketplace_external_url_uses_skill_path_for_github_repo() {
        let link = build_marketplace_external_url(
            None,
            Some("https://github.com/foo/bar"),
            Some(".claude/skills/my-skill"),
        );
        assert_eq!(
            link,
            Some("https://github.com/foo/bar/tree/HEAD/.claude/skills/my-skill".to_string())
        );
    }

    #[test]
    fn build_marketplace_external_url_prefers_raw_link_when_available() {
        let link = build_marketplace_external_url(
            Some("https://github.com/foo/bar/tree/main/.claude/skills/my-skill"),
            Some("https://github.com/foo/bar"),
            Some(".claude/skills/my-skill"),
        );
        assert_eq!(
            link,
            Some("https://github.com/foo/bar/tree/main/.claude/skills/my-skill".to_string())
        );
    }

    #[test]
    fn build_marketplace_external_url_returns_repo_for_non_github() {
        let link = build_marketplace_external_url(
            None,
            Some("https://example.com/skills/my-skill"),
            Some(".claude/skills/my-skill"),
        );
        assert_eq!(
            link,
            Some("https://example.com/skills/my-skill".to_string())
        );
    }

    #[test]
    fn should_include_github_root_dir_filters_hidden_dir() {
        let hidden = GitHubContent {
            name: ".claude-plugin".to_string(),
            path: ".claude-plugin".to_string(),
            kind: "dir".to_string(),
            download_url: None,
            url: None,
            size: None,
        };
        assert!(!should_include_github_root_dir(&hidden, None));
    }

    #[test]
    fn extract_root_skill_dirs_from_tree_entries_keeps_only_root_skill_dirs() {
        let entries = vec![
            GitHubTreeEntry {
                path: "activecampaign-automation/SKILL.md".to_string(),
                kind: "blob".to_string(),
            },
            GitHubTreeEntry {
                path: ".claude-plugin/README.md".to_string(),
                kind: "blob".to_string(),
            },
            GitHubTreeEntry {
                path: "nested/path/SKILL.md".to_string(),
                kind: "blob".to_string(),
            },
        ];
        let dirs = extract_root_skill_dirs_from_tree_entries(&entries);
        let expected: HashSet<String> = ["activecampaign-automation".to_string()]
            .into_iter()
            .collect();
        assert_eq!(dirs, expected);
    }

    #[test]
    fn build_skill_tree_from_tree_entries_builds_nested_tree_and_download_urls() {
        let entries = vec![
            GitHubTreeEntry {
                path: "my-skill/SKILL.md".to_string(),
                kind: "blob".to_string(),
            },
            GitHubTreeEntry {
                path: "my-skill/docs/guide.md".to_string(),
                kind: "blob".to_string(),
            },
        ];
        let tree = build_skill_tree_from_tree_entries(&entries, "my-skill", "foo", "bar", "main")
            .expect("tree should exist");

        assert_eq!(tree.name, "my-skill");
        assert_eq!(count_files(&tree), 2);

        let mut urls = Vec::new();
        collect_file_nodes(&tree, &mut urls);
        assert!(urls.iter().any(|node| node.path == "my-skill/SKILL.md"));
        assert!(urls.iter().any(|node| {
            node.download_url
                .as_ref()
                .map(|url| {
                    url.contains("raw.githubusercontent.com/foo/bar/main/my-skill/docs/guide.md")
                })
                .unwrap_or(false)
        }));
    }

    #[test]
    fn github_tree_cache_round_trip() {
        let entries = vec![GitHubTreeEntry {
            path: "skill/SKILL.md".to_string(),
            kind: "blob".to_string(),
        }];
        let owner = "cache-owner-round-trip";
        let repo = "cache-repo-round-trip";

        set_cached_github_tree(owner, repo, "main", &entries);

        let cached = get_cached_github_tree(owner, repo).expect("cache should exist");
        assert_eq!(cached.branch, "main");
        assert_eq!(cached.tree.len(), 1);
    }

    #[test]
    fn get_cached_github_tree_discards_expired_entry() {
        let owner = "cache-owner-expired";
        let repo = "cache-repo-expired";
        let key = github_tree_cache_key(owner, repo);
        {
            let mut guard = github_tree_cache().lock().expect("lock cache");
            guard.insert(
                key,
                CachedGitHubTree {
                    fetched_at: SystemTime::now() - GITHUB_TREE_CACHE_TTL - Duration::from_secs(1),
                    branch: "main".to_string(),
                    tree: vec![GitHubTreeEntry {
                        path: "skill/SKILL.md".to_string(),
                        kind: "blob".to_string(),
                    }],
                },
            );
        }

        assert!(get_cached_github_tree(owner, repo).is_none());
    }

    fn count_files(node: &super::SkillFileNode) -> usize {
        if !node.is_dir {
            return 1;
        }
        node.children
            .as_ref()
            .map(|children| children.iter().map(count_files).sum())
            .unwrap_or(0)
    }
}
