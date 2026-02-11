use crate::models::update::{GithubRelease, UpdateInfo};
use semver::Version;
use std::error::Error;

const REPO_OWNER: &str = "jiweiyeah";
const REPO_NAME: &str = "Skills-Manager";

pub async fn check_for_updates(current_version: &str) -> Result<UpdateInfo, Box<dyn Error>> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        REPO_OWNER, REPO_NAME
    );

    // GitHub requires User-Agent
    let resp = client
        .get(&url)
        .header("User-Agent", "Skills-Manager-App")
        .send()
        .await?
        .json::<GithubRelease>()
        .await?;

    // Parse versions (strip 'v' prefix if present)
    let clean_latest = resp.tag_name.trim_start_matches('v');
    let latest_v = Version::parse(clean_latest)?;
    let current_v = Version::parse(current_version)?;

    Ok(UpdateInfo {
        has_update: latest_v > current_v,
        latest_version: resp.tag_name,
        download_url: resp.html_url,
        release_notes: resp.body,
    })
}
